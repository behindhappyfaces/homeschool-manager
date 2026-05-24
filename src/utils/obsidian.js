const fs = require('fs');
const path = require('path');

const VAULT_HOMESCHOOL = '/Users/deborahsmith/Documents/collab/Homeschool';

const FOLDERS = [
  'Students',
  'Assignments',
  'Assignments/2025-2026',
  'Assignments/2026-2027',
  'Assessments',
  'Progress',
  'Progress/2025-2026',
  'Curriculum'
];

function ensureVaultStructure() {
  FOLDERS.forEach(folder => {
    const dir = path.join(VAULT_HOMESCHOOL, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function syncStudentNote(student) {
  ensureVaultStructure();
  const masteryRows = Object.entries(student.subjects)
    .map(([subject, data]) => `| ${subject} | ${data.mastery}% | ${getMasteryLabel(data.mastery)} |`)
    .join('\n');

  const content = `---
name: ${student.name}
grade: ${student.currentGrade}
enteringGrade: ${student.enteringGrade}
schoolYear: ${student.schoolYear}
updated: ${new Date().toISOString().split('T')[0]}
---

# ${student.avatar} ${student.name}

**Current Grade:** ${student.currentGrade} → Entering Grade ${student.enteringGrade} (Fall 2026)
**Review Grade:** ${student.reviewGrade === 0 ? 'Kindergarten' : student.reviewGrade}
**School Year:** ${student.schoolYear}

## Subject Mastery

| Subject | Mastery | Level |
|---------|---------|-------|
${masteryRows}

## Assessment Status

| Assessment | Status |
|------------|--------|
${Object.entries(student.assessmentStatus).map(([k, v]) => `| Grade ${k.replace('grade-', '')} | ${v} |`).join('\n')}

## Notes

`;

  fs.writeFileSync(path.join(VAULT_HOMESCHOOL, 'Students', `${student.name.replace(/\s+/g, '-')}.md`), content);
}

function syncAssignmentNote(assignment, studentName) {
  ensureVaultStructure();
  const year = assignment.schoolYear || '2025-2026';
  const date = assignment.dueDate || new Date().toISOString().split('T')[0];
  const filename = `${date}-${assignment.subject.replace(/\s+/g, '-')}-${assignment.id}.md`;

  const content = `---
student: ${studentName}
subject: ${assignment.subject}
grade: ${assignment.grade}
dueDate: ${date}
status: ${assignment.status}
mastery: ${assignment.mastery || 0}
---

# ${assignment.title}

**Student:** ${studentName}
**Subject:** ${assignment.subject}
**Due:** ${date}
**Status:** ${assignment.status}
**Mastery Score:** ${assignment.mastery || 0}%

## Description

${assignment.description || ''}

## Notes

`;

  fs.writeFileSync(path.join(VAULT_HOMESCHOOL, 'Assignments', year, filename), content);
}

function syncProgressNote(student, periodLabel) {
  ensureVaultStructure();
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${student.name.replace(/\s+/g, '-')}-progress.md`;

  const avgMastery = Math.round(
    Object.values(student.subjects).reduce((sum, s) => sum + s.mastery, 0) /
    Object.keys(student.subjects).length
  );

  const content = `---
student: ${student.name}
period: ${periodLabel}
date: ${date}
overallMastery: ${avgMastery}
---

# Progress Report — ${student.name} — ${periodLabel}

**Date:** ${date}
**Overall Mastery:** ${avgMastery}%

## Subject Breakdown

| Subject | Mastery |
|---------|---------|
${Object.entries(student.subjects).map(([s, d]) => `| ${s} | ${d.mastery}% |`).join('\n')}

## Highlights


## Areas to Focus


`;

  fs.writeFileSync(path.join(VAULT_HOMESCHOOL, 'Progress', '2025-2026', filename), content);
}

function getMasteryLabel(score) {
  if (score >= 90) return '✅ Mastered';
  if (score >= 80) return '🟢 Proficient';
  if (score >= 60) return '🟡 Approaching';
  if (score >= 40) return '🟠 Developing';
  return '🔴 Beginning';
}

module.exports = { ensureVaultStructure, syncStudentNote, syncAssignmentNote, syncProgressNote };
