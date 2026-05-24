const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { read, DATA_DIR } = require('../utils/dataStore');

const FARM_NAME = 'Heart of Texas Organics Homeschool';

// Escape HTML entities for safe server-side rendering
function h(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function printCSS() {
  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #fff; color: #000; font-family: Georgia, serif; }

      .toolbar {
        position: fixed; top: 0; left: 0; right: 0; z-index: 100;
        background: #1a1d27; color: #e8eaf6;
        padding: 12px 24px; display: flex; gap: 12px; align-items: center;
        font-family: -apple-system, sans-serif; border-bottom: 1px solid #2e3250;
      }
      .toolbar-title { font-weight: 700; font-size: 15px; flex: 1; }
      .tb-btn {
        padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
        cursor: pointer; border: none;
      }
      .tb-primary { background: #6c8aff; color: #fff; }
      .tb-secondary { background: #22263a; color: #e8eaf6; border: 1px solid #2e3250; }

      .preview { margin-top: 56px; }

      .print-page {
        max-width: 720px; margin: 32px auto; padding: 36px 44px;
        border: 1px solid #ddd; border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08); background: #fff;
      }

      .print-farm { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 4px; }
      .print-title { font-size: 28px; font-weight: bold; margin: 4px 0 2px; }
      .print-subtitle { font-size: 14px; color: #555; }
      .print-header { border-bottom: 3px solid #000; padding-bottom: 14px; margin-bottom: 20px; }

      .info-row {
        display: flex; gap: 0; border: 1px solid #bbb; border-radius: 6px;
        overflow: hidden; margin-bottom: 20px; font-size: 13px;
      }
      .info-cell {
        flex: 1; padding: 10px 14px; border-right: 1px solid #bbb;
      }
      .info-cell:last-child { border-right: none; }
      .info-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; display: block; margin-bottom: 3px; }
      .info-value { font-weight: bold; }

      .section-label {
        font-size: 11px; font-weight: bold; text-transform: uppercase;
        letter-spacing: 0.08em; color: #555; border-bottom: 1px solid #ccc;
        padding-bottom: 4px; margin: 20px 0 12px;
      }

      .assignment-title { font-size: 20px; font-weight: bold; margin-bottom: 8px; }
      .description { font-size: 15px; line-height: 1.6; color: #222; margin-bottom: 12px; }

      .lines .line { border-bottom: 1px solid #bbb; height: 34px; }

      .score-box {
        border: 2px solid #000; border-radius: 6px; padding: 12px 20px;
        display: inline-flex; align-items: center; gap: 16px;
        margin-top: 28px; font-size: 14px; font-family: -apple-system, sans-serif;
      }
      .score-blank { width: 90px; border-bottom: 2px solid #000; height: 28px; display: inline-block; }

      /* Assessment */
      .subject-divider {
        font-size: 15px; font-weight: bold; background: #f0f0f0;
        padding: 6px 14px; margin: 22px 0 14px; border-left: 4px solid #333;
        font-family: -apple-system, sans-serif;
      }
      .question { margin-bottom: 22px; page-break-inside: avoid; }
      .question-text { font-size: 15px; font-weight: bold; margin-bottom: 10px; line-height: 1.5; }
      .options { padding-left: 8px; }
      .option { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; font-size: 14px; }
      .bubble { width: 16px; height: 16px; border: 2px solid #000; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }

      /* Cover table */
      .cover-table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px; }
      .cover-table th { text-align: left; padding: 8px 6px; border-bottom: 2px solid #000; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
      .cover-table td { padding: 9px 6px; border-bottom: 1px solid #ddd; }

      @media print {
        .toolbar { display: none !important; }
        .preview { margin-top: 0; }
        .print-page { border: none; box-shadow: none; margin: 0; padding: 24px 32px; border-radius: 0; page-break-after: always; }
        .print-page:last-child { page-break-after: auto; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  `;
}

function layout(title, toolbarTitle, contentHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${h(title)}</title>
  ${printCSS()}
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-title">${h(toolbarTitle)}</div>
    <button class="tb-btn tb-secondary" onclick="history.back()">← Back</button>
    <button class="tb-btn tb-primary" onclick="window.print()">🖨️ Print</button>
  </div>
  <div class="preview">${contentHtml}</div>
</body>
</html>`;
}

function pageHeader(studentName, subject, dateStr) {
  return `
    <div class="print-header">
      <div class="print-farm">${h(FARM_NAME)}</div>
      <div class="print-title">${h(subject)}</div>
      <div class="print-subtitle">School Year 2025–2026</div>
    </div>
    <div class="info-row">
      <div class="info-cell"><span class="info-label">Student</span><span class="info-value">${h(studentName)}</span></div>
      <div class="info-cell"><span class="info-label">Date</span><span class="info-value">${h(formatDate(dateStr) || '&nbsp;')}</span></div>
      <div class="info-cell"><span class="info-label">Subject</span><span class="info-value">${h(subject)}</span></div>
    </div>
  `;
}

function workLines(count) {
  return `<div class="lines">${'<div class="line"></div>'.repeat(count)}</div>`;
}

function scoreBox() {
  return `
    <div class="score-box">
      <span>Score:</span><span class="score-blank"></span>
      <span>/ 100</span>
      <span style="margin-left:16px">Graded by:</span><span class="score-blank" style="width:130px"></span>
    </div>
  `;
}

// ── Single assignment print ──────────────────────────────
router.get('/assignment/:id', (req, res) => {
  const { assignments } = read('assignments.json');
  const { students } = read('students.json');
  const assignment = assignments.find(a => a.id === req.params.id);
  if (!assignment) return res.status(404).send('Assignment not found');

  const student = students.find(s => s.id === assignment.studentId);
  const studentName = student ? student.name : 'Student';

  const content = `
    <div class="print-page">
      ${pageHeader(studentName, assignment.subject, assignment.dueDate)}
      <div class="section-label">Assignment</div>
      <div class="assignment-title">${h(assignment.title)}</div>
      ${assignment.description ? `<div class="description">${h(assignment.description)}</div>` : ''}
      <div class="section-label">Instructions</div>
      <div class="description">Complete the work below. Show all your work and write neatly.</div>
      <div class="section-label">Work Space</div>
      ${workLines(20)}
      ${scoreBox()}
    </div>
  `;

  res.send(layout(
    `${assignment.title} — ${studentName}`,
    `Print: ${assignment.title}`,
    content
  ));
});

// ── Daily pack print ─────────────────────────────────────
router.get('/daily', (req, res) => {
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];
  const { assignments } = read('assignments.json');
  const { students } = read('students.json');

  const todayAssignments = assignments.filter(a => a.dueDate === targetDate && a.status === 'pending');

  if (todayAssignments.length === 0) {
    return res.send(layout(
      'Daily Pack',
      `Daily Pack — ${formatDate(targetDate)}`,
      `<div class="print-page"><p style="padding:40px;text-align:center;color:#aaa">No pending assignments for ${h(formatDate(targetDate))}.</p></div>`
    ));
  }

  const coverRows = todayAssignments.map((a, i) => {
    const s = students.find(st => st.id === a.studentId);
    return `<tr>
      <td>${i + 1}</td>
      <td>${h(s ? s.name : '')}</td>
      <td>${h(a.subject)}</td>
      <td>${h(a.title)}</td>
      <td style="font-size:18px">☐</td>
    </tr>`;
  }).join('');

  const cover = `
    <div class="print-page">
      <div class="print-header">
        <div class="print-farm">${h(FARM_NAME)}</div>
        <div class="print-title">Daily Assignment Pack</div>
        <div class="print-subtitle">${h(formatDate(targetDate))}</div>
      </div>
      <div class="section-label">Today's Assignments — ${todayAssignments.length} total</div>
      <table class="cover-table">
        <thead><tr><th>#</th><th>Student</th><th>Subject</th><th>Assignment</th><th>Done</th></tr></thead>
        <tbody>${coverRows}</tbody>
      </table>
    </div>
  `;

  const pages = todayAssignments.map(a => {
    const student = students.find(s => s.id === a.studentId);
    const studentName = student ? student.name : 'Student';
    return `
      <div class="print-page">
        ${pageHeader(studentName, a.subject, targetDate)}
        <div class="section-label">Assignment</div>
        <div class="assignment-title">${h(a.title)}</div>
        ${a.description ? `<div class="description">${h(a.description)}</div>` : ''}
        <div class="section-label">Work Space</div>
        ${workLines(18)}
        ${scoreBox()}
      </div>
    `;
  }).join('');

  res.send(layout(
    `Daily Pack — ${formatDate(targetDate)}`,
    `Daily Pack — ${formatDate(targetDate)} (${todayAssignments.length} assignments)`,
    cover + pages
  ));
});

// ── Assessment print ─────────────────────────────────────
router.get('/assessment/:grade', (req, res) => {
  const { grade } = req.params;
  const { studentId } = req.query;
  const gradeFile = path.join(DATA_DIR, 'assessments', `grade-${grade}`, 'questions.json');

  if (!fs.existsSync(gradeFile)) return res.status(404).send('Assessment not found');

  const assessment = JSON.parse(fs.readFileSync(gradeFile, 'utf8'));
  const { students } = read('students.json');
  const student = students.find(s => s.id === studentId);
  const studentName = student ? student.name : 'Student';
  const total = assessment.sections.reduce((sum, s) => sum + s.questions.length, 0);

  let qNum = 0;
  const sectionsHtml = assessment.sections.map(section => {
    const qHtml = section.questions.map(q => {
      qNum++;
      const optHtml = q.options.map((opt, i) => {
        const letter = ['A', 'B', 'C', 'D'][i];
        return `<div class="option"><div class="bubble"></div><span><strong>${h(letter)}.</strong>&nbsp;${h(opt)}</span></div>`;
      }).join('');
      return `
        <div class="question">
          <div class="question-text">${qNum}. ${h(q.text)}</div>
          <div class="options">${optHtml}</div>
        </div>
      `;
    }).join('');
    return `<div class="subject-divider">${h(section.subject)}</div>${qHtml}`;
  }).join('');

  const content = `
    <div class="print-page">
      <div class="print-header">
        <div class="print-farm">${h(FARM_NAME)}</div>
        <div class="print-title">Grade ${h(grade)} Assessment</div>
        <div class="print-subtitle">${h(assessment.title)} &middot; ${total} Questions</div>
      </div>
      <div class="info-row">
        <div class="info-cell"><span class="info-label">Student</span><span class="info-value">${h(studentName)}</span></div>
        <div class="info-cell"><span class="info-label">Date</span><span class="info-value">&nbsp;</span></div>
        <div class="info-cell"><span class="info-label">Score</span><span class="info-value">_______ / ${total}</span></div>
      </div>
      <p style="font-size:13px;color:#666;margin-bottom:20px;font-style:italic">
        Fill in the bubble next to the correct answer for each question.
      </p>
      ${sectionsHtml}
      ${scoreBox()}
    </div>
  `;

  res.send(layout(
    `Grade ${grade} Assessment — ${studentName}`,
    `Print: Grade ${grade} Assessment — ${studentName}`,
    content
  ));
});

module.exports = router;
