const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { read, write, DATA_DIR } = require('../utils/dataStore');
const { generateAssessmentFeedback } = require('../utils/claude');

const SUBJECTS_BY_GRADE = {
  'k':  ['mathematics', 'reading', 'science', 'social-studies'],
  '1':  ['mathematics', 'reading', 'writing', 'science', 'social-studies'],
  '3':  ['mathematics', 'reading', 'writing', 'science', 'social-studies'],
  '4':  ['mathematics', 'reading', 'writing', 'science', 'social-studies']
};

const SUBJECT_LABELS = {
  'mathematics':   'Mathematics',
  'reading':       'Reading',
  'writing':       'Writing/Grammar',
  'science':       'Science',
  'social-studies':'Social Studies'
};

// List available subjects for a grade
router.get('/subjects/:grade', (req, res) => {
  const { grade } = req.params;
  const subjects = SUBJECTS_BY_GRADE[grade] || [];
  res.json(subjects.map(s => ({ id: s, label: SUBJECT_LABELS[s] })));
});

// Get questions for a grade + subject
router.get('/questions/:grade/:subject', (req, res) => {
  const { grade, subject } = req.params;
  const file = path.join(DATA_DIR, 'assessments', `grade-${grade}`, `${subject}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Assessment not found' });
  res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

// Submit answers for a grade + subject
router.post('/submit', async (req, res) => {
  const { studentId, grade, subject, answers } = req.body;

  const file = path.join(DATA_DIR, 'assessments', `grade-${grade}`, `${subject}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Assessment not found' });

  const assessment = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { students } = read('students.json');
  const student = students.find(s => s.id === studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  let correct = 0;
  const questionResults = assessment.questions.map(q => {
    const given = answers[q.id];
    const isCorrect = given === q.answer;
    if (isCorrect) correct++;
    return { id: q.id, skill: q.skill, teks: q.teks, correct: isCorrect, given, expected: q.answer };
  });

  const score = Math.round((correct / assessment.questions.length) * 100);

  const result = {
    id: `r-${Date.now()}`,
    studentId,
    studentName: student.name,
    grade,
    subject,
    subjectLabel: SUBJECT_LABELS[subject] || subject,
    score,
    correct,
    total: assessment.questions.length,
    questions: questionResults,
    completedAt: new Date().toISOString()
  };

  const resultsData = read('assessment-results.json');
  resultsData.results.push(result);
  write('assessment-results.json', resultsData);

  // Update student assessment status and subject mastery
  const studentsData = read('students.json');
  const sIdx = studentsData.students.findIndex(s => s.id === studentId);
  if (sIdx !== -1) {
    if (!studentsData.students[sIdx].assessmentStatus[`grade-${grade}`]) {
      studentsData.students[sIdx].assessmentStatus[`grade-${grade}`] = {};
    }
    studentsData.students[sIdx].assessmentStatus[`grade-${grade}`][subject] = 'completed';

    const subjectLabel = SUBJECT_LABELS[subject];
    if (subjectLabel && studentsData.students[sIdx].subjects[subjectLabel]) {
      const current = studentsData.students[sIdx].subjects[subjectLabel].mastery;
      studentsData.students[sIdx].subjects[subjectLabel].mastery =
        current === 0 ? score : Math.round((current + score) / 2);
    }

    write('students.json', studentsData);
  }

  const aiFeedback = await generateAssessmentFeedback(student.name, `${grade} ${SUBJECT_LABELS[subject]}`, {
    sections: [{ subject: SUBJECT_LABELS[subject], score, correct, total: assessment.questions.length }]
  });

  res.json({ result, aiFeedback });
});

// Get all results for a student
router.get('/results/:studentId', (req, res) => {
  const { results } = read('assessment-results.json');
  res.json(results.filter(r => r.studentId === req.params.studentId));
});

module.exports = router;
