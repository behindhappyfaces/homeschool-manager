const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { read, write, DATA_DIR } = require('../utils/dataStore');
const { generateAssessmentFeedback } = require('../utils/claude');

router.get('/questions/:grade', (req, res) => {
  const gradeFile = path.join(DATA_DIR, 'assessments', `grade-${req.params.grade}`, 'questions.json');
  if (!fs.existsSync(gradeFile)) return res.status(404).json({ error: 'Assessment not found' });
  res.json(JSON.parse(fs.readFileSync(gradeFile, 'utf8')));
});

router.post('/submit', async (req, res) => {
  const { studentId, grade, answers } = req.body;

  const gradeFile = path.join(DATA_DIR, 'assessments', `grade-${grade}`, 'questions.json');
  if (!fs.existsSync(gradeFile)) return res.status(404).json({ error: 'Assessment not found' });

  const assessment = JSON.parse(fs.readFileSync(gradeFile, 'utf8'));
  const { students } = read('students.json');
  const student = students.find(s => s.id === studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const sections = assessment.sections.map(section => {
    let correct = 0;
    const questionResults = section.questions.map(q => {
      const given = answers[q.id];
      const isCorrect = given === q.answer;
      if (isCorrect) correct++;
      return { id: q.id, skill: q.skill, correct: isCorrect, given, expected: q.answer };
    });
    const score = Math.round((correct / section.questions.length) * 100);
    return { subject: section.subject, score, correct, total: section.questions.length, questions: questionResults };
  });

  const overallScore = Math.round(sections.reduce((sum, s) => sum + s.score, 0) / sections.length);

  const result = {
    id: `r-${Date.now()}`,
    studentId,
    studentName: student.name,
    grade,
    sections,
    overallScore,
    completedAt: new Date().toISOString()
  };

  const resultsData = read('assessment-results.json');
  resultsData.results.push(result);
  write('assessment-results.json', resultsData);

  const studentsData = read('students.json');
  const sIdx = studentsData.students.findIndex(s => s.id === studentId);
  if (sIdx !== -1) {
    studentsData.students[sIdx].assessmentStatus[`grade-${grade}`] = 'completed';
    sections.forEach(s => {
      if (studentsData.students[sIdx].subjects[s.subject]) {
        const current = studentsData.students[sIdx].subjects[s.subject].mastery;
        studentsData.students[sIdx].subjects[s.subject].mastery = current === 0 ? s.score : Math.round((current + s.score) / 2);
      }
    });
    write('students.json', studentsData);
  }

  const aiFeedback = await generateAssessmentFeedback(student.name, grade, { sections });

  res.json({ result, aiFeedback });
});

router.get('/results/:studentId', (req, res) => {
  const { results } = read('assessment-results.json');
  res.json(results.filter(r => r.studentId === req.params.studentId));
});

module.exports = router;
