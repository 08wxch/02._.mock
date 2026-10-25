import { icon } from '../icons.js';
import { e, uid } from '../utils.js';
import { toast, emptyState, confirmDialog } from '../ui.js';
import { getDB, saveDB, findExam, updateExam, deleteExam, classIdsOf, classCodesOf, currentTeacher, canViewExam, canManageExam, canEditExam, visibleStudents, isOwnerTeacher, findOrganization, examOrganizationIds, examOrganizationName, hasAllOrganizationAccess, organizationName, visibleOrganizations } from '../store.js';
import { mathText } from '../math.js';
import { questionImageHTML, optionImageHTML } from '../questionMedia.js';
import { cloudUploadQuestionImage } from '../cloud.js';
import { navigate } from '../router.js';
import { teacherShell, mountTeacherShell } from './teacher.js';

let draft = null;

function defaultOptions() {
  return [
    { id: 'A', text: '', image: '', imagePath: '' },
    { id: 'B', text: '', image: '', imagePath: '' },
    { id: 'C', text: '', image: '', imagePath: '' },
    { id: 'D', text: '', image: '', imagePath: '' }
  ];
}

function toDateTimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function blankQuestion(type = 'mcq') {
  return {
    id: uid('q'),
    type,
    text: '',
    points: type === 'essay' ? 3 : 1,
    options: defaultOptions(),
    correct: type === 'truefalse' ? 'true' : 'A',
    acceptedAnswers: '',
    reference: '',
    image: '',
    imagePath: ''
  };
}

export function createExamDraft() {
  return {
    examId: null,
    status: 'draft',
    orgId: '',
    orgIds: [],
    title: '',
    subject: 'คณิตศาสตร์',
    level: '',
    description: '',
    instructions: 'ทำข้อสอบให้ครบทุกข้อ ห้ามเปิดแท็บอื่นระหว่างสอบ เมื่อหมดเวลาระบบจะส่งคำตอบให้อัตโนมัติ',
    duration: 30,
    passPercent: 60,
    shareMode: 'view',
    openAt: toDateTimeLocal(new Date(Date.now() + 5 * 60_000)),
    closeAt: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60_000)),
    assignedStudentIds: [],
    questions: [blankQuestion('mcq')]
  };
}

function examToDraft(exam) {
  const db = getDB();
  const examOrgIds = examOrganizationIds(exam, db);
  const orgStudentIds = new Set(db.students.filter(st => examOrgIds.includes(st.orgId)).map(st => st.id));
  const assigned = Array.isArray(exam.assignedStudentIds)
    ? exam.assignedStudentIds.filter(id => orgStudentIds.has(id))
    : [...orgStudentIds];
  return {
    examId: exam.id,
    status: exam.status,
    orgId: examOrgIds[0] || '',
    orgIds: examOrgIds,
    title: exam.title || '',
    subject: 'คณิตศาสตร์',
    level: exam.level || '',
    openAt: toDateTimeLocal(exam.openAt),
    closeAt: toDateTimeLocal(exam.closeAt),
    description: exam.description || exam.topic || '',
    instructions: exam.instructions || '',
    duration: Number(exam.duration) || 30,
    passPercent: Number(exam.passPercent) || 60,
    shareMode: exam.shareMode === 'edit' ? 'edit' : 'view',
    assignedStudentIds: assigned,
    questions: (exam.questions || []).map(q => ({
      ...q,
      id: q.id || uid('q'),
      text: q.text || '',
      options: q.type === 'mcq'
        ? defaultOptions().map((fallback, idx) => ({ ...fallback, ...(q.options?.[idx] || {}), id: fallback.id }))
        : defaultOptions(),
      correct: q.type === 'truefalse' ? String(q.correct ?? 'true') : (q.correct || 'A'),
      acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers.join(', ') : (q.acceptedAnswers || ''),
      reference: q.reference || q.explanation || '',
      image: q.image || '',
      imagePath: q.imagePath || ''
    }))
  };
}

function questionEditor(q, index, total) {
  const typeOptions = [
    ['mcq', 'ปรนัย'],
    ['truefalse', 'ถูก / ผิด'],
    ['short', 'เติมคำ'],
    ['essay', 'อัตนัย']
  ];
  let body = '';
  if (q.type === 'mcq') {
    body = `<div class="qb-answer-label">${icon('check-circle', 11)} เลือกวงกลมหน้าตัวเลือกที่ถูกต้อง</div>
      <div class="qb-options">
        ${q.options.map(opt => `<div class="qb-option ${opt.image ? 'qb-option--has-image' : ''}">
          <input type="radio" name="correct-${q.id}" value="${opt.id}" ${q.correct === opt.id ? 'checked' : ''} aria-label="ตัวเลือก ${opt.id} เป็นคำตอบที่ถูก">
          <span class="qb-option__key">${opt.id}</span>
          <div class="qb-option__body">
            <input type="text" value="${e(opt.text)}" placeholder="ข้อความตัวเลือก ${opt.id} — ใช้ $...$ ได้" data-option-text="${opt.id}" aria-label="ข้อความตัวเลือก ${opt.id}">
            ${opt.image ? `<div class="qb-option__image">
              <img src="${e(opt.image)}" alt="ภาพประกอบตัวเลือก ${opt.id}" loading="lazy">
              <button class="btn btn--danger-ghost btn--sm" type="button" data-remove-option-image="${q.id}" data-option-id="${opt.id}">${icon('trash', 11)} ลบภาพ</button>
            </div>` : ''}
            <label class="qb-option__upload">
              <input type="file" accept="image/png,image/jpeg,image/webp" data-q-option-image-input="${q.id}" data-option-id="${opt.id}">
              ${icon('image', 12)}
              <span data-option-image-status>${opt.image ? 'เปลี่ยนภาพตัวเลือก' : 'ใส่ภาพในตัวเลือกนี้'}</span>
            </label>
          </div>
        </div>`).join('')}
      </div>
      <div class="qb-helper">${icon('info', 11)} ตัวเลือกใส่รูปได้ทั้งข้อความและภาพ หรือเป็นภาพอย่างเดียวก็ได้ · ใช้ PNG, JPG หรือ WebP</div>`;
  } else if (q.type === 'truefalse') {
    body = `<div class="qb-answer-label">${icon('check-circle', 11)} เลือกคำตอบที่ถูกต้อง</div>
      <div class="qb-tf">
        <label><input type="radio" name="tf-${q.id}" value="true" ${q.correct === 'true' ? 'checked' : ''}> ถูกต้อง</label>
        <label><input type="radio" name="tf-${q.id}" value="false" ${q.correct === 'false' ? 'checked' : ''}> ไม่ถูกต้อง</label>
      </div>`;
  } else if (q.type === 'short') {
    body = `<div class="field"><label>คำตอบที่ยอมรับ (คั่นด้วยเครื่องหมายจุลภาค)</label><input class="input" type="text" value="${e(q.acceptedAnswers)}" placeholder="เช่น 14, x=14" data-accepted></div>
      <div class="qb-helper">ระบบจะตรวจคำตอบแบบไม่สนใจช่องว่างและตัวพิมพ์เล็ก–ใหญ่</div>`;
  } else {
    body = `<div class="field"><label>แนวคำตอบ / เกณฑ์การให้คะแนน</label><textarea class="textarea" placeholder="อธิบายแนวคำตอบที่คาดหวัง" data-reference>${e(q.reference)}</textarea></div>
      <div class="qb-helper">ข้ออัตนัยจะไม่ถูกตรวจอัตโนมัติ ครูสามารถให้คะแนนภายหลังได้</div>`;
  }
  return `<div class="question-builder" data-question-builder="${q.id}">
    <div class="question-builder__head">
      <span class="qb-index">${index + 1}</span>
      <select class="select" data-q-type="${q.id}" aria-label="ประเภทข้อ ${index + 1}">
        ${typeOptions.map(([value, label]) => `<option value="${value}" ${q.type === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <label class="qb-points">คะแนน <input type="number" min="0.5" max="20" step="0.5" value="${q.points}" data-q-points aria-label="คะแนนข้อ ${index + 1}"></label>
      <button class="qb-remove" type="button" data-remove-question="${q.id}" aria-label="ลบข้อ ${index + 1}" ${total <= 1 ? 'disabled' : ''}>${icon('trash', 14)}</button>
    </div>
    <div class="question-builder__body">
      <div class="field">
        <div class="field__label-row"><label>โจทย์ / คำถาม</label><span class="math-badge">LaTeX</span></div>
        <textarea class="textarea" placeholder="พิมพ์คำถามข้อ ${index + 1}... เช่น จงแก้สมการ $x^2 - 5x + 6 = 0$" data-q-text>${e(q.text)}</textarea>
      </div>
      <div class="qb-media" data-q-media>
        <div class="field__label-row"><label>ภาพประกอบโจทย์ <span class="muted">(ไม่บังคับ)</span></label><span class="qb-media__format">PNG · JPG · WebP</span></div>
        ${q.image ? `<div class="qb-image-preview">
          <img src="${e(q.image)}" alt="ภาพประกอบโจทย์ข้อ ${index + 1}" loading="lazy">
          <button class="btn btn--danger-ghost btn--sm" type="button" data-remove-q-image="${q.id}">${icon('trash', 12)} ลบรูป</button>
        </div>` : ''}
        <label class="qb-image-upload">
          <input type="file" accept="image/png,image/jpeg,image/webp" data-q-image-input="${q.id}">
          ${icon('image', 15)}
          <span>${q.image ? 'เปลี่ยนรูปภาพ' : 'อัปโหลดรูปภาพประกอบ'}</span>
          <small data-image-status>${q.image ? 'อัปโหลดใหม่เพื่อแทนที่รูปเดิม' : 'ขนาดไม่เกิน 5 MB · ระบบย่อขนาดให้อัตโนมัติ'}</small>
        </label>
        <div class="qb-helper">${icon('info', 11)} ใช้ภาพจาก TikZ ได้โดย export เป็น PNG แล้วอัปโหลด · ระบบแสดงผลภาพในโจทย์ ตัวอย่างข้อสอบ และหน้าตรวจ</div>
      </div>
      ${body}
    </div>
  </div>`;
}

function activeQuestion() {
  if (!draft?.questions?.length) return null;
  return draft.questions.find(q => q.id === draft.activeQuestionId) || draft.questions[0];
}

function questionNavHTML() {
  const current = activeQuestion();
  return `<div class="question-nav" role="tablist" aria-label="เลือกข้อที่ต้องการแก้ไข">
    <span class="question-nav__label">ข้อ</span>
    ${draft.questions.map((q, i) => `<button type="button" role="tab" class="question-nav__item ${q.id === current?.id ? 'is-active' : ''}" data-jump-question="${q.id}" aria-selected="${q.id === current?.id}">${i + 1}</button>`).join('')}
  </div>
  <div class="question-nav__hint">${icon('edit', 11)} กำลังแก้ข้อ ${draft.questions.findIndex(q => q.id === current?.id) + 1} จาก ${draft.questions.length} · เลือกหมายเลขเพื่อสลับข้อ</div>`;
}

function questionsHTML() {
  const q = activeQuestion();
  if (!q) return '';
  const index = draft.questions.findIndex(item => item.id === q.id);
  return `${questionNavHTML()}${questionEditor(q, index, draft.questions.length)}`;
}

function renderQuestions(root) {
  const box = root.querySelector('[data-questions]');
  if (!box) return;
  const q = activeQuestion();
  draft.activeQuestionId = q?.id || '';
  box.innerHTML = questionsHTML();
  root.dataset.previewQuestion = q?.id || '';
  updatePreview(root);
}

function participantStudents(session, db, orgIds = []) {
  const wanted = new Set((orgIds || []).filter(Boolean));
  if (!wanted.size) return [];
  return visibleStudents(session, db, 'all').filter(student => wanted.has(student.orgId));
}

function participantSection(db, session, orgIds = draft.orgIds || []) {
  const selected = new Set(draft.assignedStudentIds);
  const students = participantStudents(session, db, orgIds);
  const classes = (db.classes || []).filter(cls => students.some(student => classIdsOf(student).includes(cls.id)));
  const orgLabels = [...new Set(students.map(student => student.orgId))]
    .map(id => organizationName(id, db))
    .join(' · ');
  if (!students.length) {
    return `<div class="participant-empty">${icon('users', 19)}<div><strong>ยังไม่มีนักเรียนในหน่วยงานที่เลือก</strong><span>เลือกหน่วยงานด้านบน หรือเพิ่มนักเรียนในหน่วยงานนั้นก่อนเปิดห้องสอบ</span></div><a class="btn btn--ghost btn--sm" href="#/teacher/students">ไปที่ทะเบียนนักเรียน</a></div>`;
  }
  const classFilter = classes.map(cls => {
    const count = students.filter(student => classIdsOf(student).includes(cls.id)).length;
    const org = findOrganization(cls.orgId, db);
    return `<option value="${e(cls.id)}">${e(org?.shortName || '')} · ${e(cls.code)} (${count} คน)</option>`;
  }).join('');
  return `<div class="participant-toolbar">
      <div class="participant-count"><strong data-participant-count>${selected.size}</strong> คน <span>จาก ${students.length} คน · ${classes.length} class${orgLabels ? ` · ${e(orgLabels)}` : ''}</span></div>
      <div class="participant-toolbar__actions">
        <select class="select participant-filter" data-participant-filter aria-label="กรองรายชื่อตาม class">
          <option value="all">ทุก class</option>
          ${classFilter}
        </select>
        <button class="btn btn--link" type="button" data-select-all>เลือกที่แสดง</button>
        <span class="dot"></span>
        <button class="btn btn--link" type="button" data-clear-participants>ล้างที่แสดง</button>
      </div>
    </div>
    <div class="participant-students participant-students--flat">
      ${students.map(student => {
        const ids = classIdsOf(student);
        const codes = classCodesOf(student, db);
        const org = findOrganization(student.orgId, db);
        return `<label class="participant-student" data-participant-row data-participant-classes="${e(ids.join(' '))}">
          <input type="checkbox" data-participant="${e(student.id)}" ${selected.has(student.id) ? 'checked' : ''}>
          <span class="participant-student__copy"><strong>${e(student.name)}</strong><small>${e(student.code)}</small></span>
          <span class="participant-student__chips"><span class="class-chip class-chip--org">${e(org?.shortName || '—')}</span>${codes.length ? codes.map(code => `<span class="class-chip">${e(code)}</span>`).join('') : `<span class="class-chip class-chip--empty">ไม่ระบุ</span>`}</span>
        </label>`;
      }).join('')}
    </div>`;
}

function applyParticipantFilter(root) {
  const filter = root.querySelector('[data-participant-filter]')?.value || 'all';
  root.querySelectorAll('[data-participant-row]').forEach(row => {
    const show = filter === 'all' || (row.dataset.participantClasses || '').split(' ').includes(filter);
    row.classList.toggle('hidden', !show);
  });
}

function summaryHTML(draftData, sourceExam) {
  const total = draftData.questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const statusLabel = sourceExam
    ? (sourceExam.status === 'open' ? 'เปิดสอบอยู่' : sourceExam.status === 'announced' ? 'ประกาศผลแล้ว' : sourceExam.status === 'closed' ? 'ปิดรับคำตอบ' : sourceExam.status === 'saved' ? 'บันทึกแล้ว' : 'ฉบับร่าง')
    : 'ฉบับร่าง';
  return `<div class="create-summary__line"><span>หน่วยงาน</span><strong>${e(examOrganizationName({ orgIds: draftData.orgIds || [draftData.orgId] }, getDB()))}</strong></div>
    <div class="create-summary__line"><span>จำนวนข้อ</span><strong>${draftData.questions.length} ข้อ</strong></div>
    <div class="create-summary__line"><span>คะแนนรวม</span><strong>${total} คะแนน</strong></div>
    <div class="create-summary__line"><span>เวลาทำ</span><strong>${draftData.duration} นาที</strong></div>
    <div class="create-summary__line"><span>เกณฑ์ผ่าน</span><strong>${draftData.passPercent}%</strong></div>
    <div class="create-summary__line"><span>ผู้เข้าสอบ</span><strong>${draftData.assignedStudentIds.length} คน</strong></div>
    <div class="create-summary__line"><span>สิทธิ์ครูอื่น</span><strong>${draftData.shareMode === 'edit' ? 'แก้ไขได้' : 'ดูอย่างเดียว'}</strong></div>
    <div class="create-summary__line"><span>สถานะ</span><strong>${statusLabel}</strong></div>
    <div class="create-summary__total"><span>รวมทั้งสิ้น</span><strong>${total} คะแนน</strong></div>`;
}

function syncDraft(root) {
  if (!draft) return;
  const field = name => root.querySelector(`[data-field="${name}"]`)?.value ?? '';
  draft.title = field('title').trim();
  draft.subject = 'คณิตศาสตร์';
  draft.level = field('level');
  draft.openAt = field('openAt');
  draft.closeAt = field('closeAt');
  draft.description = field('description').trim();
  draft.instructions = field('instructions').trim();
  draft.duration = Number(field('duration')) || 30;
  draft.passPercent = Number(field('passPercent')) || 60;
  draft.shareMode = field('shareMode') === 'edit' ? 'edit' : 'view';
  const orgBoxes = [...root.querySelectorAll('[data-exam-org]')];
  if (orgBoxes.length) {
    const ids = orgBoxes.filter(box => box.checked).map(box => box.dataset.examOrg).filter(Boolean);
    draft.orgIds = [...new Set(ids)];
    draft.orgId = draft.orgIds[0] || '';
  }
  draft.assignedStudentIds = [...root.querySelectorAll('[data-participant]:checked')].map(cb => cb.dataset.participant);
  const card = root.querySelector('[data-question-builder]');
  if (!card) return;
  const id = card.dataset.questionBuilder;
  const index = draft.questions.findIndex(q => q.id === id);
  if (index < 0) return;
  const old = draft.questions[index];
  const type = card.querySelector('[data-q-type]')?.value || old.type;
  const q = {
    ...old,
    id,
    type,
    text: card.querySelector('[data-q-text]')?.value.trim() || '',
    points: Number(card.querySelector('[data-q-points]')?.value) || 1
  };
  if (type === 'mcq') {
    q.options = old.options?.length === 4 ? old.options : defaultOptions();
    q.options = q.options.map((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const input = card.querySelector(`[data-option-text="${letter}"]`);
      return {
        id: letter,
        text: input ? input.value.trim() : opt.text,
        image: opt.image || '',
        imagePath: opt.imagePath || ''
      };
    });
    q.correct = card.querySelector(`input[name="correct-${id}"]:checked`)?.value || old.correct || 'A';
    if (!['A', 'B', 'C', 'D'].includes(q.correct)) q.correct = 'A';
  } else if (type === 'truefalse') {
    q.correct = card.querySelector(`input[name="tf-${id}"]:checked`)?.value || old.correct || 'true';
  } else if (type === 'short') {
    q.acceptedAnswers = card.querySelector('[data-accepted]')?.value.trim() || '';
  } else if (type === 'essay') {
    q.reference = card.querySelector('[data-reference]')?.value.trim() || '';
  }
  draft.questions[index] = q;
}

function updateSummary(root) {
  const box = root.querySelector('[data-create-summary]');
  if (box) box.innerHTML = summaryHTML(draft, draft.examId ? findExam(draft.examId) : null);
  const count = root.querySelector('[data-participant-count]');
  if (count) count.textContent = draft.assignedStudentIds.length;
}

function updateParticipantState(root) {
  const count = root.querySelector('[data-participant-count]');
  if (count) count.textContent = draft.assignedStudentIds.length;
}

function previewHTML(question, index) {
  if (!question) return `<div class="live-preview__empty">${icon('edit', 18)}<span>เลือกข้อสอบเพื่อดูตัวอย่าง</span></div>`;
  const text = question.text.trim() ? mathText(question.text) : question.image ? '' : '<span class="muted">พิมพ์โจทย์หรือแนบภาพเพื่อดูตัวอย่าง</span>';
  let body = '';
  if (question.type === 'mcq') {
    body = `<div class="live-preview__options">${question.options.map(opt => `<div class="live-preview__option ${question.correct === opt.id ? 'is-correct' : ''}">
      <span>${opt.id}</span><div>${opt.text.trim() ? mathText(opt.text) : opt.image ? '' : '<span class="muted">ตัวเลือกว่าง</span>'}${optionImageHTML(opt, 'live-preview__option-image')}</div>${question.correct === opt.id ? icon('check', 12) : ''}
    </div>`).join('')}</div>`;
  } else if (question.type === 'truefalse') {
    body = `<div class="live-preview__options">
      <div class="live-preview__option ${question.correct === 'true' ? 'is-correct' : ''}"><span>✓</span><div>ถูกต้อง</div></div>
      <div class="live-preview__option ${question.correct === 'false' ? 'is-correct' : ''}"><span>✕</span><div>ไม่ถูกต้อง</div></div>
    </div>`;
  } else if (question.type === 'short') {
    body = `<div class="live-preview__answer"><span>คำตอบที่ยอมรับ</span><strong>${question.acceptedAnswers.trim() ? mathText(question.acceptedAnswers) : '—'}</strong></div>`;
  } else {
    body = `<div class="live-preview__answer"><span>แนวคำตอบ</span><strong>${question.reference.trim() ? mathText(question.reference) : '—'}</strong></div>`;
  }
  return `<div class="live-preview__meta">ข้อ ${index + 1} · ${question.points} คะแนน</div>
    <div class="live-preview__question">${text}</div>
    ${questionImageHTML(question, 'live-preview__image')}
    ${body}`;
}

function updatePreview(root) {
  const box = root.querySelector('[data-live-preview]');
  if (!box) return;
  const id = root.dataset.previewQuestion || draft.questions[0]?.id;
  const index = draft.questions.findIndex(q => q.id === id);
  box.innerHTML = previewHTML(index >= 0 ? draft.questions[index] : draft.questions[0], Math.max(0, index));
}

function showValidation(root, errors) {
  const box = root.querySelector('[data-validation]');
  if (!box) return;
  if (!errors.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = `<strong>${icon('alert-triangle', 12)} กรุณาตรวจสอบข้อมูล</strong><ul>${errors.map(err => `<li>${e(err)}</li>`).join('')}</ul>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function validateDraft(session) {
  const errors = [];
  const orgIds = (draft.orgIds || []).filter(id => findOrganization(id, getDB()));
  if (!orgIds.length) errors.push('กรุณาเลือกหน่วยงานที่ทำข้อสอบอย่างน้อย 1 แห่ง');
  if (orgIds.length !== (draft.orgIds || []).length) errors.push('มีหน่วยงานที่เลือกไว้ไม่พบในระบบ กรุณาเลือกใหม่');
  if (draft.title.trim().length < 3) errors.push('กรุณากรอกชื่อชุดสอบอย่างน้อย 3 ตัวอักษร');
  if (!draft.subject) errors.push('กรุณาเลือกวิชา');
  if (draft.duration < 1 || draft.duration > 180) errors.push('เวลาทำข้อสอบต้องอยู่ระหว่าง 1–180 นาที');
  if (draft.passPercent < 1 || draft.passPercent > 100) errors.push('เกณฑ์ผ่านต้องอยู่ระหว่าง 1–100%');
  const start = new Date(draft.openAt);
  const end = new Date(draft.closeAt);
  if (!draft.openAt || Number.isNaN(start.getTime())) errors.push('กรุณากำหนดวันและเวลาเริ่มสอบ');
  if (!draft.closeAt || Number.isNaN(end.getTime())) errors.push('กรุณากำหนดวันและเวลาปิดรับ');
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() <= start.getTime()) errors.push('วันและเวลาปิดรับต้องอยู่หลังวันเวลาเริ่มสอบ');
  if (!draft.assignedStudentIds.length) errors.push('เลือกผู้เข้าสอบอย่างน้อย 1 คน');
  const allowedStudents = new Set(participantStudents(session, getDB(), orgIds).map(student => student.id));
  if (draft.assignedStudentIds.some(id => !allowedStudents.has(id))) errors.push('ผู้เข้าสอบต้องเป็นนักเรียนในหน่วยงานที่เลือก');
  if (!draft.questions.length) errors.push('ต้องมีคำถามอย่างน้อย 1 ข้อ');
  draft.questions.forEach((q, i) => {
    if (!q.text.trim() && !q.image) errors.push(`ข้อ ${i + 1}: ยังไม่ได้กรอกโจทย์หรือแนบภาพ`);
    if (!q.points || q.points <= 0) errors.push(`ข้อ ${i + 1}: คะแนนต้องมากกว่า 0`);
    if (q.type === 'mcq' && q.options.some(o => !o.text.trim() && !o.image)) errors.push(`ข้อ ${i + 1}: กรอกข้อความหรือใส่ภาพให้ครบทั้ง 4 ตัวเลือก`);
    if (q.type === 'short' && !q.acceptedAnswers.trim()) errors.push(`ข้อ ${i + 1}: กรุณากำหนดคำตอบที่ยอมรับอย่างน้อย 1 คำตอบ`);
  });
  return errors;
}

function uniqueCode(db) {
  let code;
  do { code = String(Math.floor(100000 + Math.random() * 900000)); } while (db.exams.some(exam => exam.code === code));
  return code;
}

function serializeQuestions() {
  return draft.questions.map(q => {
    const accepted = q.type === 'short'
      ? q.acceptedAnswers.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    return {
      id: q.id || uid('q'),
      type: q.type,
      text: q.text.trim(),
      points: Number(q.points),
      options: q.type === 'mcq' ? q.options.map(option => ({ id: option.id, text: option.text.trim(), image: String(option.image || '').trim(), imagePath: String(option.imagePath || '').trim() })) : undefined,
      correct: q.type === 'short' ? (accepted[0] || '') : q.correct,
      acceptedAnswers: accepted,
      reference: q.type === 'essay' ? q.reference.trim() : undefined,
      explanation: q.type === 'essay' ? q.reference.trim() : '',
      image: String(q.image || '').trim(),
      imagePath: String(q.imagePath || '').trim()
    };
  });
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_INPUT = 12 * 1024 * 1024;

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดไฟล์รูปภาพไม่ได้')); };
    img.src = url;
  });
}

async function prepareQuestionImage(file) {
  if (!IMAGE_TYPES.has(file.type)) throw new Error('รองรับเฉพาะ PNG, JPG หรือ WebP');
  if (file.size > MAX_IMAGE_INPUT) throw new Error('รูปต้นฉบับต้องมีขนาดไม่เกิน 12 MB');
  const img = await loadImageFile(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  if (scale === 1 && file.size <= 1.2 * 1024 * 1024) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const toBlob = type => new Promise(resolve => canvas.toBlob(resolve, type, 0.86));
  let blob = await toBlob('image/webp');
  if (!blob) blob = await toBlob('image/jpeg');
  if (!blob) throw new Error('ย่อขนาดรูปภาพไม่สำเร็จ');
  if (blob.size > 5 * 1024 * 1024) throw new Error('รูปหลังย่อขนาดใหญ่เกิน 5 MB');
  return blob;
}

async function handleQuestionImage(root, input) {
  const file = input.files?.[0];
  if (!file) return;
  const card = input.closest('[data-question-builder]');
  const id = card?.dataset.questionBuilder;
  if (!id) return;
  syncDraft(root);
  const question = draft.questions.find(q => q.id === id);
  if (!question) return;
  const status = card.querySelector('[data-image-status]');
  const label = input.closest('.qb-image-upload');
  input.disabled = true;
  label?.classList.add('is-uploading');
  if (status) status.textContent = 'กำลังย่อและอัปโหลดรูป...';
  try {
    const prepared = await prepareQuestionImage(file);
    const uploaded = await cloudUploadQuestionImage(prepared);
    if (!uploaded.ok) throw new Error(uploaded.error || 'อัปโหลดรูปไม่สำเร็จ');
    question.image = uploaded.url;
    question.imagePath = uploaded.path;
    draft.activeQuestionId = question.id;
    renderQuestions(root);
    updateSummary(root);
    toast('เพิ่มภาพประกอบโจทย์แล้ว', 'success');
  } catch (err) {
    if (status) status.textContent = err?.message || 'อัปโหลดรูปไม่สำเร็จ';
    input.disabled = false;
    input.value = '';
    label?.classList.remove('is-uploading');
    toast(err?.message || 'อัปโหลดรูปไม่สำเร็จ', 'error', 6000);
  }
}

async function handleOptionImage(root, input) {
  const file = input.files?.[0];
  if (!file) return;
  const card = input.closest('[data-question-builder]');
  const questionId = card?.dataset.questionBuilder;
  const optionId = input.dataset.optionId;
  if (!questionId || !optionId) return;
  syncDraft(root);
  const question = draft.questions.find(q => q.id === questionId);
  const option = question?.options?.find(opt => opt.id === optionId);
  if (!option) return;
  const status = input.closest('.qb-option__upload')?.querySelector('[data-option-image-status]');
  const label = input.closest('.qb-option__upload');
  input.disabled = true;
  label?.classList.add('is-uploading');
  if (status) status.textContent = 'กำลังย่อและอัปโหลด...';
  try {
    const prepared = await prepareQuestionImage(file);
    const uploaded = await cloudUploadQuestionImage(prepared);
    if (!uploaded.ok) throw new Error(uploaded.error || 'อัปโหลดรูปไม่สำเร็จ');
    option.image = uploaded.url;
    option.imagePath = uploaded.path;
    draft.activeQuestionId = question.id;
    renderQuestions(root);
    updateSummary(root);
    toast('เพิ่มภาพในตัวเลือกแล้ว', 'success');
  } catch (err) {
    if (status) status.textContent = err?.message || 'อัปโหลดรูปไม่สำเร็จ';
    input.disabled = false;
    input.value = '';
    label?.classList.remove('is-uploading');
    toast(err?.message || 'อัปโหลดรูปไม่สำเร็จ', 'error', 6000);
  }
}

function sampleDraft() {
  draft.title = 'คณิตศาสตร์ – แบบทดสอบหลังเรียน';
  draft.description = 'ทบทวนความเข้าใจเรื่องสมการและการแก้ปัญหา';
  draft.questions = [
    { ...blankQuestion('mcq'), text: 'จงหาค่าของ $2 + 3 \\times 4$', points: 1, correct: 'B', options: [{ id: 'A', text: '$10$' }, { id: 'B', text: '$14$' }, { id: 'C', text: '$20$' }, { id: 'D', text: '$24$' }] },
    { ...blankQuestion('truefalse'), text: '$x = 3$ ทำให้ $x^2 - 9 = 0$ เป็นจริง', points: 1, correct: 'true' },
    { ...blankQuestion('essay'), text: 'จงอธิบายวิธีแก้สมการ $x^2 - 5x + 6 = 0$', points: 3, reference: 'แยกตัวประกอบเป็น $(x - 2)(x - 3) = 0$ จะได้ $x = 2$ หรือ $x = 3$' }
  ];
}

export function createExamView(ctx) {
  const { session } = ctx;
  const db = getDB();
  const teacher = currentTeacher(session);
  const allowedOrgs = visibleOrganizations(session, db);
  const isEdit = Boolean(ctx.examId);
  const sourceExam = isEdit ? findExam(ctx.examId) : null;

  if (isEdit && !sourceExam) {
    return {
      html: teacherShell(session, {
        active: 'exams',
        crumb: 'ไม่พบชุดสอบ',
        content: `<div class="teacher-card">${emptyState({ iconName: 'file-text', title: 'ไม่พบชุดสอบ', text: 'ชุดสอบนี้อาจถูกลบหรือลิงก์ไม่ถูกต้อง', action: '<a class="btn btn--primary" href="#/teacher/exams">กลับชุดสอบทั้งหมด</a>' })}</div>`
      }),
      mount: () => mountTeacherShell(session)
    };
  }
  if (isEdit && (!canViewExam(sourceExam, session) || !canEditExam(sourceExam, session))) {
    return {
      html: teacherShell(session, {
        active: 'exams',
        crumb: 'อ่านอย่างเดียว',
        content: `<div class="teacher-card">${emptyState({ iconName: 'lock', title: 'แก้ไขชุดสอบนี้ไม่ได้', text: 'ชุดสอบนี้ตั้งค่าให้ครูท่านอื่นดูได้อย่างเดียว เฉพาะเจ้าของชุดสอบและ Wich Pitchon ที่แก้ไขได้', action: `<a class="btn btn--primary" href="#/teacher/exam/${sourceExam.id}/overview">ดูข้อมูลชุดสอบ</a>` })}</div>`
      }),
      mount: () => mountTeacherShell(session)
    };
  }

  if (isEdit) {
    if (!draft || draft.examId !== sourceExam.id) draft = examToDraft(sourceExam);
  } else if (!draft || draft.examId) {
    draft = createExamDraft();
  }

  if (!Array.isArray(draft.orgIds) || !draft.orgIds.length) {
    draft.orgIds = [draft.orgId || teacher?.orgId || allowedOrgs[0]?.id].filter(Boolean);
  }
  const globalAccess = hasAllOrganizationAccess(session);
  if (!globalAccess) {
    draft.orgIds = [teacher?.orgId || allowedOrgs[0]?.id].filter(Boolean);
  }
  draft.orgIds = [...new Set(draft.orgIds.filter(id => allowedOrgs.some(org => org.id === id)))];
  draft.orgId = draft.orgIds[0] || '';

  if (!draft.questions.some(q => q.id === draft.activeQuestionId)) {
    draft.activeQuestionId = draft.questions[0]?.id || '';
  }

  const backHref = isEdit ? `#/teacher/exam/${sourceExam.id}/overview` : '#/teacher/exams';
  const hasAttempts = isEdit && db.attempts.some(attempt => attempt.examId === sourceExam.id);
  const allOrgs = allowedOrgs;
  const selectedOrgs = draft.orgIds.map(id => findOrganization(id, db)).filter(Boolean);
  const orgField = globalAccess && !hasAttempts
    ? `<div class="field">
        <label>หน่วยงาน / โรงเรียนที่ทำข้อสอบ <span style="color:var(--coral)">*</span></label>
        <div class="org-picker" data-org-picker>
          ${allOrgs.map(org => `<label class="org-picker__item ${draft.orgIds.includes(org.id) ? 'is-selected' : ''}">
            <input type="checkbox" value="${e(org.id)}" data-exam-org="${e(org.id)}" ${draft.orgIds.includes(org.id) ? 'checked' : ''}>
            <span class="org-picker__icon">${icon(org.type === 'school' ? 'school' : 'layout-dashboard', 15)}</span>
            <span class="org-picker__copy"><strong>${e(org.name)}</strong><small>${e(org.shortName)} · ${org.accessLevel === 'manage_all' ? 'หน่วยงานหลัก' : org.accessLevel === 'view_all' ? 'เห็นทุกหน่วยงาน' : 'เห็นเฉพาะหน่วยงาน'}</small></span>
            <span class="org-picker__check">${icon('check', 12)}</span>
          </label>`).join('')}
        </div>
        <div class="org-picker__actions">
          <button class="btn btn--link" type="button" data-select-all-orgs>เลือกทุกหน่วยงาน</button>
          <span class="dot"></span>
          <button class="btn btn--link" type="button" data-clear-orgs>ล้างที่เลือก</button>
        </div>
        <p class="field__hint">${icon('building-2', 12)} เลือกได้มากกว่า 1 หน่วยงาน · นักเรียนในทุกหน่วยงานที่เลือกจะเห็นชุดสอบนี้ · ครูในหน่วยงานที่เลือกเห็นชุดสอบได้</p>
      </div>`
    : `<div class="field">
        <label>หน่วยงาน / โรงเรียนที่ทำข้อสอบ</label>
        <div class="fixed-field">${icon('building-2', 15)}<strong>${e(selectedOrgs.map(org => org.name).join(' · ') || 'ไม่ระบุหน่วยงาน')}</strong><span>${e(selectedOrgs.map(org => org.shortName).join(' · '))}</span></div>
        <p class="field__hint">${icon('lock', 12)} ${hasAttempts ? 'ชุดสอบมีผู้เข้าสอบแล้ว จึงเปลี่ยนหน่วยงานไม่ได้' : 'ชุดสอบจะอยู่ภายใต้หน่วยงานของคุณ และครูต่างหน่วยงานจะมองไม่เห็น'}</p>
      </div>`;

  const content = `<div class="create-shell">
    <div class="create-head">
      <div>
        <a class="page-back" href="${backHref}" style="margin-bottom:8px">${icon('arrow-left', 15)} ${isEdit ? 'กลับภาพรวมชุดสอบ' : 'กลับชุดสอบทั้งหมด'}</a>
        <h1>${isEdit ? 'แก้ไขชุดสอบ' : 'สร้างชุดสอบใหม่'}</h1>
        <p>${isEdit ? 'ปรับคำถาม ผู้เข้าสอบ และรายละเอียด แล้วบันทึกการเปลี่ยนแปลงได้ทันที' : 'ออกแบบข้อสอบ กำหนดคำตอบที่ถูก และเปิดห้องสอบได้ในไม่กี่นาที'}</p>
      </div>
      <div class="teacher-page-head__actions">
        <button class="btn btn--ghost" type="button" data-fill-sample>${icon('sparkles', 15)} เติมตัวอย่าง</button>
      </div>
    </div>
    <div class="create-layout">
      <form class="create-form" id="create-exam-form" novalidate>
        <section class="form-card">
          <div class="form-card__head">
            <div><h2>ข้อมูลชุดสอบ</h2><p>ข้อมูลพื้นฐานที่นักเรียนจะเห็นก่อนเข้าสอบ</p></div>
            <span class="form-card__step">1</span>
          </div>
          <div class="form-stack">
            <div class="field"><label for="exam-title">ชื่อชุดสอบ <span style="color:var(--coral)">*</span></label><input class="input" id="exam-title" data-field="title" maxlength="90" placeholder="เช่น คณิตศาสตร์ – บทที่ 3" value="${e(draft.title)}"></div>
            ${orgField}
            <div class="form-grid">
              <div class="field"><label>วิชา</label><div class="fixed-field">${icon('book-open', 15)}<strong>คณิตศาสตร์</strong><span>กำหนดตายตัว</span></div><input type="hidden" data-field="subject" value="คณิตศาสตร์"></div>
              <div class="field"><label for="exam-level">ระดับ / กลุ่มผู้สอบ <span class="muted">(ไม่บังคับ)</span></label><input class="input" id="exam-level" data-field="level" maxlength="60" value="${e(draft.level)}" placeholder="เช่น CSCA รอบ 1 หรือเว้นว่าง"></div>
            </div>
            <div class="field"><label for="exam-desc">คำอธิบายสั้น ๆ</label><textarea class="textarea" id="exam-desc" data-field="description" maxlength="220" placeholder="อธิบายขอบเขตเนื้อหาของชุดสอบ">${e(draft.description)}</textarea></div>
            <div class="form-grid">
              <div class="field"><label for="exam-duration">เวลาทำ (นาที)</label><input class="input" id="exam-duration" type="number" min="1" max="180" data-field="duration" value="${draft.duration}"></div>
              <div class="field"><label for="exam-pass">เกณฑ์ผ่าน (%)</label><input class="input" id="exam-pass" type="number" min="1" max="100" data-field="passPercent" value="${draft.passPercent}"></div>
            </div>
            <div class="form-grid">
              <div class="field"><label for="exam-open-at">วันและเวลาเริ่มสอบ <span style="color:var(--coral)">*</span></label><input class="input" id="exam-open-at" type="datetime-local" data-field="openAt" value="${e(draft.openAt)}"></div>
              <div class="field"><label for="exam-close-at">วันและเวลาปิดรับ <span style="color:var(--coral)">*</span></label><input class="input" id="exam-close-at" type="datetime-local" data-field="closeAt" value="${e(draft.closeAt)}"></div>
            </div>
            <p class="field__hint" style="margin-top:-4px">${icon('info', 12)} นักเรียนจะเข้าสอบได้เฉพาะช่วงเวลานี้ · ระบบใช้เวลาท้องถิ่นของเครื่อง</p>
            <div class="field"><label for="exam-share-mode">สิทธิ์ของครูท่านอื่น</label>
              <select class="select" id="exam-share-mode" data-field="shareMode">
                <option value="view" ${draft.shareMode !== 'edit' ? 'selected' : ''}>ดูได้อย่างเดียว · ซ่อนสถิติจนปิดสอบ</option>
                <option value="edit" ${draft.shareMode === 'edit' ? 'selected' : ''}>แก้ไขชุดสอบได้</option>
              </select>
              <p class="field__hint">${icon('eye', 12)} ถ้าเลือกดูอย่างเดียว ครูท่านอื่นจะเห็นสถิติหลังปิดสอบแล้วเท่านั้น · Wich เห็นทุกอย่างเสมอ</p>
            </div>
          </div>
        </section>
        <section class="form-card">
          <div class="form-card__head">
            <div><h2>ผู้เข้าสอบ <span class="required-mark">*</span></h2><p>กรองตาม class หรือเลือกเป็นรายคน · นักเรียนที่อยู่หลาย class จะแสดงครั้งเดียว · เฉพาะคนที่เลือกจะเข้าสอบชุดนี้ได้</p></div>
            <span class="form-card__step">2</span>
          </div>
          <div data-participant-panel>${participantSection(db, session, draft.orgIds)}</div>
          <div class="qb-helper" style="margin-top:12px">${icon('shield-check', 11)} รายชื่อที่เลือกจะถูกใช้ตรวจสิทธิ์ทั้งการเข้าสอบด้วยรหัสและบัญชีนักเรียน · จำนวนที่เลือกนับเป็นรายคน</div>
        </section>
        <section class="form-card">
          <div class="form-card__head">
            <div><h2>คำชี้แจงและข้อตกลง</h2><p>ข้อความนี้จะแสดงในหน้าก่อนเริ่มสอบ</p></div>
            <span class="form-card__step">3</span>
          </div>
          <div class="field"><textarea class="textarea" data-field="instructions" style="min-height:92px" maxlength="500" placeholder="คำชี้แจงสำหรับนักเรียน">${e(draft.instructions)}</textarea></div>
        </section>
        <section class="form-card">
          <div class="form-card__head">
            <div><h2>คำถาม</h2><p>เพิ่มได้ทั้งปรนัย ถูก/ผิด เติมคำ และอัตนัย · รองรับสมการ LaTeX และภาพประกอบรายข้อ</p></div>
            <div class="form-card__head-tools"><span class="math-badge">$...$ / $$...$$</span><span class="form-card__step">4</span></div>
          </div>
          <div class="builder-questions" data-questions>${questionsHTML()}</div>
          <div class="builder-add-row">
            <span style="font-size:9.5px;color:var(--muted);margin-right:2px">เพิ่มข้อใหม่</span>
            <button class="btn btn--ghost" type="button" data-add-question="mcq">${icon('plus', 12)} ปรนัย</button>
            <button class="btn btn--ghost" type="button" data-add-question="truefalse">${icon('plus', 12)} ถูก / ผิด</button>
            <button class="btn btn--ghost" type="button" data-add-question="short">${icon('plus', 12)} เติมคำ</button>
            <button class="btn btn--ghost" type="button" data-add-question="essay">${icon('plus', 12)} อัตนัย</button>
          </div>
        </section>
        <div class="validation-box" data-validation hidden></div>
      </form>
      <aside class="create-side">
        <div class="create-summary card">
          <h3>สรุปชุดสอบ</h3>
          <div style="margin-top:9px" data-create-summary>${summaryHTML(draft, sourceExam)}</div>
          <div class="create-summary__actions">
            ${isEdit
              ? `<button class="btn btn--primary" type="button" data-save-exam="save">${icon('save', 14)} บันทึกการแก้ไข</button>
                 ${canManageExam(sourceExam, session) && sourceExam.status === 'draft' ? `<button class="btn btn--ghost" type="button" data-save-exam="saved">${icon('users', 14)} เผยแพร่ให้ครูเห็น</button>
                 <button class="btn btn--ghost" type="button" data-save-exam="open">${icon('play', 14)} เปิดสอบ</button>` : ''}
                 ${canManageExam(sourceExam, session) && sourceExam.status === 'saved' ? `<button class="btn btn--ghost" type="button" data-save-exam="open">${icon('play', 14)} เปิดสอบ</button>` : ''}`
              : `<button class="btn btn--primary" type="button" data-save-exam="saved">${icon('users', 14)} บันทึกให้ครูเห็น</button>
                 <button class="btn btn--ghost" type="button" data-save-exam="open">${icon('play', 14)} บันทึกและเปิดสอบ</button>
                 <button class="btn btn--ghost" type="button" data-save-exam="draft">${icon('lock', 14)} บันทึกฉบับร่าง</button>`}
          </div>
          <div class="create-note" style="margin-top:11px">${icon('shield-check', 12)} ${isEdit ? `แก้ไขชุดสอบรหัส ${sourceExam.code} โดยไม่เปลี่ยนรหัสหรือผลสอบเดิม · ฉบับร่างเห็นเฉพาะเจ้าของ ผู้จัดการหน่วยงาน และ Wich` : 'รหัสเข้าสอบ 6 หลักสร้างอัตโนมัติ · ฉบับร่างเห็นเฉพาะเจ้าของ ผู้จัดการหน่วยงาน และ Wich · เมื่อบันทึกให้ครูเห็น ครูในหน่วยงานเดียวกันจะเข้าดูข้อมูลได้'}</div>
          ${isEdit && canManageExam(sourceExam, session) ? `<button class="btn btn--danger-ghost btn--wide" type="button" data-delete-exam-editor style="margin-top:10px">${icon('trash', 13)} ลบชุดสอบนี้</button>` : ''}
        </div>
        <div class="create-summary card live-preview-card">
          <div class="live-preview-card__head"><h3>ตัวอย่างข้อสอบ</h3><span class="math-badge">LaTeX</span></div>
          <div class="live-preview" data-live-preview>${previewHTML(activeQuestion(), Math.max(0, draft.questions.findIndex(q => q.id === activeQuestion()?.id)))}</div>
          <div class="math-help">
            <strong>พิมพ์สมการในโจทย์และตัวเลือกได้</strong>
            <span><code>$x^2$</code> ในบรรทัด · <code>$$\\frac{a}{b}$$</code> แบบบล็อก</span>
            <span>TikZ ไม่ render โดยตรง — export เป็น PNG แล้วอัปโหลดในช่องภาพประกอบ</span>
          </div>
        </div>
        ${hasAttempts ? `<div class="create-note create-note--warn">${icon('alert-triangle', 12)} ชุดสอบนี้มีผู้เข้าสอบแล้ว การแก้โจทย์หรือคะแนนอาจกระทบผลสอบย้อนหลัง</div>` : ''}
        <div class="create-summary card">
          <h3>การตรวจและประกาศผล</h3>
          <div class="result-summary-line" style="font-size:9px"><span>ปรนัย / เติมคำ</span><strong>อัตโนมัติ</strong></div>
          <div class="result-summary-line" style="font-size:9px"><span>อัตนัย</span><strong>ครูตรวจ</strong></div>
          <div class="result-summary-line" style="font-size:9px"><span>การเห็นคะแนน</span><strong>หลังประกาศผล</strong></div>
          <div class="create-note" style="margin-top:10px">${icon('info', 12)} คุณสามารถแก้ไขการแสดงผลคะแนนและเฉลยได้ในหน้า “ประกาศผล”</div>
        </div>
      </aside>
    </div>
  </div>`;

  return {
    html: teacherShell(session, { active: 'exams', crumb: isEdit ? 'แก้ไขชุดสอบ' : 'สร้างชุดสอบใหม่', content }),
    mount() {
      mountTeacherShell(session);
      const root = document.querySelector('.create-shell');
      const form = document.getElementById('create-exam-form');
      root.dataset.previewQuestion = activeQuestion()?.id || '';

      const refresh = () => {
        syncDraft(root);
        updateSummary(root);
        updateParticipantState(root);
        updatePreview(root);
      };
      applyParticipantFilter(root);
      updateParticipantState(root);
      updatePreview(root);

      form.addEventListener('input', () => refresh());
      form.addEventListener('focusin', ev => {
        const card = ev.target.closest('[data-question-builder]');
        if (card) {
          root.dataset.previewQuestion = card.dataset.questionBuilder;
          updatePreview(root);
        }
      });
      form.addEventListener('change', async ev => {
        const optionImageInput = ev.target.closest('[data-q-option-image-input]');
        if (optionImageInput) {
          await handleOptionImage(root, optionImageInput);
          return;
        }
        const imageInput = ev.target.closest('[data-q-image-input]');
        if (imageInput) {
          await handleQuestionImage(root, imageInput);
          return;
        }
        const orgToggle = ev.target.closest('[data-exam-org]');
        if (orgToggle) {
          syncDraft(root);
          if (!draft.orgIds.length) {
            draft.orgIds = [orgToggle.dataset.examOrg];
            orgToggle.checked = true;
            toast('ต้องเลือกหน่วยงานอย่างน้อย 1 แห่ง', 'warning');
          }
          draft.orgId = draft.orgIds[0] || '';
          const allowed = new Set(participantStudents(session, db, draft.orgIds).map(student => student.id));
          draft.assignedStudentIds = draft.assignedStudentIds.filter(id => allowed.has(id));
          root.querySelectorAll('.org-picker__item').forEach(item => {
            const box = item.querySelector('[data-exam-org]');
            item.classList.toggle('is-selected', Boolean(box?.checked));
          });
          const panel = root.querySelector('[data-participant-panel]');
          if (panel) panel.innerHTML = participantSection(db, session, draft.orgIds);
          applyParticipantFilter(root);
          updateParticipantState(root);
          updateSummary(root);
          return;
        }
        const participantFilter = ev.target.closest('[data-participant-filter]');
        if (participantFilter) {
          applyParticipantFilter(root);
          return;
        }
        const participant = ev.target.closest('[data-participant]');
        if (participant) {
          refresh();
          return;
        }
        const typeSelect = ev.target.closest('[data-q-type]');
        if (!typeSelect) {
          refresh();
          return;
        }
        const id = typeSelect.dataset.qType;
        const old = draft.questions.find(q => q.id === id);
        if (!old) return;
        const newType = typeSelect.value;
        if (newType === 'mcq' && (!old.options || old.options.length !== 4)) old.options = defaultOptions();
        if (newType === 'truefalse' && !['true', 'false'].includes(old.correct)) old.correct = 'true';
        if (newType === 'short') old.acceptedAnswers = old.acceptedAnswers || '';
        if (newType === 'essay') old.reference = old.reference || '';
        old.type = newType;
        old.points = newType === 'essay' ? Math.max(2, old.points) : old.points;
        syncDraft(root);
        const target = draft.questions.find(q => q.id === id);
        if (target) target.type = newType;
        draft.activeQuestionId = id;
        renderQuestions(root);
        updateSummary(root);
      });
      form.addEventListener('click', ev => {
        const jump = ev.target.closest('[data-jump-question]');
        if (jump) {
          syncDraft(root);
          draft.activeQuestionId = jump.dataset.jumpQuestion;
          renderQuestions(root);
          root.querySelector('[data-questions]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        const selectAll = ev.target.closest('[data-select-all]');
        if (selectAll) {
          root.querySelectorAll('[data-participant-row]:not(.hidden) [data-participant]').forEach(box => { box.checked = true; });
          refresh();
          return;
        }
        const clear = ev.target.closest('[data-clear-participants]');
        if (clear) {
          root.querySelectorAll('[data-participant-row]:not(.hidden) [data-participant]').forEach(box => { box.checked = false; });
          refresh();
          return;
        }
        const selectAllOrgs = ev.target.closest('[data-select-all-orgs]');
        if (selectAllOrgs) {
          syncDraft(root);
          root.querySelectorAll('[data-exam-org]').forEach(box => { box.checked = true; });
          draft.orgIds = [...root.querySelectorAll('[data-exam-org]')].map(box => box.dataset.examOrg);
          draft.orgId = draft.orgIds[0] || '';
          const allowed = new Set(participantStudents(session, db, draft.orgIds).map(student => student.id));
          draft.assignedStudentIds = draft.assignedStudentIds.filter(id => allowed.has(id));
          root.querySelectorAll('.org-picker__item').forEach(item => item.classList.add('is-selected'));
          const panel = root.querySelector('[data-participant-panel]');
          if (panel) panel.innerHTML = participantSection(db, session, draft.orgIds);
          applyParticipantFilter(root);
          updateParticipantState(root);
          updateSummary(root);
          return;
        }
        const clearOrgs = ev.target.closest('[data-clear-orgs]');
        if (clearOrgs) {
          const first = root.querySelector('[data-exam-org]');
          syncDraft(root);
          root.querySelectorAll('[data-exam-org]').forEach(box => { box.checked = false; });
          if (first) first.checked = true;
          draft.orgIds = first ? [first.dataset.examOrg] : [];
          draft.orgId = draft.orgIds[0] || '';
          const allowed = new Set(participantStudents(session, db, draft.orgIds).map(student => student.id));
          draft.assignedStudentIds = draft.assignedStudentIds.filter(id => allowed.has(id));
          root.querySelectorAll('.org-picker__item').forEach(item => {
            const box = item.querySelector('[data-exam-org]');
            item.classList.toggle('is-selected', Boolean(box?.checked));
          });
          const panel = root.querySelector('[data-participant-panel]');
          if (panel) panel.innerHTML = participantSection(db, session, draft.orgIds);
          applyParticipantFilter(root);
          updateParticipantState(root);
          updateSummary(root);
          return;
        }
        const removeOptionImage = ev.target.closest('[data-remove-option-image]');
        if (removeOptionImage) {
          syncDraft(root);
          const question = draft.questions.find(q => q.id === removeOptionImage.dataset.removeOptionImage);
          const option = question?.options?.find(opt => opt.id === removeOptionImage.dataset.optionId);
          if (!option) return;
          option.image = '';
          option.imagePath = '';
          draft.activeQuestionId = question.id;
          renderQuestions(root);
          updateSummary(root);
          toast('ลบภาพตัวเลือกแล้ว', 'info');
          return;
        }
        const removeImage = ev.target.closest('[data-remove-q-image]');
        if (removeImage) {
          syncDraft(root);
          const imageQuestion = draft.questions.find(q => q.id === removeImage.dataset.removeQImage);
          if (!imageQuestion) return;
          imageQuestion.image = '';
          imageQuestion.imagePath = '';
          renderQuestions(root);
          updateSummary(root);
          toast('ลบภาพประกอบโจทย์แล้ว', 'info');
          return;
        }
        const add = ev.target.closest('[data-add-question]');
        if (add) {
          syncDraft(root);
          const q = blankQuestion(add.dataset.addQuestion);
          draft.questions.push(q);
          draft.activeQuestionId = q.id;
          renderQuestions(root);
          updateSummary(root);
          root.querySelector('[data-questions]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        const remove = ev.target.closest('[data-remove-question]');
        if (remove && draft.questions.length > 1) {
          syncDraft(root);
          const id = remove.dataset.removeQuestion;
          const removedIndex = draft.questions.findIndex(q => q.id === id);
          draft.questions = draft.questions.filter(q => q.id !== id);
          draft.activeQuestionId = draft.questions[Math.max(0, removedIndex - 1)]?.id || draft.questions[0]?.id || '';
          renderQuestions(root);
          updateSummary(root);
        }
      });

      root.querySelector('[data-fill-sample]')?.addEventListener('click', () => {
        syncDraft(root);
        sampleDraft();
        root.querySelector('[data-field="title"]').value = draft.title;
        root.querySelector('[data-field="description"]').value = draft.description;
        draft.activeQuestionId = draft.questions[0]?.id || '';
        renderQuestions(root);
        updateSummary(root);
        toast('เติมข้อมูลตัวอย่างแล้ว ปรับแก้ได้ตามต้องการ', 'info');
      });

      root.querySelector('[data-delete-exam-editor]')?.addEventListener('click', async () => {
        const attempts = db.attempts.filter(attempt => attempt.examId === sourceExam.id).length;
        const ok = await confirmDialog({
          title: 'ลบชุดสอบนี้?',
          message: `“${sourceExam.title}” จะถูกลบออกจากระบบ${attempts ? ` พร้อมคำตอบและผลสอบ ${attempts} รายการ` : ''} การลบนี้ย้อนกลับไม่ได้`,
          confirmLabel: 'ลบชุดสอบ',
          tone: 'danger',
          iconName: 'trash'
        });
        if (!ok) return;
        const result = deleteExam(sourceExam.id, session);
        if (!result.ok) { toast(result.error || 'ไม่สามารถลบชุดสอบได้', 'error'); return; }
        draft = null;
        toast(`ลบ “${result.title}” แล้ว`, 'success');
        navigate('/teacher/exams');
      });

      root.querySelectorAll('[data-save-exam]').forEach(btn => btn.addEventListener('click', () => {
        syncDraft(root);
        updateSummary(root);
        updatePreview(root);
        const errors = validateDraft(session);
        showValidation(root, errors);
        if (errors.length) {
          toast('กรุณาตรวจสอบข้อมูลชุดสอบก่อนบันทึก', 'error');
          return;
        }
        const mode = btn.dataset.saveExam;
        const now = new Date();
        const payload = {
          title: draft.title.trim(),
          shortTitle: draft.title.trim(),
          subject: 'คณิตศาสตร์',
          topic: draft.description.trim(),
          level: draft.level,
          description: draft.description.trim(),
          instructions: draft.instructions.trim(),
          duration: Number(draft.duration),
          passPercent: Number(draft.passPercent),
          shareMode: draft.shareMode === 'edit' ? 'edit' : 'view',
          orgId: draft.orgIds[0] || '',
          orgIds: [...new Set(draft.orgIds)],
          openAt: new Date(draft.openAt).toISOString(),
          closeAt: new Date(draft.closeAt).toISOString(),
          assignedStudentIds: [...new Set(draft.assignedStudentIds)],
          questions: serializeQuestions()
        };

        if (isEdit) {
          if (mode === 'open') {
            payload.status = 'open';
            payload.openedAt = now.toISOString();
          } else if (mode === 'saved') {
            payload.status = 'saved';
            payload.savedAt = now.toISOString();
          }
          const result = updateExam(sourceExam.id, payload, session);
          if (!result.ok) { toast(result.error || 'บันทึกไม่สำเร็จ', 'error'); return; }
          draft = null;
          const message = mode === 'open'
            ? 'บันทึกและเปิดสอบแล้ว'
            : mode === 'saved'
              ? 'บันทึกและเผยแพร่ให้ครูในหน่วยงานเห็นแล้ว'
              : 'บันทึกการแก้ไขแล้ว';
          toast(message, 'success', 3200);
          navigate(`/teacher/exam/${sourceExam.id}/overview`);
          return;
        }

        const exam = {
          id: uid('exam'),
          code: uniqueCode(db),
          ...payload,
          teacherId: teacher.id,
          teacherName: teacher.name,
          teacherCode: teacher.code,
          teacherSchool: teacher.school,
          attemptsAllowed: 1,
          status: mode === 'open' ? 'open' : mode === 'saved' ? 'saved' : 'draft',
          savedAt: mode === 'saved' ? now.toISOString() : null,
          openedAt: mode === 'open' ? now.toISOString() : null,
          createdAt: now.toISOString(),
          publishedAt: null,
          settings: { showScore: true, showSolutions: true, showRank: false }
        };
        exam.totalPoints = exam.questions.reduce((sum, q) => sum + Number(q.points), 0);
        db.exams.unshift(exam);
        saveDB();
        draft = null;
        const message = mode === 'open'
          ? `เปิดสอบแล้ว รหัส ${exam.code}`
          : mode === 'saved'
            ? 'บันทึกแล้ว ครูในหน่วยงานเดียวกันเห็นชุดสอบนี้ได้'
            : 'บันทึกฉบับร่างแล้ว เห็นเฉพาะเจ้าของ ผู้จัดการหน่วยงาน และ Wich';
        toast(message, 'success', 4000);
        navigate(`/teacher/exam/${exam.id}/overview`);
      }));
    }
  };
}
