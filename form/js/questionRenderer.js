import { icon } from './icons.js';
import { TYPE_LABEL } from './config.js';
import { e } from './utils.js';

export function isChoice(type) {
  return type === 'radio' || type === 'checkbox' || type === 'dropdown';
}

export function isAnswerable(type) {
  return type !== 'section' && type !== 'content';
}

export function supportsOther(type) {
  return type === 'radio' || type === 'checkbox';
}

export const OTHER_PREFIX = '__other__:';

export function isOtherAnswer(value) {
  return typeof value === 'string' && value.startsWith(OTHER_PREFIX);
}

export function otherAnswerText(value) {
  return isOtherAnswer(value) ? value.slice(OTHER_PREFIX.length).trim() : '';
}

export function displayChoiceValue(value, otherLabel = 'อื่น ๆ') {
  if (isOtherAnswer(value)) return otherAnswerText(value) || otherLabel;
  return String(value ?? '');
}

export function isSection(type) {
  return type === 'section';
}

export function isContent(type) {
  return type === 'content';
}

function normalizeImage(image) {
  if (!image || typeof image !== 'object') return null;
  const url = String(image.url || '');
  if (!/^(data:image\/|https?:\/\/)/i.test(url)) return null;
  return {
    url,
    name: String(image.name || ''),
    width: Number(image.width) || 0,
    height: Number(image.height) || 0
  };
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
    scale: Number(question.scale) || 5,
    other: supportsOther(type) ? Boolean(question.other) : false,
    otherLabel: String(question.otherLabel || 'อื่น ๆ').trim() || 'อื่น ๆ',
    image: type === 'content' ? normalizeImage(question.image) : null
  };
}

export function newQuestion(type = 'radio') {
  if (type === 'section') {
    return normalizeQuestion({ type, title: 'ส่วนใหม่', description: '', required: false });
  }
  if (type === 'content') {
    return normalizeQuestion({ type, title: '', description: '', required: false, image: null });
  }
  return normalizeQuestion({
    type,
    title: '',
    description: '',
    required: false,
    options: isChoice(type) ? ['ตัวเลือก 1', 'ตัวเลือก 2'] : [],
    scale: 5,
    other: false,
    otherLabel: 'อื่น ๆ'
  });
}

function imageMarkup(image, title = '') {
  if (!image?.url) return '';
  return `<figure class="content-image">
    <img src="${e(image.url)}" alt="${e(image.name || title || 'รูปประกอบ')}" loading="lazy">
  </figure>`;
}

function sectionMarkup(question) {
  return `<section class="form-section" data-section-id="${e(question.id)}">
    <span class="form-section__eyebrow">${icon('layout-dashboard', 13)} ส่วน</span>
    <h2>${e(question.title || 'ส่วนใหม่')}</h2>
    ${question.description ? `<p>${e(question.description)}</p>` : ''}
  </section>`;
}

function contentMarkup(question) {
  return `<section class="content-block" data-qid="${e(question.id)}">
    ${question.title ? `<h3 class="content-block__title">${e(question.title)}</h3>` : ''}
    ${question.description ? `<div class="content-block__text">${e(question.description)}</div>` : ''}
    ${imageMarkup(question.image, question.title)}
  </section>`;
}

function inputName(question) {
  return `q_${question.id}`;
}

export function questionInputMarkup(question, index, { preview = false, value = undefined, error = '' } = {}) {
  const q = normalizeQuestion(question);
  if (q.type === 'section') return sectionMarkup(q);
  if (q.type === 'content') return contentMarkup(q);
  const disabled = preview ? 'disabled' : '';
  const name = inputName(q);
  let body = '';

  if (q.type === 'radio' || q.type === 'checkbox') {
    const inputType = q.type === 'checkbox' ? 'checkbox' : 'radio';
    const rawSelected = q.type === 'checkbox'
      ? (Array.isArray(value) ? value.map(String) : [])
      : (value === undefined || value === null ? [] : [String(value)]);
    const otherStored = rawSelected.find(item => isOtherAnswer(item));
    const otherChecked = supportsOther(q.type) && q.other && (rawSelected.includes('__other__') || Boolean(otherStored));
    const otherValue = otherAnswerText(otherStored) || '';
    const selected = rawSelected.filter(item => !isOtherAnswer(item) && item !== '__other__');
    const options = q.options.length ? q.options : ['ตัวเลือก 1', 'ตัวเลือก 2'];
    body = `<div class="answer-options answer-options--${q.type}">
      ${options.map((option, optionIndex) => `<label class="answer-option ${selected.includes(String(option)) ? 'is-selected' : ''}">
        <input type="${inputType}" name="${name}" value="${e(option)}" ${selected.includes(String(option)) ? 'checked' : ''} ${disabled}>
        <span class="answer-option__mark">${q.type === 'checkbox' ? icon('check', 12) : ''}</span>
        <span class="answer-option__letter">${String.fromCharCode(65 + optionIndex)}</span>
        <span class="answer-option__text">${e(option)}</span>
      </label>`).join('')}
      ${q.other ? `<div class="answer-option answer-option--other ${otherChecked ? 'is-selected' : ''}">
        <label class="answer-option__choice">
          <input type="${inputType}" name="${name}" value="__other__" data-other-choice="${e(q.id)}" ${otherChecked ? 'checked' : ''} ${disabled}>
          <span class="answer-option__mark">${q.type === 'checkbox' ? icon('check', 12) : ''}</span>
          <span class="answer-option__letter">${String.fromCharCode(65 + options.length)}</span>
          <span class="answer-option__text answer-other__label">${e(q.otherLabel || 'อื่น ๆ')}</span>
        </label>
        <textarea class="answer-other__input" rows="1" data-other-input="${e(q.id)}" placeholder="พิมพ์คำตอบของคุณ…" ${disabled}>${e(otherValue)}</textarea>
      </div>` : ''}
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
  if (!isAnswerable(q.type)) return '';
  const name = inputName(q);
  if (q.type === 'checkbox') {
    const values = [...form.querySelectorAll(`input[name="${name}"]:checked`)]
      .map(input => input.value)
      .filter(item => item !== '__other__');
    const otherChoice = form.querySelector(`input[name="${name}"][data-other-choice]:checked`);
    if (otherChoice) {
      const text = String(form.querySelector(`[data-other-input="${q.id}"]`)?.value || '').trim();
      values.push(`${OTHER_PREFIX}${text}`);
    }
    return values;
  }
  if (q.type === 'radio' || q.type === 'yesno' || q.type === 'rating') {
    const checked = form.querySelector(`input[name="${name}"]:checked`);
    if (!checked) return q.type === 'rating' ? null : '';
    if (q.type === 'yesno') return checked.value === 'true';
    if (q.type === 'rating') return Number(checked.value);
    if (q.type === 'radio' && checked.value === '__other__') {
      const text = String(form.querySelector(`[data-other-input="${q.id}"]`)?.value || '').trim();
      return `${OTHER_PREFIX}${text}`;
    }
    return checked.value;
  }
  const field = form.querySelector(`[name="${name}"]`);
  if (!field) return '';
  return String(field.value ?? '').trim();
}

export function validateAnswer(question, value) {
  const q = normalizeQuestion(question);
  if (!isAnswerable(q.type)) return '';
  const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  const otherValue = (Array.isArray(value) ? value : [value]).find(item => isOtherAnswer(item));
  if (otherValue !== undefined && !otherAnswerText(otherValue)) return 'กรุณาระบุคำตอบอื่น ๆ';
  if (q.required && empty) return 'ข้อนี้จำเป็นต้องตอบ';
  if (empty) return '';
  if (q.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (q.type === 'number' && Number.isNaN(Number(value))) return 'กรุณากรอกเป็นตัวเลข';
  return '';
}

export function answeredCount(form, questions) {
  return questions.filter(question => {
    if (!isAnswerable(question.type)) return false;
    const value = readAnswer(form, question);
    return !(value === '' || value === null || (Array.isArray(value) && value.length === 0));
  }).length;
}

export function buildPages(questions = []) {
  const pages = [];
  let current = null;
  const startPage = (section = null) => {
    current = { section, items: [] };
    pages.push(current);
  };
  questions.map(normalizeQuestion).forEach(question => {
    if (question.type === 'section') {
      startPage(question);
      return;
    }
    if (!current) startPage();
    current.items.push(question);
  });
  if (!pages.length) startPage();
  return pages;
}
