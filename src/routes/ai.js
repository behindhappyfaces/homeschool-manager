const express = require('express');
const router = express.Router();
const { read } = require('../utils/dataStore');
const { suggestLessons, generateDailyPlan } = require('../utils/claude');

router.post('/suggest-lessons', async (req, res) => {
  const { studentId, subject } = req.body;
  const { students } = read('students.json');
  const student = students.find(s => s.id === studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const mastery = student.subjects[subject]?.mastery || 0;
  const result = await suggestLessons(student, subject, mastery);
  res.json(result);
});

router.get('/daily-plan', async (req, res) => {
  const { students } = read('students.json');
  const result = await generateDailyPlan(students);
  res.json(result);
});

router.get('/status', (req, res) => {
  res.json({ aiEnabled: !!process.env.ANTHROPIC_API_KEY });
});

module.exports = router;
