// State
let students = [];
let currentCompleteId = null;
let currentAssessment = null;
let assessmentAnswers = {};

// Calendar state
let calCurrentMonth = new Date();
let calSelectedDate = null;
let calPersonFilter = 'all';
let calItems = [];
let calPersons = [];

// Escape HTML to prevent XSS from user-entered content
function h(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// API helpers
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return res.json();
}

// Navigation
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  if (page === 'dashboard') loadDashboard();
  if (page === 'students') loadStudentDetail();
  if (page === 'assignments') loadAssignments();
  if (page === 'assessments') loadAssessmentHome();
  if (page === 'calendar') loadCalendar();
  if (page === 'progress') loadProgress();
  if (page === 'ai-tools') loadAITools();
}

// Mastery helpers
function getMasteryColor(score) {
  if (score >= 90) return 'var(--accent)';
  if (score >= 80) return 'var(--green)';
  if (score >= 60) return 'var(--yellow)';
  if (score >= 40) return 'var(--orange)';
  return 'var(--red)';
}

function getMasteryLabel(score) {
  if (score >= 90) return 'Mastered';
  if (score >= 80) return 'Proficient';
  if (score >= 60) return 'Approaching';
  if (score >= 40) return 'Developing';
  return 'Beginning';
}

function getBadgeClass(score) {
  if (score >= 90) return 'badge-mastered';
  if (score >= 80) return 'badge-proficient';
  if (score >= 60) return 'badge-approaching';
  if (score >= 40) return 'badge-developing';
  return 'badge-beginning';
}

function masteryBarHtml(score) {
  return `<div class="mastery-bar"><div class="mastery-fill" style="width:${score}%;background:${getMasteryColor(score)}"></div></div>`;
}

// Dashboard
async function loadDashboard() {
  const today = new Date();
  document.getElementById('dashboard-date').textContent =
    today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  students = await api('/students');
  const assignments = await api('/assignments');
  const today_str = today.toISOString().split('T')[0];
  const todayAssignments = assignments.filter(a => a.dueDate === today_str);
  const pendingCount = assignments.filter(a => a.status === 'pending').length;
  const completedCount = assignments.filter(a => a.status === 'completed').length;

  const avgMastery = students.length > 0
    ? Math.round(students.reduce((sum, s) => {
        const subj = Object.values(s.subjects);
        return sum + subj.reduce((ss, sv) => ss + sv.mastery, 0) / subj.length;
      }, 0) / students.length)
    : 0;

  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${students.length}</div><div class="stat-label">Students</div></div>
    <div class="stat-card"><div class="stat-value">${pendingCount}</div><div class="stat-label">Pending</div></div>
    <div class="stat-card"><div class="stat-value">${completedCount}</div><div class="stat-label">Completed</div></div>
    <div class="stat-card"><div class="stat-value">${avgMastery}%</div><div class="stat-label">Avg Mastery</div></div>
  `;

  document.getElementById('dashboard-students').innerHTML = students.map(s => {
    const subjectValues = Object.values(s.subjects);
    const avg = Math.round(subjectValues.reduce((sum, sv) => sum + sv.mastery, 0) / subjectValues.length);
    const reviewLabel = s.reviewGrade === 0 ? 'Kindergarten' : `Grade ${s.reviewGrade}`;
    const topSubjects = Object.entries(s.subjects).slice(0, 4);
    return `
      <div class="student-card" onclick="navigate('students')">
        <div class="student-header">
          <div class="student-avatar">${h(s.avatar)}</div>
          <div>
            <div class="student-name">${h(s.name)}</div>
            <div class="student-meta">Grade ${h(s.currentGrade)} → Grade ${h(s.enteringGrade)} · Reviewing ${h(reviewLabel)}</div>
          </div>
        </div>
        <div class="mastery-bar-wrap">
          <div class="mastery-label"><span>Overall Mastery</span><span>${avg}% — ${getMasteryLabel(avg)}</span></div>
          ${masteryBarHtml(avg)}
        </div>
        <div class="subject-grid mt-4">
          ${topSubjects.map(([name, data]) => `
            <div class="subject-card">
              <div class="subject-name">${h(name)}</div>
              ${masteryBarHtml(data.mastery)}
              <div class="text-sm text-muted" style="margin-top:4px">${data.mastery}%</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  const todayEl = document.getElementById('today-assignments');
  if (todayAssignments.length === 0) {
    todayEl.innerHTML = `<div class="text-muted" style="text-align:center;padding:24px">No assignments due today.</div>`;
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary btn-sm';
    addBtn.textContent = 'Add one';
    addBtn.onclick = openAddAssignment;
    todayEl.querySelector('div').appendChild(addBtn);
  } else {
    todayEl.innerHTML = buildAssignmentTable(todayAssignments);
  }
}

function buildAssignmentTable(assignments) {
  const rows = assignments.map(a => assignmentRowHtml(a)).join('');
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Title</th><th>Student</th><th>Subject</th><th>Due</th><th>Status</th><th>Mastery</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function assignmentRowHtml(a) {
  const student = students.find(s => s.id === a.studentId);
  const name = student ? student.name : a.studentId;
  const masteryBadge = a.mastery !== null
    ? `<span class="badge ${getBadgeClass(a.mastery)}">${a.mastery}%</span>`
    : '—';
  const completeBtn = a.status === 'pending'
    ? `<button class="btn btn-success btn-sm" data-id="${h(a.id)}" onclick="openComplete(this.dataset.id)">✓ Complete</button>`
    : '<span class="text-muted text-sm">Done</span>';
  return `
    <tr>
      <td class="font-bold">${h(a.title)}</td>
      <td>${h(name)}</td>
      <td>${h(a.subject)}</td>
      <td>${h(a.dueDate || '—')}</td>
      <td><span class="badge badge-${h(a.status)}">${h(a.status)}</span></td>
      <td>${masteryBadge}</td>
      <td style="white-space:nowrap">
        ${completeBtn}
        <a class="btn btn-secondary btn-sm" href="/print/assignment/${h(a.id)}" target="_blank" style="margin-left:4px;text-decoration:none">🖨️</a>
        <button class="btn btn-secondary btn-sm" data-id="${h(a.id)}" onclick="deleteAssignment(this.dataset.id)" style="margin-left:4px">✕</button>
      </td>
    </tr>
  `;
}

// Students detail page
async function loadStudentDetail() {
  students = await api('/students');
  const electiveCategories = await api('/students/electives/categories');

  document.getElementById('students-detail').innerHTML = students.map(s => {
    const subjectValues = Object.values(s.subjects);
    const avg = Math.round(subjectValues.reduce((sum, sv) => sum + sv.mastery, 0) / subjectValues.length);
    const reviewLabel = s.reviewGrade === 0 ? 'Kindergarten' : `Grade ${s.reviewGrade}`;

    const subjectBars = Object.entries(s.subjects).map(([subject, data]) => `
      <div class="mastery-bar-wrap" style="margin-bottom:12px">
        <div class="mastery-label">
          <span>${h(subject)}</span>
          <span class="badge ${getBadgeClass(data.mastery)}">${data.mastery}% ${getMasteryLabel(data.mastery)}</span>
        </div>
        ${masteryBarHtml(data.mastery)}
      </div>
    `).join('');

    const SUBJ_SHORT = { mathematics:'Math', reading:'Reading', writing:'Writing/Grammar', science:'Science', 'social-studies':'Social Studies' };
    const assessmentRows = Object.entries(s.assessmentStatus).map(([gradeKey, subjects]) => {
      const gradeNum = gradeKey.replace('grade-', '');
      const gradeLabel = gradeNum === 'k' ? 'Kindergarten' : `Grade ${gradeNum}`;
      const completedCount = Object.values(subjects).filter(v => v === 'completed').length;
      const totalCount = Object.keys(subjects).length;
      const subjectRows = Object.entries(subjects).map(([subj, status]) => {
        const isDone = status === 'completed';
        const subjLabel = SUBJ_SHORT[subj] || subj;
        const btn = isDone
          ? `<span style="color:var(--green);font-size:13px">✓</span>`
          : `<button class="btn btn-secondary btn-sm" onclick="navigate('assessments')" style="padding:2px 8px;font-size:11px">Take</button>`;
        return `
          <div class="flex items-center gap-2" style="margin-bottom:4px;padding:4px 0;border-bottom:1px solid var(--border)">
            <span class="text-sm" style="flex:1">${h(subjLabel)}</span>
            <span class="badge badge-${isDone ? 'completed' : 'pending'}" style="font-size:10px">${isDone ? 'Done' : 'Pending'}</span>
            ${btn}
          </div>
        `;
      }).join('');
      return `
        <div style="margin-bottom:16px">
          <div class="flex items-center gap-3 mb-2">
            <span class="font-bold text-sm">${h(gradeLabel)}</span>
            <span class="text-muted text-sm">${completedCount}/${totalCount} complete</span>
          </div>
          ${subjectRows}
        </div>
      `;
    }).join('');

    const electiveRows = electiveCategories.map(cat => {
      const saved = s.electives?.[cat.name] || { enrolled: false, course: '', mastery: 0 };
      const optionItems = cat.courses.map(c =>
        `<option value="${h(c)}" ${saved.course === c ? 'selected' : ''}>${h(c)}</option>`
      ).join('');
      const selectId = `elective-${h(s.id)}-${h(cat.name.replace(/\s+/g, '-'))}`;
      const toggleId = `toggle-${h(s.id)}-${h(cat.name.replace(/\s+/g, '-'))}`;

      return `
        <div class="elective-row ${saved.enrolled ? 'enrolled' : ''}" id="erow-${h(s.id)}-${h(cat.name.replace(/\s+/g, '-'))}">
          <div class="elective-icon">${h(cat.icon)}</div>
          <div class="elective-info">
            <div class="elective-name">${h(cat.name)}</div>
            <div class="elective-course">
              <select class="form-select" id="${selectId}"
                style="padding:4px 8px;font-size:12px;${saved.enrolled ? '' : 'display:none'}"
                data-sid="${h(s.id)}" data-cat="${h(cat.name)}"
                onchange="saveElective('${h(s.id)}','${h(cat.name)}', this)">
                <option value="">— Select a course —</option>
                ${optionItems}
              </select>
              ${saved.enrolled && saved.course
                ? ''
                : `<span class="elective-placeholder" id="ep-${h(s.id)}-${h(cat.name.replace(/\s+/g, '-'))}" style="${saved.enrolled ? 'display:none' : ''}">Not enrolled</span>`
              }
            </div>
          </div>
          <div class="elective-controls">
            ${saved.enrolled && saved.mastery > 0
              ? `<span class="badge ${getBadgeClass(saved.mastery)}">${saved.mastery}%</span>`
              : ''}
            <label class="toggle-switch">
              <input type="checkbox" id="${toggleId}"
                ${saved.enrolled ? 'checked' : ''}
                data-sid="${h(s.id)}" data-cat="${h(cat.name)}"
                onchange="toggleElective('${h(s.id)}','${h(cat.name)}',this)">
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>
      `;
    }).join('');

    const enrolledCount = electiveCategories.filter(cat => s.electives?.[cat.name]?.enrolled).length;

    return `
      <div class="card">
        <div class="student-header">
          <div class="student-avatar" style="font-size:32px;width:60px;height:60px">${h(s.avatar)}</div>
          <div>
            <div class="student-name">${h(s.name)}</div>
            <div class="student-meta">Grade ${h(s.currentGrade)} → Entering Grade ${h(s.enteringGrade)} (Fall 2026)</div>
            <div class="student-meta">Reviewing: ${h(reviewLabel)}</div>
          </div>
        </div>
        <div class="mastery-bar-wrap mb-4">
          <div class="mastery-label"><span>Overall Mastery</span><span>${avg}% — ${getMasteryLabel(avg)}</span></div>
          ${masteryBarHtml(avg)}
        </div>

        <div class="tab-bar">
          <button class="tab-btn active" onclick="switchTab(this,'tab-core-${h(s.id)}')">Core Subjects</button>
          <button class="tab-btn" onclick="switchTab(this,'tab-electives-${h(s.id)}')">Electives <span style="font-size:11px;color:var(--text-muted)">(${enrolledCount} enrolled)</span></button>
          <button class="tab-btn" onclick="switchTab(this,'tab-assessments-${h(s.id)}')">Assessments</button>
        </div>

        <div class="tab-panel active" id="tab-core-${h(s.id)}">
          ${subjectBars}
        </div>

        <div class="tab-panel" id="tab-electives-${h(s.id)}">
          <p class="text-muted text-sm mb-4">Toggle a subject on to enroll, then select a specific course from the dropdown.</p>
          ${electiveRows}
        </div>

        <div class="tab-panel" id="tab-assessments-${h(s.id)}">
          ${assessmentRows}
        </div>
      </div>
    `;
  }).join('');
}

function switchTab(btn, panelId) {
  const card = btn.closest('.card');
  card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  card.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(panelId).classList.add('active');
}

async function toggleElective(studentId, category, checkbox) {
  const enrolled = checkbox.checked;
  const slug = category.replace(/\s+/g, '-');
  const row = document.getElementById(`erow-${studentId}-${slug}`);
  const select = document.getElementById(`elective-${studentId}-${slug}`);
  const placeholder = document.getElementById(`ep-${studentId}-${slug}`);

  if (row) row.classList.toggle('enrolled', enrolled);
  if (select) select.style.display = enrolled ? '' : 'none';
  if (placeholder) placeholder.style.display = enrolled ? 'none' : '';

  const course = enrolled ? (select?.value || '') : '';
  await api(`/students/${encodeURIComponent(studentId)}/electives`, {
    method: 'PUT',
    body: JSON.stringify({ category, enrolled, course })
  });
  students = await api('/students');
}

async function saveElective(studentId, category, select) {
  const course = select.value;
  await api(`/students/${encodeURIComponent(studentId)}/electives`, {
    method: 'PUT',
    body: JSON.stringify({ category, enrolled: true, course })
  });
  students = await api('/students');
}

// Assignments
async function loadAssignments() {
  students = await api('/students');

  const filterStudent = document.getElementById('filter-student').value;
  const filterStatus = document.getElementById('filter-status').value;

  let url = '/assignments?';
  if (filterStudent) url += `studentId=${encodeURIComponent(filterStudent)}&`;
  if (filterStatus) url += `status=${encodeURIComponent(filterStatus)}`;

  const assignments = await api(url);

  const studentSelect = document.getElementById('filter-student');
  if (studentSelect.options.length <= 1) {
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      studentSelect.appendChild(opt);
    });
  }

  const tbody = document.getElementById('assignments-table-body');
  if (assignments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:32px">No assignments found</td></tr>`;
    return;
  }
  tbody.innerHTML = assignments.map(a => assignmentRowHtml(a)).join('');
}

// Add Assignment
function openAddAssignment() {
  const studentSelect = document.getElementById('modal-student');
  studentSelect.innerHTML = '';
  students.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    studentSelect.appendChild(opt);
  });
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('modal-due').value = today;
  document.getElementById('assignment-modal').classList.add('open');
}

async function submitAssignment(e) {
  e.preventDefault();
  await api('/assignments', {
    method: 'POST',
    body: JSON.stringify({
      studentId: document.getElementById('modal-student').value,
      title: document.getElementById('modal-title').value,
      subject: document.getElementById('modal-subject').value,
      grade: document.getElementById('modal-grade').value,
      dueDate: document.getElementById('modal-due').value,
      description: document.getElementById('modal-description').value
    })
  });
  closeModal('assignment-modal');
  e.target.reset();
  loadAssignments();
}

// Complete assignment
function openComplete(id) {
  currentCompleteId = id;
  document.getElementById('mastery-score').value = '';
  document.getElementById('complete-modal').classList.add('open');
}

async function confirmComplete() {
  const score = document.getElementById('mastery-score').value;
  await api(`/assignments/${encodeURIComponent(currentCompleteId)}/complete`, {
    method: 'PUT',
    body: JSON.stringify({ mastery: score ? parseInt(score, 10) : null })
  });
  closeModal('complete-modal');
  loadAssignments();
  students = await api('/students');
}

async function deleteAssignment(id) {
  if (!confirm('Delete this assignment?')) return;
  await api(`/assignments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  loadAssignments();
}

// Modals
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Assessments
const ASSESSMENT_SUBJECT_LABELS = {
  'mathematics': 'Mathematics',
  'reading': 'Reading',
  'writing': 'Writing/Grammar',
  'science': 'Science',
  'social-studies': 'Social Studies'
};

async function loadAssessmentHome() {
  students = await api('/students');
  document.getElementById('assessment-quiz').classList.add('hidden');
  document.getElementById('assessment-results-view').classList.add('hidden');
  document.getElementById('assessment-home').classList.remove('hidden');

  document.getElementById('assessment-home').innerHTML = students.map(s => {
    const reviewKey = s.reviewGrade === 0 ? 'k' : String(s.reviewGrade);

    const gradeSections = Object.entries(s.assessmentStatus).map(([gradeKey, subjects]) => {
      const gradeNum = gradeKey.replace('grade-', '');
      const isReview = gradeNum === reviewKey;
      const gradeLabel = gradeNum === 'k' ? 'Kindergarten' : `Grade ${gradeNum}`;
      const typeLabel = isReview ? 'Review' : 'Current Year';
      const completedCount = Object.values(subjects).filter(v => v === 'completed').length;
      const totalCount = Object.keys(subjects).length;

      const subjectCards = Object.entries(subjects).map(([subjectKey, status]) => {
        const subjectLabel = ASSESSMENT_SUBJECT_LABELS[subjectKey] || subjectKey;
        const isDone = status === 'completed';
        const borderColor = isDone ? 'var(--green)' : 'var(--border)';
        const actionHtml = isDone
          ? `<div class="flex gap-2" style="flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" data-sid="${h(s.id)}" data-grade="${h(gradeNum)}" data-subj="${h(subjectKey)}" onclick="viewAssessmentResults(this.dataset.sid,this.dataset.grade,this.dataset.subj)">Results</button>
              <button class="btn btn-secondary btn-sm" data-sid="${h(s.id)}" data-grade="${h(gradeNum)}" data-subj="${h(subjectKey)}" onclick="startAssessment(this.dataset.sid,this.dataset.grade,this.dataset.subj)">Retake</button>
            </div>`
          : `<div class="flex gap-2" style="flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" data-sid="${h(s.id)}" data-grade="${h(gradeNum)}" data-subj="${h(subjectKey)}" onclick="startAssessment(this.dataset.sid,this.dataset.grade,this.dataset.subj)">Start</button>
              <a class="btn btn-secondary btn-sm" href="/print/assessment/${h(gradeNum)}/${h(subjectKey)}?studentId=${h(s.id)}" target="_blank" style="text-decoration:none">🖨️</a>
            </div>`;
        return `
          <div style="border:1px solid ${borderColor};border-radius:10px;padding:14px;background:var(--surface2)">
            <div class="font-bold text-sm mb-2">${h(subjectLabel)}</div>
            <div class="mb-3"><span class="badge badge-${isDone ? 'completed' : 'pending'}">${isDone ? 'Done' : 'Pending'}</span></div>
            ${actionHtml}
          </div>
        `;
      }).join('');

      return `
        <div class="mb-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="section-title" style="margin:0">${h(gradeLabel)}</div>
            <span class="badge badge-${isReview ? 'pending' : 'completed'}" style="font-size:11px">${h(typeLabel)}</span>
            <span class="text-muted text-sm">${completedCount}/${totalCount} done</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
            ${subjectCards}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="card mb-4">
        <div class="student-header mb-4">
          <div class="student-avatar">${h(s.avatar)}</div>
          <div>
            <div class="student-name">${h(s.name)}</div>
            <div class="student-meta">Grade ${h(s.currentGrade)} → Entering Grade ${h(s.enteringGrade)}</div>
          </div>
        </div>
        ${gradeSections}
      </div>
    `;
  }).join('');
}

async function startAssessment(studentId, grade, subject) {
  const data = await api(`/assessments/questions/${encodeURIComponent(grade)}/${encodeURIComponent(subject)}`);
  if (data.error) { alert('Assessment not found'); return; }

  currentAssessment = { studentId, grade, subject, questions: data.questions, title: data.title };
  assessmentAnswers = {};

  document.getElementById('assessment-home').classList.add('hidden');
  document.getElementById('assessment-results-view').classList.add('hidden');
  document.getElementById('assessment-quiz').classList.remove('hidden');

  const student = students.find(s => s.id === studentId);
  const total = data.questions.length;
  const quizEl = document.getElementById('assessment-quiz');

  const qHtml = data.questions.map((q, idx) => {
    const optHtml = q.options.map(opt => `
      <div class="answer-option" data-qid="${h(q.id)}" data-answer="${h(opt)}" onclick="selectAnswer(this)">
        <div class="answer-radio"></div>
        <span>${h(opt)}</span>
      </div>
    `).join('');
    return `
      <div class="assessment-question" id="q-wrap-${h(q.id)}">
        <div class="question-text"><span class="text-muted text-sm" style="margin-right:8px">${idx + 1}.</span>${h(q.text)}</div>
        ${optHtml}
      </div>
    `;
  }).join('');

  quizEl.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">${h(data.title)}</div>
        <div class="page-subtitle">${h(student?.name || '')} · ${total} questions</div>
      </div>
      <button class="btn btn-secondary" onclick="loadAssessmentHome()">← Back</button>
    </div>
    <div class="assessment-progress"><span id="quiz-progress">0 of ${total} answered</span></div>
    ${qHtml}
    <div class="flex gap-3 mt-6">
      <button class="btn btn-primary" id="submit-assessment-btn" onclick="submitAssessment()">Submit Assessment</button>
      <button class="btn btn-secondary" onclick="loadAssessmentHome()">Cancel</button>
    </div>
  `;
}

function selectAnswer(el) {
  const questionId = el.dataset.qid;
  const answer = el.dataset.answer;
  const wrap = document.getElementById(`q-wrap-${questionId}`);
  wrap.querySelectorAll('.answer-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  assessmentAnswers[questionId] = answer;

  const total = currentAssessment.questions.length;
  document.getElementById('quiz-progress').textContent = `${Object.keys(assessmentAnswers).length} of ${total} answered`;
}

async function submitAssessment() {
  const total = currentAssessment.questions.length;
  if (Object.keys(assessmentAnswers).length < total) {
    if (!confirm(`You've answered ${Object.keys(assessmentAnswers).length} of ${total} questions. Submit anyway?`)) return;
  }

  const btn = document.getElementById('submit-assessment-btn');
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  const { result, aiFeedback } = await api('/assessments/submit', {
    method: 'POST',
    body: JSON.stringify({
      studentId: currentAssessment.studentId,
      grade: currentAssessment.grade,
      subject: currentAssessment.subject,
      answers: assessmentAnswers
    })
  });

  showAssessmentResults(result, aiFeedback);
}

function showAssessmentResults(result, aiFeedback) {
  document.getElementById('assessment-quiz').classList.add('hidden');
  document.getElementById('assessment-results-view').classList.remove('hidden');

  const el = document.getElementById('assessment-results-view');

  const wrongItems = (result.questions || []).filter(q => !q.correct).map(q => `
    <div style="padding:10px;background:var(--surface2);border-radius:8px;margin-bottom:8px;border-left:3px solid var(--red)">
      <div class="text-sm font-bold mb-1">Skill: ${h(q.skill || '')}</div>
      <div class="text-sm text-muted">Your answer: ${h(q.given || '(none)')}</div>
      <div class="text-sm" style="color:var(--green)">Correct: ${h(q.expected || '')}</div>
    </div>
  `).join('') || '<div class="text-muted text-sm">Perfect score — all correct!</div>';

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Assessment Results</div>
        <div class="page-subtitle">${h(result.studentName)} · ${h(result.subjectLabel || result.subject)} · Grade ${h(result.grade)}</div>
      </div>
      <button class="btn btn-secondary" onclick="loadAssessmentHome()">← Back</button>
    </div>
    <div class="stats-row" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card"><div class="stat-value" style="color:${getMasteryColor(result.score)}">${result.score}%</div><div class="stat-label">Score</div></div>
      <div class="stat-card"><div class="stat-value">${result.correct} / ${result.total}</div><div class="stat-label">Correct</div></div>
      <div class="stat-card"><div class="stat-value"><span class="badge ${getBadgeClass(result.score)}">${getMasteryLabel(result.score)}</span></div><div class="stat-label">Level</div></div>
    </div>
    <div class="card mt-4">
      <div class="section-title mb-3">Missed Questions</div>
      ${wrongItems}
    </div>
    <div class="ai-panel mt-4">
      <div class="ai-panel-header">✨ AI Feedback</div>
      <div class="ai-content" id="ai-feedback-text"></div>
    </div>
  `;

  const feedbackEl = document.getElementById('ai-feedback-text');
  if (aiFeedback?.available) {
    feedbackEl.textContent = aiFeedback.feedback;
  } else {
    feedbackEl.textContent = aiFeedback?.message || 'Add ANTHROPIC_API_KEY to .env to enable personalized AI feedback.';
    feedbackEl.classList.add('ai-disabled');
  }
}

async function viewAssessmentResults(studentId, grade, subject) {
  const results = await api(`/assessments/results/${encodeURIComponent(studentId)}`);
  const result = results.filter(r => r.grade === grade && r.subject === subject).pop();
  if (!result) { alert('No results found'); return; }
  document.getElementById('assessment-home').classList.add('hidden');
  showAssessmentResults(result, null);
}

// Progress
async function loadProgress() {
  students = await api('/students');
  const assignments = await api('/assignments');

  document.getElementById('progress-content').innerHTML = students.map(s => {
    const studentAssignments = assignments.filter(a => a.studentId === s.id);
    const completed = studentAssignments.filter(a => a.status === 'completed');
    const completionRate = studentAssignments.length > 0
      ? Math.round((completed.length / studentAssignments.length) * 100)
      : 0;

    const subjectBars = Object.entries(s.subjects).map(([subject, data]) => `
      <div class="mastery-bar-wrap" style="margin-bottom:12px">
        <div class="mastery-label">
          <span>${h(subject)}</span>
          <span>${data.mastery}% — <span class="badge ${getBadgeClass(data.mastery)}">${getMasteryLabel(data.mastery)}</span></span>
        </div>
        ${masteryBarHtml(data.mastery)}
      </div>
    `).join('');

    const recentItems = completed.slice(-5).reverse().map(a => {
      const masteryBadge = a.mastery !== null
        ? `<span class="badge ${getBadgeClass(a.mastery)}" style="margin-left:auto">${a.mastery}%</span>`
        : '';
      return `
        <div class="flex items-center gap-3" style="margin-bottom:8px;padding:8px;background:var(--surface2);border-radius:8px">
          <span class="text-sm font-bold">${h(a.title)}</span>
          <span class="text-muted text-sm">${h(a.subject)}</span>
          ${masteryBadge}
        </div>
      `;
    }).join('') || '<div class="text-muted text-sm">No completed assignments yet</div>';

    return `
      <div class="card mb-4">
        <div class="student-header mb-4">
          <div class="student-avatar">${h(s.avatar)}</div>
          <div>
            <div class="student-name">${h(s.name)}</div>
            <div class="student-meta">${completed.length} of ${studentAssignments.length} assignments completed (${completionRate}%)</div>
          </div>
        </div>
        <div class="grid-2">
          <div><div class="section-title mb-4">Subject Mastery</div>${subjectBars}</div>
          <div><div class="section-title mb-4">Recent Completed</div>${recentItems}</div>
        </div>
      </div>
    `;
  }).join('');
}

// AI Tools
async function loadAITools() {
  students = await api('/students');
  const { aiEnabled } = await api('/ai/status');

  const banner = document.getElementById('ai-status-banner');
  if (aiEnabled) {
    banner.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center gap-3';
    wrap.innerHTML = '<span style="color:var(--green);font-size:20px">✅</span>';
    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'font-bold';
    title.textContent = 'AI is enabled';
    const sub = document.createElement('div');
    sub.className = 'text-muted text-sm';
    sub.textContent = 'Claude is connected and ready.';
    info.appendChild(title);
    info.appendChild(sub);
    wrap.appendChild(info);
    banner.appendChild(wrap);
  } else {
    banner.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center gap-3';
    wrap.innerHTML = '<span style="color:var(--yellow);font-size:20px">⚠️</span>';
    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'font-bold';
    title.textContent = 'AI is not yet enabled';
    const sub = document.createElement('div');
    sub.className = 'text-muted text-sm';
    sub.textContent = 'Add your ANTHROPIC_API_KEY to the .env file and restart the server to enable AI features.';
    info.appendChild(title);
    info.appendChild(sub);
    wrap.appendChild(info);
    banner.appendChild(wrap);
  }

  const studentSelect = document.getElementById('ai-student-select');
  studentSelect.innerHTML = '';
  students.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    studentSelect.appendChild(opt);
  });
}

async function generateDailyPlan() {
  const btn = event.target;
  btn.textContent = 'Generating...';
  btn.disabled = true;

  const result = await api('/ai/daily-plan');
  const output = document.getElementById('daily-plan-output');
  const textEl = document.getElementById('daily-plan-text');
  output.classList.remove('hidden');
  textEl.textContent = result.available ? result.plan : result.message;
  if (!result.available) textEl.classList.add('ai-disabled');

  btn.textContent = "Generate Today's Plan";
  btn.disabled = false;
}

async function getLessonSuggestions() {
  const btn = event.target;
  btn.textContent = 'Getting suggestions...';
  btn.disabled = true;

  const studentId = document.getElementById('ai-student-select').value;
  const subject = document.getElementById('ai-subject-select').value;

  const result = await api('/ai/suggest-lessons', {
    method: 'POST',
    body: JSON.stringify({ studentId, subject })
  });

  const output = document.getElementById('lesson-suggestions-output');
  const textEl = document.getElementById('lesson-suggestions-text');
  output.classList.remove('hidden');
  textEl.textContent = result.available ? result.suggestions : result.message;
  if (!result.available) textEl.classList.add('ai-disabled');

  btn.textContent = 'Get Suggestions';
  btn.disabled = false;
}

// Print helpers
function printDailyPack() {
  const today = new Date().toISOString().split('T')[0];
  window.open(`/print/daily?date=${today}`, '_blank');
}

// Add a subjects route for client (not strictly needed but prevents 404 noise)
fetch('/api/subjects').catch(() => {});

// ── Calendar ────────────────────────────────────────────────

const CAL_TYPE_ICONS = { routine:'🌅', chore:'🧹', academic:'📚', extracurricular:'🏃', work:'💼' };
const CAL_TYPE_LABELS = { routine:'Routine', chore:'Chore', academic:'Academic', extracurricular:'Extracurricular', work:'Work' };
const CAL_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function calPersonColor(id) { return (calPersons.find(p => p.id === id) || {}).color || '#8b90b8'; }
function calPersonEmoji(id) { return (calPersons.find(p => p.id === id) || {}).emoji || '👤'; }
function calPersonLabel(id) { return (calPersons.find(p => p.id === id) || {}).label || id; }

function calAddDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

async function loadCalendar() {
  const year = calCurrentMonth.getFullYear();
  const month = calCurrentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
  const start = gridStart.toISOString().split('T')[0];
  const end   = gridEnd.toISOString().split('T')[0];

  const { items, persons } = await api(`/calendar?start=${start}&end=${end}&person=${calPersonFilter}`);
  calItems   = items;
  calPersons = persons;

  renderCalGrid(gridStart, gridEnd, year, month);
  renderCalStars();
  if (calSelectedDate) renderDayPanel(calSelectedDate);
}

function renderCalGrid(gridStart, gridEnd, displayYear, displayMonth) {
  const byDate = {};
  for (const item of calItems) {
    (byDate[item.occurrenceDate] = byDate[item.occurrenceDate] || []).push(item);
  }
  const today = new Date().toISOString().split('T')[0];
  const cur = new Date(gridStart);
  let daysHtml = '';
  while (cur.toISOString().split('T')[0] <= gridEnd.toISOString().split('T')[0]) {
    const ds = cur.toISOString().split('T')[0];
    const isThisMonth = cur.getMonth() === displayMonth;
    const isToday     = ds === today;
    const isSelected  = ds === calSelectedDate;
    const dayItems    = byDate[ds] || [];
    const chips = dayItems.slice(0, 3).map(it => {
      const c = calPersonColor(it.assignedTo);
      const icon = CAL_TYPE_ICONS[it.type] || '•';
      const lineThru = it.starred ? 'opacity:0.55;' : '';
      return `<div class="cal-chip" style="background:${c}22;border-left:3px solid ${c};${lineThru}">${it.starred ? '⭐' : icon} ${h(it.title.length > 13 ? it.title.slice(0,13) + '…' : it.title)}</div>`;
    }).join('');
    const more = dayItems.length > 3 ? `<div class="cal-chip-more">+${dayItems.length - 3} more</div>` : '';
    daysHtml += `<div class="cal-day${isThisMonth ? '' : ' cal-day-other'}${isToday ? ' cal-day-today' : ''}${isSelected ? ' cal-day-selected' : ''}" data-date="${ds}" onclick="selectCalDay('${ds}')"><div class="cal-day-num">${cur.getDate()}</div>${chips}${more}</div>`;
    cur.setDate(cur.getDate() + 1);
  }

  const personBtns = `<button class="cal-person-btn ${calPersonFilter === 'all' ? 'active' : ''}" onclick="setCalPerson('all')">All</button>` +
    calPersons.map(p => `<button class="cal-person-btn ${calPersonFilter === p.id ? 'active' : ''}" onclick="setCalPerson('${h(p.id)}')">${h(p.emoji)} ${h(p.label)}</button>`).join('');

  const printUrl = calSelectedDate
    ? `/print/calendar/week?date=${calSelectedDate}&person=${calPersonFilter}`
    : `/print/calendar/week?date=${new Date().toISOString().split('T')[0]}&person=${calPersonFilter}`;

  document.getElementById('cal-grid').innerHTML = `
    <div class="cal-header-row">
      <div class="cal-month-nav">
        <button class="btn btn-secondary btn-sm" onclick="calNavMonth(-1)">‹</button>
        <div class="cal-month-title">${CAL_MONTH_NAMES[displayMonth]} ${displayYear}</div>
        <button class="btn btn-secondary btn-sm" onclick="calNavMonth(1)">›</button>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-primary btn-sm" onclick="openAddCalItem(null)">+ Add Item</button>
        <a class="btn btn-secondary btn-sm" href="${printUrl}" target="_blank" style="text-decoration:none">🖨️ Print Week</a>
      </div>
    </div>
    <div class="cal-person-filter">${personBtns}</div>
    <div class="cal-grid-weekdays"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div>
    <div class="cal-grid-days">${daysHtml}</div>
  `;
}

async function renderCalStars() {
  const stars = await api('/calendar/stars');
  const entries = Object.entries(stars);
  if (!entries.length) return;
  document.getElementById('cal-stars').innerHTML = `
    <div class="cal-stars-bar">
      <span class="font-bold text-sm" style="color:var(--yellow)">⭐ Star Bank</span>
      ${entries.map(([, d]) => `
        <div class="cal-star-item">
          <span>${h(d.emoji)} ${h(d.label)}</span>
          <span class="cal-star-count">${d.total}</span>
          <span class="text-muted text-sm">total</span>
          <span class="cal-star-pips">${'⭐'.repeat(Math.min(d.thisWeek, 7))}</span>
          <span class="text-muted text-sm">(${d.thisWeek} this week)</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDayPanel(dateStr) {
  calSelectedDate = dateStr;
  const d = new Date(dateStr + 'T12:00:00');
  const dayLabel = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const dayItems = calItems.filter(i => i.occurrenceDate === dateStr);

  const rows = dayItems.map(item => {
    const c = calPersonColor(item.assignedTo);
    const icon = CAL_TYPE_ICONS[item.type] || '•';
    return `
      <div class="cal-item-row ${item.starred ? 'cal-item-done' : ''}">
        <div class="cal-item-icon">${icon}</div>
        <div class="cal-item-body">
          <div class="cal-item-title">${item.starred ? `<span style="text-decoration:line-through;color:var(--text-muted)">${h(item.title)}</span>` : h(item.title)}</div>
          <div class="cal-item-meta">
            <span class="cal-person-chip" style="background:${c}22;color:${c}">${h(calPersonEmoji(item.assignedTo))} ${h(calPersonLabel(item.assignedTo))}</span>
            ${item.time ? `<span class="cal-type-chip">${h(item.time)}</span>` : ''}
            <span class="cal-type-chip">${h(CAL_TYPE_LABELS[item.type] || item.type)}</span>
            ${item.starValue > 0 ? `<span class="cal-type-chip" style="color:var(--yellow)">${'⭐'.repeat(item.starValue)}</span>` : ''}
          </div>
          ${item.notes ? `<div class="text-muted text-sm" style="margin-top:4px">${h(item.notes)}</div>` : ''}
        </div>
        <div class="cal-item-actions">
          <button class="cal-star-btn ${item.starred ? 'starred' : ''}"
            onclick="toggleCalStar('${h(item.id)}','${h(dateStr)}')"
            title="${item.starred ? 'Remove star' : 'Mark complete & earn ' + (item.starValue || 0) + ' star(s)'}">
            ${item.starred ? '⭐' : '☆'}
          </button>
          <button class="btn btn-secondary btn-sm" onclick="openEditCalItem('${h(item.id)}')" style="padding:4px 8px;font-size:12px">✏️</button>
          <button class="btn btn-secondary btn-sm" onclick="deleteCalItem('${h(item.id)}')" style="padding:4px 8px;font-size:12px;color:var(--red)">✕</button>
        </div>
      </div>
    `;
  }).join('') || `<div class="text-muted text-sm" style="padding:24px;text-align:center">No items for this day.<br><button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="openAddCalItem('${dateStr}')">+ Add Item</button></div>`;

  document.getElementById('cal-day-panel').innerHTML = `
    <div class="cal-day-panel-header">
      <div class="cal-day-panel-title">${h(dayLabel)}</div>
      <div class="flex gap-2">
        <button class="btn btn-primary btn-sm" onclick="openAddCalItem('${h(dateStr)}')">+ Add</button>
        <a class="btn btn-secondary btn-sm" href="/print/calendar/week?date=${h(dateStr)}&person=${calPersonFilter}" target="_blank" style="text-decoration:none">🖨️</a>
        <button class="btn btn-secondary btn-sm" onclick="closeDayPanel()">✕</button>
      </div>
    </div>
    ${rows}
  `;
  document.getElementById('cal-day-panel').classList.remove('hidden');
}

function selectCalDay(dateStr) {
  calSelectedDate = dateStr;
  const year = calCurrentMonth.getFullYear();
  const month = calCurrentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
  renderCalGrid(gridStart, gridEnd, year, month);
  renderDayPanel(dateStr);
}

function closeDayPanel() {
  calSelectedDate = null;
  document.getElementById('cal-day-panel').classList.add('hidden');
  loadCalendar();
}

function calNavMonth(dir) {
  calCurrentMonth = new Date(calCurrentMonth.getFullYear(), calCurrentMonth.getMonth() + dir, 1);
  calSelectedDate = null;
  document.getElementById('cal-day-panel').classList.add('hidden');
  loadCalendar();
}

function setCalPerson(personId) {
  calPersonFilter = personId;
  loadCalendar();
}

async function toggleCalStar(itemId, dateStr) {
  await api('/calendar/complete', {
    method: 'POST',
    body: JSON.stringify({ itemId, date: dateStr })
  });
  await loadCalendar();
}

function openAddCalItem(prefillDate) {
  document.getElementById('cal-modal-id').value = '';
  document.getElementById('cal-modal-title').value = '';
  document.getElementById('cal-modal-type').value = 'routine';
  document.getElementById('cal-modal-time').value = '';
  document.getElementById('cal-modal-notes').value = '';
  document.getElementById('cal-modal-starvalue').value = '1';
  document.getElementById('cal-modal-recurring').checked = false;
  document.getElementById('cal-modal-recurring-opts').classList.add('hidden');
  document.getElementById('cal-date-wrap').classList.remove('hidden');
  document.getElementById('cal-modal-date').value = prefillDate || new Date().toISOString().split('T')[0];
  ['0','1','2','3','4','5','6'].forEach(d => { const el = document.getElementById(`cal-day-${d}`); if (el) el.checked = false; });
  document.getElementById('cal-modal-rec-start').value = '';
  document.getElementById('cal-modal-rec-end').value = '';

  const sel = document.getElementById('cal-modal-person');
  sel.innerHTML = calPersons.map(p => `<option value="${h(p.id)}">${h(p.emoji)} ${h(p.label)}</option>`).join('');

  document.getElementById('cal-modal-title-el').textContent = 'Add Calendar Item';
  document.getElementById('cal-item-modal').classList.add('open');
}

function openEditCalItem(itemId) {
  const item = calItems.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('cal-modal-id').value = item.id;
  document.getElementById('cal-modal-title').value = item.title;
  document.getElementById('cal-modal-type').value = item.type;
  document.getElementById('cal-modal-time').value = item.time || '';
  document.getElementById('cal-modal-notes').value = item.notes || '';
  document.getElementById('cal-modal-starvalue').value = String(item.starValue ?? 1);
  document.getElementById('cal-modal-date').value = item.date || item.occurrenceDate || '';
  document.getElementById('cal-modal-recurring').checked = !!item.recurring;

  const sel = document.getElementById('cal-modal-person');
  sel.innerHTML = calPersons.map(p => `<option value="${h(p.id)}" ${p.id === item.assignedTo ? 'selected' : ''}>${h(p.emoji)} ${h(p.label)}</option>`).join('');

  if (item.recurring) {
    document.getElementById('cal-modal-recurring-opts').classList.remove('hidden');
    document.getElementById('cal-date-wrap').classList.add('hidden');
    const days = item.recurringDays || [];
    ['0','1','2','3','4','5','6'].forEach(d => { const el = document.getElementById(`cal-day-${d}`); if (el) el.checked = days.includes(Number(d)); });
    document.getElementById('cal-modal-rec-start').value = item.recurringStartDate || '';
    document.getElementById('cal-modal-rec-end').value   = item.recurringEndDate   || '';
  } else {
    document.getElementById('cal-modal-recurring-opts').classList.add('hidden');
    document.getElementById('cal-date-wrap').classList.remove('hidden');
  }

  document.getElementById('cal-modal-title-el').textContent = 'Edit Calendar Item';
  document.getElementById('cal-item-modal').classList.add('open');
}

async function submitCalItem(e) {
  e.preventDefault();
  const id = document.getElementById('cal-modal-id').value;
  const isRecurring = document.getElementById('cal-modal-recurring').checked;
  const recurringDays = ['0','1','2','3','4','5','6']
    .filter(d => document.getElementById(`cal-day-${d}`)?.checked)
    .map(Number);

  const payload = {
    title: document.getElementById('cal-modal-title').value,
    type:  document.getElementById('cal-modal-type').value,
    assignedTo: document.getElementById('cal-modal-person').value,
    date: isRecurring ? null : document.getElementById('cal-modal-date').value,
    time: document.getElementById('cal-modal-time').value,
    notes: document.getElementById('cal-modal-notes').value,
    recurring: isRecurring,
    recurringDays,
    recurringStartDate: isRecurring ? document.getElementById('cal-modal-rec-start').value || null : null,
    recurringEndDate:   isRecurring ? document.getElementById('cal-modal-rec-end').value   || null : null,
    starValue: Number(document.getElementById('cal-modal-starvalue').value) || 0
  };

  if (id) {
    await api(`/calendar/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    await api('/calendar', { method: 'POST', body: JSON.stringify(payload) });
  }
  closeModal('cal-item-modal');
  await loadCalendar();
  if (calSelectedDate) renderDayPanel(calSelectedDate);
}

async function deleteCalItem(itemId) {
  if (!confirm('Delete this item and all its completions? This removes it from all dates.')) return;
  await api(`/calendar/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
  await loadCalendar();
}

function toggleCalRecurring() {
  const on = document.getElementById('cal-modal-recurring').checked;
  document.getElementById('cal-modal-recurring-opts').classList.toggle('hidden', !on);
  document.getElementById('cal-date-wrap').classList.toggle('hidden', on);
}

// Init
loadDashboard();
