const express = require('express');
const router = express.Router();
const { read, write } = require('../utils/dataStore');
const { syncStudentNote } = require('../utils/obsidian');

router.get('/', (req, res) => {
  const { students } = read('students.json');
  res.json(students);
});

router.get('/:id', (req, res) => {
  const { students } = read('students.json');
  const student = students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

router.put('/:id', (req, res) => {
  const data = read('students.json');
  const idx = data.students.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Student not found' });

  data.students[idx] = { ...data.students[idx], ...req.body };
  write('students.json', data);
  syncStudentNote(data.students[idx]);
  res.json(data.students[idx]);
});

router.put('/:id/mastery', (req, res) => {
  const { subject, mastery } = req.body;
  const data = read('students.json');
  const idx = data.students.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Student not found' });

  data.students[idx].subjects[subject].mastery = mastery;
  write('students.json', data);
  syncStudentNote(data.students[idx]);
  res.json(data.students[idx]);
});

// GET elective categories
router.get('/electives/categories', (req, res) => {
  const data = read('electives.json');
  res.json(data.categories);
});

// PUT save a student's elective enrollment + course selection
router.put('/:id/electives', (req, res) => {
  const { category, enrolled, course } = req.body;
  const data = read('students.json');
  const idx = data.students.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Student not found' });

  if (!data.students[idx].electives) data.students[idx].electives = {};
  data.students[idx].electives[category] = {
    enrolled,
    course: enrolled ? course : '',
    mastery: data.students[idx].electives[category]?.mastery || 0
  };

  write('students.json', data);
  syncStudentNote(data.students[idx]);
  res.json(data.students[idx]);
});

module.exports = router;
