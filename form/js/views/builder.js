import { getForm, createForm, updateForm, deleteForm } from '../cloud.js';
import { workspaceShell, statusBadge } from '../layout.js';
import { QUESTION_TYPES, TYPE_ICON } from '../config.js';
import { icon } from '../icons.js';
import { toast, confirmDialog, openModal, avatar } from '../ui.js';
import { qrSvg, downloadQrCard } from '../qr.js';
import { shareUrl } from '../shareKit.js';
import {
  e, uid, datetimeLocalValue, fromDatetimeLocal, statusOf, thaiDateTime, safeFilename, formatNumber
} from '../utils.js';
import { questionInputMarkup, normalizeQuestion, isChoice, newQuestion } from '../questionRenderer.js';
import { navigate } from '../app.js';

const DEFAULT_CONFIRMATION = 'ขอบคุณที่สละเวลาตอบแบบสอบถาม ความคิดเห็นของคุณมีความหมายกับเรามาก';

function typeOptions(selected) {
  return QUESTION_TYPES.map(type => `<option value="${type.value}" ${type.value === selected ? 'selected' : ''}>${type.label}</option>`).join('');
}

function optionRows(question) {
  const options = question.options.length ? question.options : ['', ''];
  return `<div class="opt-list" data-opt-list>
    ${options.map((option, index) => `<div class="opt-row">
      <span class="opt-row__mark">${question.type === 'checkbox' ? icon('check', 11) : String.fromCharCode(65 + index)}</span>
      <input class="opt-row__input" type="text" value="${e(option)}" data-opt="${index}" placeholder="ตัวเลือกที่ ${index + 1}" aria-label="ตัวเลือกที่ ${index + 1}">
      <button class="icon-btn icon-btn--quiet opt-row__remove" type="button" data-opt-remove="${index}" aria-label="ลบตัวเลือก" ${options.length <= 2 ? 'disabled' : ''}>${icon('x', 15)}</button>
    </div>`).join('')}
    <button class="opt-add" type="button" data-add-opt>${icon('plus', 15)} เพิ่มตัวเลือก</button>
  </div>`;
}

function typeEditor(question) {
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

function questionCard(question, index, total) {
  return `<article class="q-card" data-qid="${question.id}">
    <div class="q-card__top">
      <span class="q-card__num">${String(index + 1).padStart(2, '0')}</span>
      <label class="q-type">
        <span class="q-type__icon">${icon(TYPE_ICON[question.type] || 'type', 16)}</span>
        <select data-q-type aria-label="ประเภทคำถาม">${typeOptions(question.type)}</select>
        ${icon('chevron-down', 13)}
      </label>
      <label class="switch switch--compact">
        <input type="checkbox" data-q-required ${question.required ? 'checked' : ''}>
        <span class="switch__track"></span>
        <span class="switch__label">จำเป็น</span>
      </label>
      <div class="q-card__tools">
        <button class="icon-btn icon-btn--quiet" type="button" data-move="up" aria-label="เลื่อนขึ้น" ${index === 0 ? 'disabled' : ''}>${icon('arrow-up', 15)}</button>
        <button class="icon-btn icon-btn--quiet" type="button" data-move="down" aria-label="เลื่อนลง" ${index === total - 1 ? 'disabled' : ''}>${icon('arrow-down', 15)}</button>
        <button class="icon-btn icon-btn--quiet" type="button" data-duplicate aria-label="ทำสำเนาคำถาม">${icon('duplicate', 15)}</button>
        <button class="icon-btn icon-btn--quiet icon-btn--danger" type="button" data-remove-q aria-label="ลบคำถาม">${icon('trash', 15)}</button>
      </div>
    </div>
    <div class="q-card__body">
      <textarea class="q-title-input" data-q-title rows="1" placeholder="พิมพ์คำถามของคุณ…">${e(question.title)}</textarea>
      <input class="q-desc-input" type="text" data-q-desc value="${e(question.description)}" placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)" aria-label="คำอธิบายเพิ่มเติม">
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
            <span>${icon('clipboard-list', 14)} <b data-q-count>${formatNumber(draft.questions.length)}</b> ข้อ</span>
            ${existing ? `<span>${icon('inbox', 14)} ${formatNumber(draft.responseCount)} คำตอบ</span>` : ''}
            <span class="builder-head__status" data-head-status>${statusBadge(statusOf(draft).key)}</span>
          </div>
        </section>

        <div class="builder-questions" data-questions></div>

        <button class="add-question" type="button" data-add-question>
          <span class="add-question__icon">${icon('plus', 20)}</span>
          <span><strong>เพิ่มคำถาม</strong><small>เลือกประเภทคำถามได้ภายหลัง</small></span>
        </button>

        <p class="builder-tip">${icon('info', 14)} ข้อที่มีเครื่องหมาย <b>*</b> คือข้อบังคับ ผู้ตอบจะส่งแบบสอบถามไม่ได้จนกว่าจะตอบครบ</p>
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
    wrap.innerHTML = draft.questions.map((question, index) => questionCard(question, index, draft.questions.length)).join('');
    const count = document.querySelector('[data-q-count]');
    if (count) count.textContent = formatNumber(draft.questions.length);
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
    for (let i = 0; i < draft.questions.length; i += 1) {
      const question = draft.questions[i];
      question.title = question.title.trim();
      if (!question.title) {
        toast(`ข้อ ${i + 1} ยังไม่มีข้อความคำถาม`, 'warning');
        const card = document.querySelector(`[data-qid="${question.id}"]`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card?.querySelector('[data-q-title]')?.focus();
        return false;
      }
      if (isChoice(question.type)) {
        question.options = question.options.map(option => option.trim()).filter(Boolean);
        if (question.options.length < 2) {
          toast(`ข้อ ${i + 1} ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก`, 'warning');
          return false;
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
    return draft.questions.map(question => ({
      id: question.id,
      type: question.type,
      title: question.title.trim(),
      description: question.description.trim(),
      required: Boolean(question.required),
      options: isChoice(question.type) ? question.options.map(option => option.trim()).filter(Boolean) : [],
      ...(question.type === 'rating' ? { scale: Number(question.scale) || 5 } : {})
    }));
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
    const body = `<div class="preview-shell">
      <div class="preview-banner">${icon('eye', 15)} ตัวอย่างหน้าผู้ตอบ — ยังไม่บันทึกการเปลี่ยนแปลง</div>
      <div class="preview-page">
        <div class="preview-page__accent"></div>
        <h2>${e(draft.title || 'ชื่อแบบสอบถาม')}</h2>
        ${draft.description ? `<p>${e(draft.description)}</p>` : ''}
        <div class="preview-page__meta">${icon('clipboard-list', 13)} ${questions.length} ข้อ ${draft.openAt ? `· เปิด ${thaiDateTime(draft.openAt)}` : ''}</div>
        <div class="preview-questions">
          ${questions.map((question, index) => questionInputMarkup(question, index, { preview: true })).join('')}
        </div>
        <button class="btn btn--primary btn--wide" type="button" disabled>ส่งคำตอบ</button>
        <p class="preview-page__note">${icon('lock', 12)} ผู้ตอบไม่ต้องเข้าสู่ระบบ และระบบไม่เก็บชื่อผู้อตอบ</p>
      </div>
    </div>`;
    openModal({
      title: 'ตัวอย่างแบบสอบถาม',
      eyebrow: 'พรีวิว',
      size: 'lg',
      body,
      footer: `<button class="btn btn--ghost" type="button" data-modal-dismiss>ปิดตัวอย่าง</button>`
    });
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
      } else if (target.matches('[data-confirmation]')) {
        draft.settings.confirmation = target.value;
        setDirty();
      }
    });

    root.addEventListener('change', event => {
      const target = event.target;
      if (target.matches('[data-q-type]')) {
        const card = target.closest('[data-qid]');
        const question = findQuestion(card?.dataset.qid);
        if (!question) return;
        question.type = target.value;
        if (isChoice(question.type)) {
          if (!question.options.length) question.options = ['ตัวเลือก 1', 'ตัวเลือก 2'];
        } else if (question.type !== 'yesno') {
          question.options = [];
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
