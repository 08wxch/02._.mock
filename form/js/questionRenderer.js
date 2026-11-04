import { icon } from './icons.js';
import { TYPE_LABEL } from './config.js';
import { e } from './utils.js';

export function isChoice(type) {
  return type === 'radio' || type === 'checkbox' || type === 'dropdown';
}

export function normalizeQuestion(question = {}) {
  const type = question.type || 'short';
  const options = Array.isArray(question.options) ? question.options : [];
  return {
    id: question.id || `q_${Math.random().toString(36).slice(2, 9)}`,
    type,
    title: question.title || '',
    description: question.description || '',
    required: Boolean(question.required),
    options: isChoice(type) || type === 'yesno' ? options : [],
    scale: Number(question.scale) || 5
  };
}

export function newQuestion(type = 'radio') {
  return normalizeQuestion({
    type,
    title: '',
    description: '',
    required: false,
    options: isChoice(type) ? ['ตัวเลือก 1', 'ตัวเลือก 2'] : [],
    scale: 5
  });
}

function inputName(question) {
  return `q_${question.id}`;
}

export function questionInputMarkup(question, index, { preview = false, value = undefined, error = '' } = {}) {
  const q = normalizeQuestion(question);
  const disabled = preview ? 'disabled' : '';
  const name = inputName(q);
  let body = '';

  if (q.type === 'radio' || q.type === 'checkbox') {
    const inputType = q.type === 'checkbox' ? 'checkbox' : 'radio';
    const selected = q.type === 'checkbox'
      ? (Array.isArray(value) ? value.map(String) : [])
      : (value === undefined || value === null ? [] : [String(value)]);
    body = `<div class="answer-options answer-options--${q.type}">
      ${(q.options.length ? q.options : ['ตัวเลือก 1', 'ตัวเลือก 2']).map((option, optionIndex) => `<label class="answer-option ${selected.includes(String(option)) ? 'is-selected' : ''}">
        <input type="${inputType}" name="${name}" value="${e(option)}" ${selected.includes(String(option)) ? 'checked' : ''} ${disabled}>
        <span class="answer-option__mark">${q.type === 'checkbox' ? icon('check', 12) : ''}</span>
        <span class="answer-option__letter">${String.fromCharCode(65 + optionIndex)}</span>
        <span class="answer-option__text">${e(option)}</span>
      </label>`).join('')}
    </div>`;
  } else if (q.type === 'dropdown') {
    body = `<div class="answer-select">
      <select name="${name}" ${disabled}>
        <option value="">— เลือกคำตอบ —</option>
        ${(q.options.length ? q.options : ['ตัวเลือก 1', 'ตัวเลือก 2']).map(option => `<option value="${e(option)}" ${String(value) === String(option) ? 'selected' : ''}>${e(option)}</option>`).join('')}
      </select>
      ${icon('chevron-down', 15)}
    </div>`;
  } else if (q.type === 'yesno') {
    body = `<div class="answer-options answer-options--yesno">
      <label class="answer-option ${value === true ? 'is-selected' : ''}">
        <input type="radio" name="${name}" value="true" ${value === true ? 'checked' : ''} ${disabled}>
        <span class="answer-option__mark"></span>
        <span class="answer-option__icon">${icon('check', 15)}</span>
        <span class="answer-option__text">ใช่</span>
      </label>
      <label class="answer-option ${value === false ? 'is-selected' : ''}">
        <input type="radio" name="${name}" value="false" ${value === false ? 'checked' : ''} ${disabled}>
        <span class="answer-option__mark"></span>
        <span class="answer-option__icon">${icon('x', 15)}</span>
        <span class="answer-option__text">ไม่ใช่</span>
      </label>
    </div>`;
  } else if (q.type === 'rating') {
    const scale = q.scale >= 3 && q.scale <= 10 ? q.scale : 5;
    body = `<div class="answer-rating" data-rating>
      <div class="answer-rating__scale" role="radiogroup" aria-label="${e(q.title)}">
        ${Array.from({ length: scale }, (_, i) => i + 1).map(n => `<label class="answer-rating__item ${Number(value) === n ? 'is-selected' : ''}">
          <input type="radio" name="${name}" value="${n}" ${Number(value) === n ? 'checked' : ''} ${disabled}>
          <span>${n}</span>
        </label>`).join('')}
      </div>
      <div class="answer-rating__labels"><span>น้อยที่สุด</span><span>มากที่สุด</span></div>
    </div>`;
  } else if (q.type === 'paragraph') {
    body = `<textarea class="answer-input answer-input--area" name="${name}" rows="4" placeholder="พิมพ์คำตอบของคุณ…" ${disabled}>${value ? e(value) : ''}</textarea>`;
  } else if (q.type === 'date') {
    body = `<input class="answer-input" type="date" name="${name}" value="${value ? e(value) : ''}" ${disabled}>`;
  } else if (q.type === 'time') {
    body = `<input class="answer-input" type="time" name="${name}" value="${value ? e(value) : ''}" ${disabled}>`;
  } else if (q.type === 'email') {
    body = `<input class="answer-input" type="email" name="${name}" placeholder="name@example.com" value="${value ? e(value) : ''}" ${disabled}>`;
  } else if (q.type === 'number') {
    body = `<input class="answer-input" type="number" name="${name}" placeholder="พิมพ์ตัวเลข" value="${value ?? ''}" ${disabled}>`;
  } else {
    body = `<input class="answer-input" type="text" name="${name}" placeholder="พิมพ์คำตอบของคุณ…" value="${value ? e(value) : ''}" ${disabled}>`;
  }

  return `<section class="question ${error ? 'has-error' : ''}" data-qid="${q.id}" id="question-${q.id}">
    <div class="question__head">
      <span class="question__num">${String(index + 1).padStart(2, '0')}</span>
      <div class="question__titles">
        <h3 class="question__title">${e(q.title || 'คำถามยังไม่มีข้อความ')}${q.required ? '<span class="question__required" title="จำเป็นต้องตอบ">*</span>' : ''}</h3>
        ${q.description ? `<p class="question__desc">${e(q.description)}</p>` : ''}
      </div>
      <span class="question__type">${e(TYPE_LABEL[q.type] || 'คำถาม')}</span>
    </div>
    <div class="question__body">
      ${body}
      <p class="question__error">${icon('alert-circle', 13)} <span>${e(error)}</span></p>
    </div>
  </section>`;
}

export function readAnswer(form, question) {
  const q = normalizeQuestion(question);
  const name = inputName(q);
  if (q.type === 'checkbox') {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
  }
  if (q.type === 'radio' || q.type === 'yesno' || q.type === 'rating') {
    const checked = form.querySelector(`input[name="${name}"]:checked`);
    if (!checked) return q.type === 'rating' ? null : '';
    if (q.type === 'yesno') return checked.value === 'true';
    if (q.type === 'rating') return Number(checked.value);
    return checked.value;
  }
  const field = form.querySelector(`[name="${name}"]`);
  if (!field) return '';
  return String(field.value ?? '').trim();
}

export function validateAnswer(question, value) {
  const q = normalizeQuestion(question);
  const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  if (q.required && empty) return 'ข้อนี้จำเป็นต้องตอบ';
  if (empty) return '';
  if (q.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (q.type === 'number' && Number.isNaN(Number(value))) return 'กรุณากรอกเป็นตัวเลข';
  return '';
}

export function answeredCount(form, questions) {
  return questions.filter(question => {
    const value = readAnswer(form, question);
    return !(value === '' || value === null || (Array.isArray(value) && value.length === 0));
  }).length;
}
