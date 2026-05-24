const express = require('express');
const router = express.Router();
const { read, write } = require('../utils/dataStore');
const { syncAssignmentNote } = require('../utils/obsidian');

router.get('/', (req, res) => {
  const { assignments } = read('assignments.json');
  const { studentId, status, subject } = req.query;
  let filtered = assignments;
  if (studentId) filtered = filtered.filter(a => a.studentId === studentId);
  if (status) filtered = filtered.filter(a => a.status === status);
  if (subject) filtered = filtered.filter(a => a.subject === subject);
  res.json(filtered);
});

router.post('/', (req, res) => {
  const data = read('assignments.json');
  const { students } = read('students.json');

  const assignment = {
    id: `a-${Date.now()}`,
    studentId: req.body.studentId,
    title: req.body.title,
    subject: req.body.subject,
    description: req.body.description || '',
    grade: req.body.grade,
    dueDate: req.body.dueDate || new Date().toISOString().split('T')[0],
    status: 'pending',
    mastery: null,
    schoolYear: '2025-2026',
    createdAt: new Date().toISOString()
  };

  data.assignments.push(assignment);
  write('assignments.json', data);

  const student = students.find(s => s.id === assignment.studentId);
  if (student) syncAssignmentNote(assignment, student.name);

  res.status(201).json(assignment);
});

router.put('/:id/complete', (req, res) => {
  const data = read('assignments.json');
  const { students } = read('students.json');
  const idx = data.assignments.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Assignment not found' });

  data.assignments[idx].status = 'completed';
  data.assignments[idx].mastery = req.body.mastery || null;
  data.assignments[idx].completedAt = new Date().toISOString();
  write('assignments.json', data);

  const student = students.find(s => s.id === data.assignments[idx].studentId);
  if (student) syncAssignmentNote(data.assignments[idx], student.name);

  res.json(data.assignments[idx]);
});

router.delete('/:id', (req, res) => {
  const data = read('assignments.json');
  data.assignments = data.assignments.filter(a => a.id !== req.params.id);
  write('assignments.json', data);
  res.json({ success: true });
});

module.exports = router;
