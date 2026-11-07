import { getForm, createForm, updateForm, deleteForm } from '../cloud.js';
import { workspaceShell, statusBadge } from '../layout.js';
import { QUESTION_TYPES, TYPE_ICON } from '../config.js';
import { icon } from '../icons.js';
import { toast, confirmDialog, openModal, avatar } from '../ui.js';
import { qrSvg, downloadQrCard } from '../qr.js';
import { shareUrl } from '../shareKit.js';
import {
  e, uid, datetimeLocalValue, fromDatetimeLocal, statusOf, thaiDateTime, safeFilename, formatNumber,
  imageFileToDataUrl
} from '../utils.js';
import {
  questionInputMarkup, normalizeQuestion, isChoice, isAnswerable, newQuestion,
  supportsOther, readAnswer, validateAnswer, buildPages
} from '../questionRenderer.js';
import { navigate } from '../app.js';

const DEFAULT_CONFIRMATION = 'ขอบคุณที่สละเวลาตอบแบบสอบถาม ความคิดเห็นของคุณมีความหมายกับเรามาก';

function typeOptions(selected) {
  return QUESTION_TYPES.map(type => `<option value="${type.value}" ${type.value === selected ? 'selected' : ''}>${type.label}</option>`).join('');
}

function optionRows(question) {
  const options = question.options.length ? question.options : ['', ''];
  const canAddOther = supportsOther(question.type);
  return `<div class="opt-list" data-opt-list>
    ${options.map((option, index) => `<div class="opt-row">
      <span class="opt-row__mark">${question.type === 'checkbox' ? icon('check', 11) : String.fromCharCode(65 + index)}</span>
      <input class="opt-row__input" type="text" value="${e(option)}" data-opt="${index}" placeholder="ตัวเลือกที่ ${index + 1}" aria-label="ตัวเลือกที่ ${index + 1}">
      <button class="icon-btn icon-btn--quiet opt-row__remove" type="button" data-opt-remove="${index}" aria-label="ลบตัวเลือก" ${options.length <= 2 ? 'disabled' : ''}>${icon('x', 15)}</button>
    </div>`).join('')}
    ${canAddOther && question.other ? `<div class="opt-row opt-row--other" data-other-row>
      <span class="opt-row__mark">${question.type === 'checkbox' ? icon('check', 11) : String.fromCharCode(65 + options.length)}</span>
      <input class="opt-row__input" type="text" value="${e(question.otherLabel || 'อื่น ๆ')}" data-other-label placeholder="อื่น ๆ" aria-label="ข้อความตัวเลือกอื่น ๆ">
      <span class="opt-row__tag">${icon('edit', 11)} ผู้ตอบพิมพ์เอง</span>
      <button class="icon-btn icon-btn--quiet opt-row__remove" type="button" data-other-remove aria-label="ลบตัวเลือกอื่น ๆ">${icon('x', 15)}</button>
    </div>` : ''}
    <div class="opt-add-row">
      <button class="opt-add" type="button" data-add-opt>${icon('plus', 15)} เพิ่มตัวเลือก</button>
      ${canAddOther && !question.other ? `<button class="opt-add opt-add--other" type="button" data-add-other>${icon('plus', 15)} เพิ่ม “อื่น ๆ”</button>` : ''}
    </div>
  </div>`;
}

function contentImageEditor(question) {
  const image = question.image?.url
    ? `<figure class="content-image content-image--editor">
        <img src="${e(question.image.url)}" alt="${e(question.image.name || 'รูปประกอบ')}" loading="lazy">
        <div class="content-image__actions">
          <label class="btn btn--ghost btn--sm content-upload">
            ${icon('upload', 14)} เปลี่ยนรูป
            <input type="file" data-image-input accept="image/*" hidden>
          </label>
          <button class="btn btn--ghost btn--sm btn--danger-text" type="button" data-remove-image>${icon('trash', 14)} ลบรูป</button>
        </div>
      </figure>`
    : `<div class="content-image-empty">
        <span class="content-image-empty__icon">${icon('upload', 22)}</span>
        <span>ยังไม่มีรูปประกอบ</span>
        <label class="btn btn--ghost btn--sm content-upload">
          ${icon('upload', 14)} อัปโหลดรูป
          <input type="file" data-image-input accept="image/*" hidden>
        </label>
      </div>`;
  return `<div class="content-editor">
    ${image}
    <p class="content-editor__hint">${icon('info', 12)} รูปจะถูกเก็บไว้ในแบบสอบถาม และถูกลบไปพร้อมแบบสอบถาม — รองรับ JPG, PNG, WEBP ไม่เกิน 8 MB</p>
  </div>`;
}

function typeEditor(question) {
  if (question.type === 'section') return '';
  if (question.type === 'content') return contentImageEditor(question);
  if (isChoice(question.type)) return optionRows(question);
  if (question.type === 'yesno') {
    return `<div class="q-static">
      <span class="q-static__option">${icon('check', 13)} ใช่</span>
      <span class="q-static__option">${icon('x', 13)} ไม่ใช่</span>
      <span class="q-static__hint">ผู้ตอบเลือกได้เพียงข้อเดียว</span>
    </div>`;
  }
  if (question.type === 'rating') {
    return `<div class="q-rating-editor">
      <label class="q-scale">สเกล
        <select data-scale>
          ${[3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}" ${question.scale === n ? 'selected' : ''}>1 – ${n}</option>`).join('')}
        </select>
      </label>
      <div class="q-rating-preview">${Array.from({ length: question.scale || 5 }, (_, i) => `<span>${i + 1}</span>`).join('')}</div>
    </div>`;
  }
  const placeholder = {
    short: 'คำตอบสั้น ๆ',
    paragraph: 'คำตอบหลายบรรทัด',
    date: 'วว/ดด/ปปปป',
    time: 'ชั่วโมง:นาที',
    email: 'name@example.com',
    number: '0'
  }[question.type] || 'คำตอบ';
  return `<div class="q-static q-static--field">
    ${question.type === 'paragraph' ? `<span class="q-static__area">${placeholder}</span>` : `<span class="q-static__input">${placeholder}</span>`}
    ${question.type === 'email' ? '<span class="q-static__hint">ตรวจรูปแบบอีเมลให้อัตโนมัติ</span>' : ''}
    ${question.type === 'number' ? '<span class="q-static__hint">รับเฉพาะตัวเลข</span>' : ''}
  </div>`;
}

function questionCard(question, index, total, answerNumber = null) {
  const block = !isAnswerable(question.type);
  const isSectionBlock = question.type === 'section';
  const isContentBlock = question.type === 'content';
  const titlePlaceholder = isSectionBlock
    ? 'ชื่อส่วน เช่น ข้อมูลทั่วไป'
    : isContentBlock
      ? 'หัวข้อข้อความ (ไม่บังคับ)'
      : 'พิมพ์คำถามของคุณ…';
  const descriptionPlaceholder = isSectionBlock
    ? 'คำอธิบายส่วน (ไม่บังคับ)'
    : isContentBlock
      ? 'พิมพ์ข้อความที่ต้องการให้ผู้ตอบอ่าน…'
      : 'คำอธิบายเพิ่มเติม (ไม่บังคับ)';
  const descriptionField = block
    ? `<textarea class="q-desc-input q-desc-input--area" data-q-desc rows="${isContentBlock ? 4 : 2}" placeholder="${descriptionPlaceholder}" aria-label="${descriptionPlaceholder}">${e(question.description)}</textarea>`
    : `<input class="q-desc-input" type="text" data-q-desc value="${e(question.description)}" placeholder="${descriptionPlaceholder}" aria-label="${descriptionPlaceholder}">`;
  return `<article class="q-card ${block ? `q-card--block q-card--${question.type}` : ''}" data-qid="${question.id}">
    <div class="q-card__top">
      <span class="q-card__num ${block ? 'q-card__num--block' : ''}">${block || answerNumber === null ? icon(isSectionBlock ? 'layout-dashboard' : 'file-text', 14) : String(answerNumber + 1).padStart(2, '0')}</span>
      <label class="q-type">
        <span class="q-type__icon">${icon(TYPE_ICON[question.type] || 'type', 16)}</span>
        <select data-q-type aria-label="ประเภท">${typeOptions(question.type)}</select>
        ${icon('chevron-down', 13)}
      </label>
      ${block
        ? `<span class="q-block-label">${isSectionBlock ? 'ขึ้นหน้าใหม่' : 'แสดงอย่างเดียว'}</span>`
        : `<label class="switch switch--compact">
            <input type="checkbox" data-q-required ${question.required ? 'checked' : ''}>
            <span class="switch__track"></span>
            <span class="switch__label">จำเป็น</span>
          </label>`}
      <div class="q-card__tools">
        <button class="icon-btn icon-btn--quiet" type="button" data-move="up" aria-label="เลื่อนขึ้น" ${index === 0 ? 'disabled' : ''}>${icon('arrow-up', 15)}</button>
        <button class="icon-btn icon-btn--quiet" type="button" data-move="down" aria-label="เลื่อนลง" ${index === total - 1 ? 'disabled' : ''}>${icon('arrow-down', 15)}</button>
        <button class="icon-btn icon-btn--quiet" type="button" data-duplicate aria-label="ทำสำเนา">${icon('duplicate', 15)}</button>
        <button class="icon-btn icon-btn--quiet icon-btn--danger" type="button" data-remove-q aria-label="ลบรายการ">${icon('trash', 15)}</button>
      </div>
    </div>
    <div class="q-card__body">
      <textarea class="q-title-input" data-q-title rows="1" placeholder="${titlePlaceholder}">${e(question.title)}</textarea>
      ${descriptionField}
      <div class="q-editor">${typeEditor(question)}</div>
    </div>
  </article>`;
}

export async function builderView({ session, formId }) {
  const existing = formId ? await getForm(formId) : null;
  if (existing && existing.ownerId !== session.userId && !session.isAdmin) {
    throw new Error('คุณไม่มีสิทธิ์แก้ไขแบบสอบถามนี้');
  }

  const draft = {
    id: existing?.id || null,
    slug: existing?.slug || null,
    title: existing?.title || '',
    description: existing?.description || '',
    questions: (existing?.questions || []).map(normalizeQuestion),
    settings: {
      confirmation: existing?.settings?.confirmation || DEFAULT_CONFIRMATION,
      showProgress: existing?.settings?.showProgress !== false
    },
    status: existing?.status || 'draft',
    openAt: existing?.openAt || null,
    closeAt: existing?.closeAt || null,
    ownerName: existing?.ownerName || session.name,
    responseCount: existing?.responseCount || 0
  };
  if (!draft.questions.length) draft.questions = [newQuestion('radio')];

  let dirty = false;
  let saving = false;

  const topActions = `
    <span class="save-state" data-save-state>${icon('cloud-check', 14)} <span>${existing ? 'พร้อมแก้ไข' : 'ยังไม่บันทึก'}</span></span>
    <button class="btn btn--ghost btn--sm" type="button" data-preview title="ดูตัวอย่างแบบสอบถาม" aria-label="ดูตัวอย่างแบบสอบถาม">${icon('eye', 15)} ดูตัวอย่าง</button>
    <button class="btn btn--primary btn--sm" type="button" data-save>${icon('cloud-check', 15)} บันทึก</button>`;

  function linkCardMarkup() {
    if (!draft.slug) {
      return `<div class="side-card side-card--muted" data-link-card>
        <div class="side-card__head"><h3>ลิงก์และ QR Code</h3></div>
        <p class="side-note">${icon('link', 15)} บันทึกและเผยแพร่แบบสอบถามก่อน เพื่อรับลิงก์สำหรับส่งให้ผู้ตอบ</p>
      </div>`;
    }
    const meta = statusOf(draft);
    const ready = meta.key !== 'draft';
    if (!ready) {
      return `<div class="side-card side-card--muted" data-link-card>
        <div class="side-card__head"><h3>ลิงก์และ QR Code</h3><span class="badge badge--neutral">ยังไม่เผยแพร่</span></div>
        <p class="side-note">${icon('alert-triangle', 15)} แบบสอบถามนี้เป็นฉบับร่าง ผู้ตอบยังเปิดลิงก์ไม่ได้ — กด “เผยแพร่แบบสอบถาม” เพื่อสร้างลิงก์และ QR Code</p>
      </div>`;
    }
    return `<div class="side-card side-card--link" data-link-card>
      <div class="side-card__head"><h3>ลิงก์และ QR Code</h3><span class="badge badge--gold">${meta.key === 'open' ? 'พร้อมแชร์' : e(meta.label)}</span></div>
      <div class="builder-qr">${qrSvg(shareUrl(draft), 132, 2)}</div>
      <div class="link-box link-box--tight">
        <code>${e(shareUrl(draft))}</code>
        <button class="icon-btn" type="button" data-copy-text="${e(shareUrl(draft))}" aria-label="คัดลอกลิงก์">${icon('copy', 15)}</button>
      </div>
      <div class="side-card__row">
        <button class="btn btn--ghost btn--sm" type="button" data-download-qr>${icon('download', 14)} ดาวน์โหลด QR</button>
        <a class="btn btn--ghost btn--sm" href="${shareUrl(draft)}" target="_blank" rel="noopener">${icon('external-link', 14)} เปิด</a>
      </div>
    </div>`;
  }

  const linkCard = linkCardMarkup();

  const content = `<div class="builder" data-builder>
    <div class="builder-grid">
      <div class="builder-main">
        <div class="builder-intro">
          <span class="eyebrow">${existing ? 'แก้ไขแบบสอบถาม' : 'สร้างแบบสอบถามใหม่'}</span>
          <p>${existing ? 'ปรับคำถามและกำหนดการได้ตามต้องการ การแก้ไขจะมีผลทันทีหลังกดบันทึก' : 'เริ่มจากชื่อเรื่องและคำถาม ไม่ต้องเข้าสู่ระบบสำหรับผู้ตอบ'}</p>
        </div>

        <section class="builder-head">
          <div class="builder-head__accent"></div>
          <textarea class="builder-title" data-title rows="1" placeholder="ชื่อแบบสอบถาม" aria-label="ชื่อแบบสอบถาม" maxlength="160">${e(draft.title)}</textarea>
          <textarea class="builder-desc" data-description rows="2" placeholder="คำอธิบายแบบสอบถาม — บอกวัตถุประสงค์และเวลาที่ใช้โดยประมาณ" aria-label="คำอธิบายแบบสอบถาม" maxlength="1200">${e(draft.description)}</textarea>
          <div class="builder-head__meta">
            <span class="builder-owner">${avatar(session.name, 24)} ${e(session.name)}</span>
            <span>${icon('clipboard-list', 14)} <b data-q-count>${formatNumber(draft.questions.filter(question => isAnswerable(question.type)).length)}</b> ข้อ</span>
            <span data-section-meta ${draft.questions.some(question => question.type === 'section') ? '' : 'hidden'}>${icon('layout-dashboard', 14)} <b data-section-count>${formatNumber(draft.questions.filter(question => question.type === 'section').length)}</b> ส่วน</span>
            ${existing ? `<span>${icon('inbox', 14)} ${formatNumber(draft.responseCount)} คำตอบ</span>` : ''}
            <span class="builder-head__status" data-head-status>${statusBadge(statusOf(draft).key)}</span>
          </div>
        </section>

        <div class="builder-questions" data-questions></div>

        <div class="builder-add-row">
          <button class="add-question" type="button" data-add-question>
            <span class="add-question__icon">${icon('plus', 20)}</span>
            <span><strong>เพิ่มคำถาม</strong><small>ข้อความ ตัวเลือก คะแนน ฯลฯ</small></span>
          </button>
          <button class="add-question add-question--section" type="button" data-add-section>
            <span class="add-question__icon">${icon('layout-dashboard', 20)}</span>
            <span><strong>เพิ่มส่วน</strong><small>แบ่งหน้าเหมือน Google Form</small></span>
          </button>
          <button class="add-question add-question--content" type="button" data-add-content>
            <span class="add-question__icon">${icon('file-text', 20)}</span>
            <span><strong>ข้อความ / รูปภาพ</strong><small>แสดงอย่างเดียว ไม่ต้องตอบ</small></span>
          </button>
        </div>

        <p class="builder-tip">${icon('info', 14)} ข้อที่มีเครื่องหมาย <b>*</b> คือข้อบังคับ · “ส่วน” จะเริ่มหน้าใหม่สำหรับผู้ตอบ · “ข้อความ / รูปภาพ” ใช้แสดงคำอธิบายโดยไม่เก็บคำตอบ</p>
      </div>

      <aside class="builder-side">
        <div class="side-card">
          <div class="side-card__head"><h3>${icon('calendar-clock', 16)} กำหนดการ</h3></div>
          <div class="field field--tight">
            <label class="field__label" for="open-at">เปิดรับคำตอบ</label>
            <input class="input" id="open-at" type="datetime-local" data-open value="${datetimeLocalValue(draft.openAt)}">
          </div>
          <div class="field field--tight">
            <label class="field__label" for="close-at">ปิดรับคำตอบ</label>
            <input class="input" id="close-at" type="datetime-local" data-close value="${datetimeLocalValue(draft.closeAt)}">
          </div>
          <p class="field__hint">เว้นว่างไว้หากไม่ต้องการกำหนดเวลา ระบบจะใช้เวลาไทย (Asia/Bangkok)</p>
          <div class="side-divider"></div>
          <label class="switch">
            <input type="checkbox" data-show-progress ${draft.settings.showProgress ? 'checked' : ''}>
            <span class="switch__track"></span>
            <span class="switch__label">แสดงแถบความคืบหน้า</span>
          </label>
        </div>

        <div class="side-card" data-status-card>
          <div class="side-card__head"><h3>${icon('flag', 16)} สถานะ</h3><span data-status-pill>${statusBadge(statusOf(draft).key)}</span></div>
          <p class="side-note" data-status-text></p>
          <button class="btn btn--primary btn--wide" type="button" data-publish>${icon('send', 15)} <span data-publish-label>เผยแพร่แบบสอบถาม</span></button>
          ${!draft.id ? `<p class="field__hint field__hint--center">กดปุ่มนี้เพื่อบันทึกและสร้างลิงก์แชร์ทันที</p>` : ''}
        </div>

        <div class="side-card">
          <div class="side-card__head"><h3>${icon('message-square', 16)} ข้อความหลังส่ง</h3></div>
          <textarea class="input side-textarea" data-confirmation rows="3" placeholder="ข้อความขอบคุณผู้ตอบ" maxlength="600">${e(draft.settings.confirmation)}</textarea>
        </div>

        ${linkCard}

        <div class="side-card side-card--actions">
          <button class="btn btn--primary btn--wide" type="button" data-save>${icon('cloud-check', 16)} ${existing ? 'บันทึกการแก้ไข' : 'บันทึก'}</button>
          <button class="btn btn--ghost btn--wide" type="button" data-preview>${icon('eye', 15)} ดูตัวอย่าง</button>
          ${existing ? `<button class="side-delete" type="button" data-delete>${icon('trash', 14)} ลบแบบสอบถามนี้</button>` : ''}
        </div>
      </aside>
    </div>
  </div>`;

  const html = workspaceShell({
    session,
    back: '#/',
    crumb: existing ? 'แก้ไขแบบสอบถาม' : 'สร้างแบบสอบถาม',
    title: draft.title || 'แบบสอบถามใหม่',
    actions: topActions,
    content,
    wide: true
  });

  function setDirty(value = true) {
    dirty = value;
    const state = document.querySelector('[data-save-state]');
    if (!state) return;
    state.classList.toggle('is-dirty', dirty);
    if (!saving) {
      state.innerHTML = dirty
        ? `${icon('edit', 14)} <span>ยังไม่บันทึก</span>`
        : `${icon('cloud-check', 14)} <span>บันทึกแล้ว</span>`;
    }
  }

  function setSaving(value) {
    saving = value;
    const state = document.querySelector('[data-save-state]');
    if (state) {
      state.classList.toggle('is-saving', value);
      state.innerHTML = value
        ? `${icon('refresh', 14)} <span>กำลังบันทึก…</span>`
        : dirty
          ? `${icon('edit', 14)} <span>ยังไม่บันทึก</span>`
          : `${icon('cloud-check', 14)} <span>บันทึกแล้ว</span>`;
    }
    document.querySelectorAll('[data-save], [data-publish]').forEach(btn => { btn.disabled = value; });
  }

  function renderQuestions() {
    const wrap = document.querySelector('[data-questions]');
    if (!wrap) return;
    let answerNumber = 0;
    wrap.innerHTML = draft.questions.map((question, index) => {
      const displayNumber = isAnswerable(question.type) ? answerNumber++ : null;
      return questionCard(question, index, draft.questions.length, displayNumber);
    }).join('');
    const answerCount = draft.questions.filter(question => isAnswerable(question.type)).length;
    const sectionCount = draft.questions.filter(question => question.type === 'section').length;
    const count = document.querySelector('[data-q-count]');
    if (count) count.textContent = formatNumber(answerCount);
    const sectionMeta = document.querySelector('[data-section-meta]');
    if (sectionMeta) {
      sectionMeta.hidden = sectionCount === 0;
      const sectionValue = sectionMeta.querySelector('[data-section-count]');
      if (sectionValue) sectionValue.textContent = formatNumber(sectionCount);
    }
    wrap.querySelectorAll('textarea').forEach(autoGrow);
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }

  function syncStatus() {
    const meta = statusOf(draft);
    const pill = document.querySelector('[data-status-pill]');
    const head = document.querySelector('[data-head-status]');
    if (pill) pill.innerHTML = statusBadge(meta.key);
    if (head) head.innerHTML = statusBadge(meta.key);
    const text = document.querySelector('[data-status-text]');
    const label = document.querySelector('[data-publish-label]');
    const button = document.querySelector('[data-publish]');
    if (text) {
      if (meta.key === 'draft') text.textContent = 'แบบสอบถามยังไม่เผยแพร่ ผู้ตอบยังเปิดลิงก์ไม่ได้';
      else if (meta.key === 'scheduled') text.textContent = `กำหนดเปิด ${thaiDateTime(draft.openAt)} — ลิงก์จะใช้งานได้เมื่อถึงเวลา`;
      else if (meta.key === 'closed') text.textContent = 'ปิดรับคำตอบแล้ว ผู้ที่เปิดลิงก์จะเห็นข้อความแจ้งเตือน';
      else text.textContent = draft.closeAt ? `เปิดรับถึง ${thaiDateTime(draft.closeAt)}` : 'เปิดรับคำตอบอยู่ — ผู้ตอบเข้าถึงได้ทันที';
    }
    if (label) {
      label.textContent = meta.key === 'draft' ? 'เผยแพร่แบบสอบถาม' : meta.key === 'closed' ? 'เปิดรับอีกครั้ง' : 'หยุดรับคำตอบ';
    }
    if (button) {
      button.classList.toggle('btn--danger', meta.key !== 'draft' && meta.key !== 'closed');
      button.classList.toggle('btn--primary', meta.key === 'draft' || meta.key === 'closed');
      button.classList.toggle('btn--dark-outline', meta.key === 'open' || meta.key === 'scheduled');
      button.innerHTML = `${icon(meta.key === 'draft' ? 'send' : meta.key === 'closed' ? 'refresh' : 'lock', 15)} <span data-publish-label>${label?.textContent || ''}</span>`;
    }
  }

  function findQuestion(qid) {
    return draft.questions.find(question => question.id === qid);
  }

  function collectSettings() {
    draft.openAt = fromDatetimeLocal(document.querySelector('[data-open]')?.value || '');
    draft.closeAt = fromDatetimeLocal(document.querySelector('[data-close]')?.value || '');
  }

  function validateDraft() {
    if (!draft.title.trim()) {
      toast('กรุณากรอกชื่อแบบสอบถาม', 'warning');
      document.querySelector('[data-title]')?.focus();
      return false;
    }
    let answerIndex = 0;
    let sectionIndex = 0;
    for (let i = 0; i < draft.questions.length; i += 1) {
      const question = draft.questions[i];
      question.title = (question.title || '').trim();
      question.description = (question.description || '').trim();
      if (question.type === 'section') {
        sectionIndex += 1;
        if (!question.title) {
          toast(`ส่วนที่ ${sectionIndex} ยังไม่มีชื่อ`, 'warning');
          const card = document.querySelector(`[data-qid="${question.id}"]`);
          card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card?.querySelector('[data-q-title]')?.focus();
          return false;
        }
        question.required = false;
        question.options = [];
        question.image = null;
        continue;
      }
      if (question.type === 'content') {
        if (!question.description && !question.image?.url && !question.title) {
          toast(`ข้อความ/รูปภาพรายการที่ ${i + 1} ยังไม่มีเนื้อหา`, 'warning');
          const card = document.querySelector(`[data-qid="${question.id}"]`);
          card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card?.querySelector('[data-q-desc]')?.focus();
          return false;
        }
        question.required = false;
        question.options = [];
        continue;
      }
      answerIndex += 1;
      if (!question.title) {
        toast(`ข้อ ${answerIndex} ยังไม่มีข้อความคำถาม`, 'warning');
        const card = document.querySelector(`[data-qid="${question.id}"]`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card?.querySelector('[data-q-title]')?.focus();
        return false;
      }
      if (isChoice(question.type)) {
        question.options = question.options.map(option => option.trim()).filter(Boolean);
        if (question.options.length < 2) {
          toast(`ข้อ ${answerIndex} ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก`, 'warning');
          return false;
        }
        if (supportsOther(question.type) && question.other) {
          question.otherLabel = (question.otherLabel || '').trim() || 'อื่น ๆ';
        }
      }
    }
    if (draft.openAt && draft.closeAt && new Date(draft.closeAt).getTime() <= new Date(draft.openAt).getTime()) {
      toast('เวลาปิดรับต้องอยู่หลังเวลาเปิดรับ', 'warning');
      document.querySelector('[data-close]')?.focus();
      return false;
    }
    return true;
  }

  function cleanQuestions() {
    return draft.questions.map(question => {
      const base = {
        id: question.id,
        type: question.type,
        title: (question.title || '').trim(),
        description: (question.description || '').trim()
      };
      if (question.type === 'section') return { ...base, required: false };
      if (question.type === 'content') {
        return {
          ...base,
          required: false,
          ...(question.image?.url ? {
            image: {
              url: question.image.url,
              name: question.image.name || '',
              width: Number(question.image.width) || 0,
              height: Number(question.image.height) || 0
            }
          } : {})
        };
      }
      return {
        ...base,
        required: Boolean(question.required),
        options: isChoice(question.type) ? question.options.map(option => option.trim()).filter(Boolean) : [],
        ...(supportsOther(question.type) ? {
          other: Boolean(question.other),
          otherLabel: (question.otherLabel || 'อื่น ๆ').trim() || 'อื่น ๆ'
        } : {}),
        ...(question.type === 'rating' ? { scale: Number(question.scale) || 5 } : {})
      };
    });
  }

  function refreshLinkCard() {
    if (!draft.slug) return;
    const card = document.querySelector('[data-link-card]');
    if (!card) return;
    card.outerHTML = linkCardMarkup();
  }

  async function persist({ goShare = false } = {}) {
    if (saving) return false;
    collectSettings();
    if (!validateDraft()) return false;
    if (goShare) {
      draft.status = 'published';
      if (draft.closeAt && new Date(draft.closeAt).getTime() < Date.now()) draft.closeAt = null;
    }
    setSaving(true);
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      questions: cleanQuestions(),
      settings: {
        confirmation: draft.settings.confirmation.trim() || DEFAULT_CONFIRMATION,
        showProgress: Boolean(draft.settings.showProgress)
      },
      status: draft.status,
      openAt: draft.openAt,
      closeAt: draft.closeAt
    };

    try {
      if (!draft.id) {
        const created = await createForm(session, { ...payload, slug: draft.slug });
        draft.id = created.id;
        draft.slug = created.slug;
        draft.responseCount = 0;
        history.replaceState(null, '', `#/forms/${created.id}/edit`);
      } else {
        await updateForm(draft.id, payload);
      }
      setDirty(false);
      setSaving(false);
      syncStatus();
      refreshLinkCard();
      if (goShare) {
        toast('เผยแพร่แบบสอบถามแล้ว', 'success');
        navigate(`/forms/${draft.id}/share?created=1`);
        return true;
      }
      toast('บันทึกแบบสอบถามแล้ว', 'success');
      return true;
    } catch (error) {
      setSaving(false);
      toast(error?.message || 'บันทึกไม่สำเร็จ', 'error');
      return false;
    }
  }

  async function togglePublish() {
    const meta = statusOf(draft);
    if (!draft.id || meta.key === 'draft') {
      await persist({ goShare: true });
      return;
    }
    if (meta.key === 'closed') {
      draft.status = 'published';
      if (draft.closeAt && new Date(draft.closeAt).getTime() < Date.now()) {
        draft.closeAt = null;
        const closeField = document.querySelector('[data-close]');
        if (closeField) closeField.value = '';
        toast('ล้างเวลาปิดเดิมแล้ว เปิดรับคำตอบอีกครั้ง', 'info');
      }
      const ok = await persist();
      if (ok) toast('เปิดรับคำตอบอีกครั้งแล้ว', 'success');
    } else {
      draft.status = 'closed';
      const ok = await persist();
      if (ok) toast('หยุดรับคำตอบแล้ว', 'success');
    }
  }

  function openPreview() {
    collectSettings();
    const questions = cleanQuestions();
    const answerQuestions = questions.filter(question => isAnswerable(question.type));
    const pages = buildPages(questions);
    const answerIndex = new Map(answerQuestions.map((question, index) => [question.id, index]));
    const sectionPages = pages.filter(page => page.section);
    const pageMarkup = pages.map((page, pageIndex) => {
      const sectionNumber = page.section ? sectionPages.indexOf(page) + 1 : 0;
      return `<section class="preview-step" data-preview-page="${pageIndex}" ${pageIndex ? 'hidden' : ''}>
        ${page.section ? `<div class="preview-section-head">
          <span class="preview-section-head__eyebrow">${icon('layout-dashboard', 12)} ส่วนที่ ${sectionNumber} จาก ${sectionPages.length}</span>
          <h3>${e(page.section.title || `ส่วนที่ ${sectionNumber}`)}</h3>
          ${page.section.description ? `<p>${e(page.section.description)}</p>` : ''}
        </div>` : ''}
        <div class="preview-questions">
          ${page.items.map(item => questionInputMarkup(item, answerIndex.get(item.id) ?? 0, {})).join('')}
        </div>
      </section>`;
    }).join('');
    const body = `<div class="preview-shell">
      <div class="preview-banner">${icon('eye', 15)} ตัวอย่างหน้าผู้ตอบ — ลองกดเลือกและเลื่อนหน้าได้จริง แต่ไม่บันทึกคำตอบ</div>
      <div class="preview-page">
        <div class="preview-page__accent"></div>
        <h2>${e(draft.title || 'ชื่อแบบสอบถาม')}</h2>
        ${draft.description ? `<p>${e(draft.description)}</p>` : ''}
        <div class="preview-page__meta">${icon('clipboard-list', 13)} ${answerQuestions.length} ข้อ${sectionPages.length ? ` · ${sectionPages.length} ส่วน` : ''} ${draft.openAt ? `· เปิด ${thaiDateTime(draft.openAt)}` : ''}</div>
        <div class="preview-pages" data-preview-pages>${pageMarkup}</div>
        <div class="preview-step-nav" data-preview-nav ${pages.length > 1 ? '' : 'hidden'}>
          <button class="btn btn--ghost btn--sm" type="button" data-preview-prev>${icon('arrow-left', 14)} ย้อนกลับ</button>
          <span class="preview-step-nav__label" data-preview-label></span>
          <button class="btn btn--primary btn--sm" type="button" data-preview-next>ถัดไป ${icon('arrow-right', 14)}</button>
        </div>
        <button class="btn btn--primary btn--wide" type="button" data-preview-submit ${pages.length > 1 ? 'hidden' : ''}>${icon('send', 15)} ทดลองส่งคำตอบ</button>
        <p class="preview-page__note">${icon('lock', 12)} โหมดตัวอย่าง — คำตอบจะไม่ถูกบันทึก และไม่ถูกส่งเข้าฐานข้อมูล</p>
      </div>
    </div>`;
    openModal({
      title: 'ตัวอย่างแบบสอบถาม',
      eyebrow: 'พรีวิว',
      size: 'lg',
      body,
      footer: `<button class="btn btn--ghost" type="button" data-modal-dismiss>ปิดตัวอย่าง</button>`,
      onMount: root => mountPreview(root)
    });
  }

  function mountPreview(root) {
    const pagesEls = [...root.querySelectorAll('[data-preview-page]')];
    const prev = root.querySelector('[data-preview-prev]');
    const next = root.querySelector('[data-preview-next]');
    const submit = root.querySelector('[data-preview-submit]');
    const nav = root.querySelector('[data-preview-nav]');
    const label = root.querySelector('[data-preview-label]');
    const answerQuestions = cleanQuestions().filter(question => isAnswerable(question.type));
    let current = 0;
    const growOther = field => {
      if (!field) return;
      field.style.height = 'auto';
      field.style.height = `${Math.min(field.scrollHeight || 34, 160)}px`;
    };

    const showPage = index => {
      current = Math.max(0, Math.min(index, pagesEls.length - 1));
      pagesEls.forEach((page, pageIndex) => { page.hidden = pageIndex !== current; });
      if (prev) prev.hidden = current === 0;
      if (next) next.hidden = current === pagesEls.length - 1;
      if (submit) submit.hidden = current !== pagesEls.length - 1;
      if (nav) nav.hidden = pagesEls.length <= 1;
      if (label) label.textContent = pagesEls.length > 1 ? `หน้า ${current + 1} จาก ${pagesEls.length}` : '';
      pagesEls[current]?.querySelectorAll('[data-other-input]').forEach(growOther);
    };

    const showErrors = errors => {
      root.querySelectorAll('.question').forEach(section => section.classList.remove('has-error'));
      Object.entries(errors).forEach(([qid, message]) => {
        const section = root.querySelector(`[data-qid="${qid}"]`);
        if (!section) return;
        section.classList.add('has-error');
        const slot = section.querySelector('.question__error span');
        if (slot) slot.textContent = message;
      });
      const first = root.querySelector('.question.has-error');
      if (!first) return;
      const page = first.closest('[data-preview-page]');
      const index = pagesEls.indexOf(page);
      if (index >= 0) showPage(index);
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const validateList = list => {
      const errors = {};
      list.forEach(question => {
        const value = readAnswer(root, question);
        const error = validateAnswer(question, value);
        if (error) errors[question.id] = error;
      });
      return errors;
    };

    root.addEventListener('input', event => {
      if (event.target.matches('[data-other-input]')) {
        growOther(event.target);
        const choice = root.querySelector(`[data-other-choice="${event.target.dataset.otherInput}"]`);
        if (choice) choice.checked = true;
      }
      const section = event.target.closest('.question');
      if (section) section.classList.remove('has-error');
    });

    prev?.addEventListener('click', () => showPage(current - 1));
    next?.addEventListener('click', () => {
      const pageQuestions = [...pagesEls[current].querySelectorAll('.question')]
        .map(section => answerQuestions.find(question => question.id === section.dataset.qid))
        .filter(Boolean);
      const errors = validateList(pageQuestions);
      if (Object.keys(errors).length) {
        showErrors(errors);
        toast('กรุณาตอบข้อที่จำเป็นในส่วนนี้ให้ครบก่อนไปต่อ', 'warning');
        return;
      }
      showPage(current + 1);
    });

    submit?.addEventListener('click', () => {
      const errors = validateList(answerQuestions);
      if (Object.keys(errors).length) {
        showErrors(errors);
        toast('กรุณาตอบข้อที่จำเป็นให้ครบก่อนส่ง', 'warning');
        return;
      }
      const page = root.querySelector('.preview-page');
      if (page) {
        page.innerHTML = `<div class="preview-success">
          <span class="preview-success__icon">${icon('check', 26)}</span>
          <span class="eyebrow">โหมดตัวอย่าง</span>
          <h3>ส่งคำตอบเรียบร้อย (จำลอง)</h3>
          <p>นี่คือตัวอย่างหน้าจอหลังผู้ตอบส่งแบบสอบถาม — คำตอบจริงจะไม่ถูกบันทึกจากการดูตัวอย่าง</p>
        </div>`;
      }
    });

    showPage(0);
  }

  async function handleDelete() {
    if (!draft.id) {
      navigate('/');
      return;
    }
    const ok = await confirmDialog({
      title: 'ลบแบบสอบถาม?',
      message: `“${draft.title}” และคำตอบทั้งหมดจะถูกลบอย่างถาวร`,
      confirmText: 'ลบแบบสอบถาม',
      onConfirm: async () => {
        await deleteForm(draft.id);
        toast('ลบแบบสอบถามแล้ว', 'success');
      }
    });
    if (ok) navigate('/');
  }

  function mount(root) {
    renderQuestions();
    syncStatus();
    const descField = root.querySelector('[data-description]');
    const titleField = root.querySelector('[data-title]');
    if (titleField) autoGrow(titleField);
    if (descField) autoGrow(descField);

    const beforeUnload = event => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);

    root.addEventListener('input', event => {
      const target = event.target;
      if (target.matches('[data-title]')) {
        draft.title = target.value;
        autoGrow(target);
        setDirty();
        const crumb = document.querySelector('.workspace__crumb strong');
        if (crumb) crumb.textContent = draft.title || 'แบบสอบถามใหม่';
      } else if (target.matches('[data-description]')) {
        draft.description = target.value;
        autoGrow(target);
        setDirty();
      } else if (target.matches('[data-q-title]')) {
        const question = findQuestion(target.closest('[data-qid]')?.dataset.qid);
        if (question) question.title = target.value;
        autoGrow(target);
        setDirty();
      } else if (target.matches('[data-q-desc]')) {
        const question = findQuestion(target.closest('[data-qid]')?.dataset.qid);
        if (question) question.description = target.value;
        setDirty();
      } else if (target.matches('[data-opt]')) {
        const question = findQuestion(target.closest('[data-qid]')?.dataset.qid);
        if (question) question.options[Number(target.dataset.opt)] = target.value;
        setDirty();
      } else if (target.matches('[data-other-label]')) {
        const question = findQuestion(target.closest('[data-qid]')?.dataset.qid);
        if (question) question.otherLabel = target.value;
        setDirty();
      } else if (target.matches('[data-confirmation]')) {
        draft.settings.confirmation = target.value;
        setDirty();
      }
    });

    root.addEventListener('change', async event => {
      const target = event.target;
      if (target.matches('[data-image-input]')) {
        const file = target.files?.[0];
        const question = findQuestion(target.closest('[data-qid]')?.dataset.qid);
        if (!file || !question) return;
        const uploadLabel = target.closest('.content-upload');
        uploadLabel?.classList.add('is-loading');
        try {
          const dataUrl = await imageFileToDataUrl(file);
          question.image = { url: dataUrl, name: file.name };
          setDirty();
          renderQuestions();
          toast('เพิ่มรูปประกอบแล้ว', 'success');
        } catch (error) {
          toast(error?.message || 'อัปโหลดรูปไม่สำเร็จ', 'error');
        } finally {
          uploadLabel?.classList.remove('is-loading');
        }
        return;
      }
      if (target.matches('[data-q-type]')) {
        const card = target.closest('[data-qid]');
        const question = findQuestion(card?.dataset.qid);
        if (!question) return;
        question.type = target.value;
        if (question.type === 'section') {
          question.required = false;
          question.options = [];
          question.image = null;
          if (!question.title.trim()) question.title = 'ส่วนใหม่';
        } else if (question.type === 'content') {
          question.required = false;
          question.options = [];
        } else {
          question.image = null;
          if (!supportsOther(question.type)) {
            question.other = false;
            question.otherLabel = 'อื่น ๆ';
          }
          if (isChoice(question.type)) {
            if (!question.options.length) question.options = ['ตัวเลือก 1', 'ตัวเลือก 2'];
          } else if (question.type !== 'yesno') {
            question.options = [];
          }
        }
        setDirty();
        renderQuestions();
        syncQuestionTypeIcon(card?.dataset.qid);
      } else if (target.matches('[data-q-required]')) {
        const question = findQuestion(target.closest('[data-qid]')?.dataset.qid);
        if (question) question.required = target.checked;
        setDirty();
      } else if (target.matches('[data-scale]')) {
        const question = findQuestion(target.closest('[data-qid]')?.dataset.qid);
        if (question) question.scale = Number(target.value);
        setDirty();
        renderQuestions();
      } else if (target.matches('[data-open]')) {
        draft.openAt = fromDatetimeLocal(target.value);
        setDirty();
        syncStatus();
      } else if (target.matches('[data-close]')) {
        draft.closeAt = fromDatetimeLocal(target.value);
        setDirty();
        syncStatus();
      } else if (target.matches('[data-show-progress]')) {
        draft.settings.showProgress = target.checked;
        setDirty();
      }
    });

    root.addEventListener('click', async event => {
      const target = event.target;
      const card = target.closest('[data-qid]');
      const question = card ? findQuestion(card.dataset.qid) : null;

      if (target.closest('[data-add-question]')) {
        draft.questions.push(newQuestion('radio'));
        setDirty();
        renderQuestions();
        const last = document.querySelector('.builder-questions .q-card:last-child');
        last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        last?.querySelector('[data-q-title]')?.focus();
        return;
      }
      if (target.closest('[data-add-section]')) {
        draft.questions.push(newQuestion('section'));
        setDirty();
        renderQuestions();
        const last = document.querySelector('.builder-questions .q-card:last-child');
        last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        last?.querySelector('[data-q-title]')?.focus();
        last?.querySelector('[data-q-title]')?.select();
        return;
      }
      if (target.closest('[data-add-content]')) {
        draft.questions.push(newQuestion('content'));
        setDirty();
        renderQuestions();
        const last = document.querySelector('.builder-questions .q-card:last-child');
        last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        last?.querySelector('[data-q-desc]')?.focus();
        return;
      }
      if (target.closest('[data-save]')) {
        await persist();
        return;
      }
      if (target.closest('[data-preview]')) {
        openPreview();
        return;
      }
      if (target.closest('[data-publish]')) {
        await togglePublish();
        return;
      }
      if (target.closest('[data-delete]')) {
        await handleDelete();
        return;
      }
      if (target.closest('[data-download-qr]')) {
        if (!draft.slug) return;
        try {
          await downloadQrCard({
            text: shareUrl(draft),
            title: draft.title,
            filename: `${safeFilename(draft.title)}-${draft.slug}`
          });
          toast('ดาวน์โหลด QR Code แล้ว', 'success');
        } catch (error) {
          toast(error?.message || 'ดาวน์โหลดไม่สำเร็จ', 'error');
        }
        return;
      }
      if (!question) return;

      if (target.closest('[data-remove-image]')) {
        question.image = null;
        setDirty();
        renderQuestions();
        return;
      }
      if (target.closest('[data-add-other]')) {
        question.other = true;
        question.otherLabel = 'อื่น ๆ';
        setDirty();
        renderQuestions();
        const otherInput = document.querySelector(`[data-qid="${question.id}"] [data-other-label]`);
        otherInput?.focus();
        otherInput?.select();
        return;
      }
      if (target.closest('[data-other-remove]')) {
        question.other = false;
        question.otherLabel = 'อื่น ๆ';
        setDirty();
        renderQuestions();
        return;
      }
      if (target.closest('[data-add-opt]')) {
        question.options.push(`ตัวเลือก ${question.options.length + 1}`);
        setDirty();
        renderQuestions();
        return;
      }
      const removeOption = target.closest('[data-opt-remove]');
      if (removeOption) {
        const index = Number(removeOption.dataset.optRemove);
        if (question.options.length <= 2) {
          toast('ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก', 'warning');
          return;
        }
        question.options.splice(index, 1);
        setDirty();
        renderQuestions();
        return;
      }
      if (target.closest('[data-duplicate]')) {
        const clone = normalizeQuestion({ ...question, id: uid('q'), title: question.title ? `${question.title} (สำเนา)` : '' });
        const index = draft.questions.indexOf(question);
        draft.questions.splice(index + 1, 0, clone);
        setDirty();
        renderQuestions();
        return;
      }
      if (target.closest('[data-remove-q]')) {
        if (draft.questions.length === 1) {
          toast('ต้องมีอย่างน้อย 1 คำถาม', 'warning');
          return;
        }
        const index = draft.questions.indexOf(question);
        draft.questions.splice(index, 1);
        setDirty();
        renderQuestions();
        return;
      }
      const move = target.closest('[data-move]');
      if (move) {
        const index = draft.questions.indexOf(question);
        const nextIndex = move.dataset.move === 'up' ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= draft.questions.length) return;
        [draft.questions[index], draft.questions[nextIndex]] = [draft.questions[nextIndex], draft.questions[index]];
        setDirty();
        renderQuestions();
      }
    });

    root.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        persist();
      }
    });

    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }

  function syncQuestionTypeIcon(qid) {
    const question = findQuestion(qid);
    const card = document.querySelector(`[data-qid="${qid}"]`);
    const iconWrap = card?.querySelector('.q-type__icon');
    if (question && iconWrap) iconWrap.innerHTML = icon(TYPE_ICON[question.type] || 'type', 16);
  }

  return { html, mount };
}
