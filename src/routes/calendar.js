const express = require('express');
const router = express.Router();
const { read, write } = require('../utils/dataStore');
const { expandCalItems } = require('../utils/calendarExpand');

// GET /api/calendar/persons
router.get('/persons', (req, res) => {
  res.json(read('calendar.json').persons);
});

// GET /api/calendar/stars  — star counts per student
router.get('/stars', (req, res) => {
  const data = read('calendar.json');
  const today = new Date().toISOString().split('T')[0];
  const dow = new Date().getDay();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - dow);
  const weekStr = weekStart.toISOString().split('T')[0];

  const counts = {};
  for (const person of data.persons.filter(p => p.id.startsWith('student-'))) {
    const ids = new Set(data.items.filter(i => i.assignedTo === person.id).map(i => i.id));
    const starred = data.completions.filter(c => c.starred && ids.has(c.itemId));
    counts[person.id] = {
      label: person.label,
      emoji: person.emoji,
      color: person.color,
      total: starred.reduce((s, c) => s + (c.starsEarned || 1), 0),
      thisWeek: starred.filter(c => c.date >= weekStr).reduce((s, c) => s + (c.starsEarned || 1), 0)
    };
  }
  res.json(counts);
});

// GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD&person=all
router.get('/', (req, res) => {
  const { start, end, person = 'all' } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end required' });
  const data = read('calendar.json');
  res.json({ items: expandCalItems(data.items, data.completions, start, end, person), persons: data.persons });
});

// POST /api/calendar  — create item
router.post('/', (req, res) => {
  const data = read('calendar.json');
  const item = {
    id: `cal-${Date.now()}`,
    title: req.body.title || 'Untitled',
    type: req.body.type || 'routine',
    assignedTo: req.body.assignedTo || 'family',
    date: req.body.date || null,
    time: req.body.time || '',
    notes: req.body.notes || '',
    recurring: !!req.body.recurring,
    recurringDays: req.body.recurringDays || [],
    recurringStartDate: req.body.recurringStartDate || null,
    recurringEndDate: req.body.recurringEndDate || null,
    starValue: Number(req.body.starValue) || 0,
    createdAt: new Date().toISOString()
  };
  data.items.push(item);
  write('calendar.json', data);
  res.json(item);
});

// POST /api/calendar/complete  — toggle star/completion for an occurrence
router.post('/complete', (req, res) => {
  const { itemId, date } = req.body;
  const data = read('calendar.json');
  const item = data.items.find(i => i.id === itemId);
  const idx = data.completions.findIndex(c => c.itemId === itemId && c.date === date);

  if (idx !== -1 && data.completions[idx].starred) {
    data.completions.splice(idx, 1);
    write('calendar.json', data);
    return res.json({ ok: true, starred: false });
  }

  if (idx !== -1) {
    data.completions[idx].starred = true;
    data.completions[idx].starsEarned = item?.starValue || 0;
  } else {
    data.completions.push({
      id: `comp-${Date.now()}`,
      itemId,
      date,
      starred: true,
      starsEarned: item?.starValue || 0,
      completedAt: new Date().toISOString()
    });
  }
  write('calendar.json', data);
  res.json({ ok: true, starred: true });
});

// PUT /api/calendar/:id  — update item
router.put('/:id', (req, res) => {
  const data = read('calendar.json');
  const idx = data.items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.items[idx] = { ...data.items[idx], ...req.body, id: req.params.id };
  write('calendar.json', data);
  res.json(data.items[idx]);
});

// DELETE /api/calendar/:id
router.delete('/:id', (req, res) => {
  const data = read('calendar.json');
  data.items = data.items.filter(i => i.id !== req.params.id);
  data.completions = data.completions.filter(c => c.itemId !== req.params.id);
  write('calendar.json', data);
  res.json({ ok: true });
});

module.exports = router;
