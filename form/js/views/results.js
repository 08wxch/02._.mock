import { getForm, listResponses, deleteResponse } from '../cloud.js';
import { workspaceShell, statusBadge } from '../layout.js';
import { icon } from '../icons.js';
import { toast, confirmDialog, emptyState, avatar } from '../ui.js';
import { openQrModal, shareUrl } from '../shareKit.js';
import { downloadQrCard } from '../qr.js';
import {
  e, thaiDateTime, relativeTime, formatNumber, percent, toCsv, downloadBlob,
  safeFilename, statusOf, windowLabel
} from '../utils.js';
import { normalizeQuestion } from '../questionRenderer.js';
import { TYPE_LABEL } from '../config.js';

function isAnswered(value) {
  return !(value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0));
}

function answerText(question, value) {
  if (!isAnswered(value)) return '';
  if (question.type === 'yesno') return value === true || value === 'true' ? 'ใช่' : 'ไม่ใช่';
  if (Array.isArray(value)) return value.join(' · ');
  return String(value);
}

function statsFor(questions, responses) {
  const total = responses.length;
  const complete = responses.filter(response => questions.every(question => isAnswered(response.answers?.[question.id]))).length;
  const last = responses[0]?.submittedAt || null;
  return { total, complete, last };
}

function summaryCard(question, responses) {
  const answers = responses.map(response => response.answers?.[question.id]);
  const answered = answers.filter(isAnswered);
  const base = answered.length;
  let body = '';

  if (question.type === 'radio' || question.type === 'dropdown' || question.type === 'checkbox' || question.type === 'yesno') {
    const counts = new Map();
    if (question.type === 'yesno') {
      counts.set('ใช่', 0);
      counts.set('ไม่ใช่', 0);
      answered.forEach(value => {
        const key = value === true || value === 'true' ? 'ใช่' : 'ไม่ใช่';
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    } else {
      const options = question.options?.length ? question.options : [];
      options.forEach(option => counts.set(String(option), 0));
      answered.forEach(value => {
        if (question.type === 'checkbox' && Array.isArray(value)) {
          value.forEach(item => counts.set(String(item), (counts.get(String(item)) || 0) + 1));
        } else {
          counts.set(String(value), (counts.get(String(value)) || 0) + 1);
        }
      });
    }
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map(row => row[1]));
    body = `<div class="bar-list">
      ${rows.map(([label, count], index) => `<div class="bar-row ${count === max && count > 0 ? 'is-top' : ''}">
        <div class="bar-row__head">
          <span class="bar-row__label">${question.type === 'checkbox' ? `<i class="bar-row__box"></i>` : `<i class="bar-row__dot">${String.fromCharCode(65 + (index % 26))}</i>`}${e(label)}</span>
          <span class="bar-row__value"><b>${formatNumber(count)}</b>${base ? `<small>${percent(count, base)}%</small>` : ''}</span>
        </div>
        <div class="bar-row__track"><span style="width:${count ? Math.max(3, (count / max) * 100) : 0}%"></span></div>
      </div>`).join('')}
    </div>`;
  } else if (question.type === 'rating') {
    const numbers = answered.map(Number).filter(n => !Number.isNaN(n));
    const scale = question.scale || 5;
    const average = numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
    const counts = Array.from({ length: scale }, (_, i) => numbers.filter(n => n === i + 1).length);
    const max = Math.max(1, ...counts);
    body = `<div class="rating-summary">
      <div class="rating-summary__score"><strong>${average ? average.toFixed(1) : '—'}</strong><span>จาก ${scale}<small>${formatNumber(numbers.length)} คำตอบ</small></span></div>
      <div class="rating-summary__bars">
        ${counts.map((count, index) => `<div class="rating-bar"><span>${index + 1}</span><div><i style="width:${count ? Math.max(4, (count / max) * 100) : 0}%"></i></div><b>${count}</b></div>`).join('')}
      </div>
    </div>`;
  } else {
    const items = responses
      .map(response => ({ value: response.answers?.[question.id], at: response.submittedAt }))
      .filter(item => isAnswered(item.value))
      .slice(0, 6);
    body = items.length ? `<div class="text-answers">
      ${items.map(item => `<div class="text-answer">
        <p>${e(answerText(question, item.value))}</p>
        <span>${relativeTime(item.at)}</span>
      </div>`).join('')}
      ${answered.length > 6 ? `<button class="text-answers__more" type="button" data-goto-responses>ดูคำตอบทั้งหมด ${formatNumber(answered.length)} รายการ ${icon('arrow-right', 13)}</button>` : ''}
    </div>` : `<p class="summary-empty">${icon('inbox', 15)} ยังไม่มีคำตอบสำหรับข้อนี้</p>`;
  }

  return `<section class="summary-card">
    <div class="summary-card__head">
      <div>
        <span class="summary-card__type">${icon('clipboard-list', 12)} ${e(TYPE_LABEL[question.type] || 'คำถาม')}${question.required ? ' · จำเป็น' : ''}</span>
        <h3>${e(question.title)}</h3>
      </div>
      <span class="summary-card__count">${formatNumber(answered.length)}<small>/${responses.length} ตอบ</small></span>
    </div>
    ${body}
  </section>`;
}

function responseCard(response, number, questions) {
  const complete = questions.every(question => isAnswered(response.answers?.[question.id]));
  return `<details class="response-card">
    <summary class="response-card__head">
      <span class="response-card__num">#${formatNumber(number)}</span>
      <span class="response-card__time">${icon('clock', 13)} ${thaiDateTime(response.submittedAt, true)}</span>
      <span class="response-card__badge ${complete ? 'is-complete' : ''}">${complete ? 'ตอบครบ' : 'ตอบไม่ครบ'}</span>
      <span class="response-card__chevron">${icon('chevron-down', 16)}</span>
    </summary>
    <div class="response-card__body">
      ${questions.map((question, questionIndex) => `<div class="response-answer ${isAnswered(response.answers?.[question.id]) ? '' : 'is-empty'}">
        <span class="response-answer__q"><i>${String(questionIndex + 1).padStart(2, '0')}</i>${e(question.title)}</span>
        <span class="response-answer__a">${isAnswered(response.answers?.[question.id]) ? e(answerText(question, response.answers[question.id])) : '— ไม่ได้ตอบ —'}</span>
      </div>`).join('')}
      <div class="response-card__foot">
        <span>${icon('shield-check', 12)} ไม่ระบุตัวตนผู้ตอบ</span>
        <button class="response-card__delete" type="button" data-delete-response="${response.id}">${icon('trash', 13)} ลบคำตอบนี้</button>
      </div>
    </div>
  </details>`;
}

export async function resultsView({ session, formId }) {
  const form = await getForm(formId);
  const canAccess = form.ownerId === session.userId || session.isAdmin;
  if (!canAccess) {
    return {
      html: workspaceShell({
        session,
        back: '#/',
        crumb: 'ผลคำตอบ',
        title: form.title,
        content: `<div class="fatal fatal--inline">
          <span class="fatal__icon">${icon('lock', 26)}</span>
          <h1>ไม่มีสิทธิ์ดูผลคำตอบ</h1>
          <p>ผลคำตอบจะแสดงเฉพาะเจ้าของแบบสอบถามและผู้ดูแลระบบเท่านั้น</p>
          <a class="btn btn--primary" href="#/">กลับแดชบอร์ด</a>
        </div>`
      })
    };
  }

  const questions = (form.questions || []).map(normalizeQuestion);
  let responses = await listResponses(formId);
  let tab = 'summary';
  let search = '';

  const actions = `<button class="btn btn--ghost btn--sm" type="button" data-refresh title="รีเฟรชคำตอบ" aria-label="รีเฟรชคำตอบ">${icon('refresh', 15)} รีเฟรช</button>
    <button class="btn btn--ghost btn--sm" type="button" data-export title="ดาวน์โหลดคำตอบเป็น CSV" aria-label="ดาวน์โหลดคำตอบเป็น CSV">${icon('download', 15)} ดาวน์โหลด CSV</button>
    <button class="btn btn--primary btn--sm" type="button" data-qr>${icon('qr', 15)} แชร์</button>`;

  const content = `<div class="results" data-results>
    <header class="results-head">
      <div class="results-head__copy">
        <span class="eyebrow">ผลตอบรับ</span>
        <h1>${e(form.title)}</h1>
        <div class="results-head__meta">
          <span class="results-owner">${avatar(form.ownerName || session.name, 26)} ${e(form.ownerName || session.name)}</span>
          ${statusBadge(statusOf(form).key)}
          <span>${icon('calendar-clock', 13)} ${e(windowLabel(form))}</span>
        </div>
      </div>
      <div class="results-head__actions">
        <a class="btn btn--ghost btn--sm" href="#/forms/${form.id}/edit">${icon('edit', 15)} แก้ไข</a>
        <a class="btn btn--ghost btn--sm" href="${shareUrl(form)}" target="_blank" rel="noopener">${icon('external-link', 15)} เปิดฟอร์ม</a>
      </div>
    </header>

    <section class="stat-row stat-row--results" data-stat-row></section>

    <div class="results-bar">
      <div class="results-tabs" role="tablist">
        <button class="results-tab is-active" type="button" data-tab="summary">${icon('bar-chart', 15)} สรุปผล</button>
        <button class="results-tab" type="button" data-tab="responses">${icon('clipboard-list', 15)} คำตอบทั้งหมด <span data-tab-count></span></button>
      </div>
      <div class="results-search" data-search-wrap>
        ${icon('search', 15)}
        <input type="search" data-response-search placeholder="ค้นหาในคำตอบ…" aria-label="ค้นหาในคำตอบ">
      </div>
    </div>

    <section data-summary></section>
    <section data-responses hidden></section>
    <div data-empty></div>
  </div>`;

  const html = workspaceShell({
    session,
    back: '#/',
    crumb: 'ผลคำตอบ',
    title: form.title,
    actions,
    content,
    wide: true
  });

  function renderStats() {
    const row = document.querySelector('[data-stat-row]');
    if (!row) return;
    const stats = statsFor(questions, responses);
    row.innerHTML = `
      <div class="stat-card"><span class="stat-card__icon stat-card__icon--gold">${icon('inbox', 18)}</span><div><span class="stat-card__label">คำตอบทั้งหมด</span><strong>${formatNumber(stats.total)}</strong><small>ไม่ระบุตัวตนผู้ตอบ</small></div></div>
      <div class="stat-card"><span class="stat-card__icon stat-card__icon--green">${icon('check-circle', 18)}</span><div><span class="stat-card__label">ตอบครบทุกข้อ</span><strong>${stats.total ? percent(stats.complete, stats.total) : 0}%</strong><small>${formatNumber(stats.complete)} จาก ${formatNumber(stats.total)} ชุด</small></div></div>
      <div class="stat-card"><span class="stat-card__icon stat-card__icon--ink">${icon('clipboard-list', 18)}</span><div><span class="stat-card__label">จำนวนคำถาม</span><strong>${formatNumber(questions.length)}</strong><small>ข้อในแบบสอบถามนี้</small></div></div>
      <div class="stat-card"><span class="stat-card__icon stat-card__icon--blue">${icon('clock', 18)}</span><div><span class="stat-card__label">คำตอบล่าสุด</span><strong>${stats.last ? relativeTime(stats.last) : '—'}</strong><small>${stats.last ? thaiDateTime(stats.last) : 'ยังไม่มีคำตอบ'}</small></div></div>`;
  }

  function renderSummary() {
    const target = document.querySelector('[data-summary]');
    const empty = document.querySelector('[data-empty]');
    if (!target) return;
    if (!responses.length) {
      target.innerHTML = '';
      empty.innerHTML = emptyState({
        iconName: 'inbox',
        title: 'ยังไม่มีผู้ตอบแบบสอบถาม',
        message: 'แชร์ลิงก์หรือ QR Code ให้ผู้ตอบ — คำตอบจะปรากฏที่นี่ทันที',
        action: `<div class="empty-actions">
          <button class="btn btn--primary" type="button" data-qr>${icon('qr', 15)} แชร์ QR Code</button>
          <button class="btn btn--ghost" type="button" data-copy-text="${e(shareUrl(form))}">${icon('copy', 15)} คัดลอกลิงก์</button>
        </div>`
      });
      return;
    }
    empty.innerHTML = '';
    target.innerHTML = `<div class="summary-list">
      ${questions.map(question => summaryCard(question, responses)).join('')}
    </div>`;
    target.querySelectorAll('[data-goto-responses]').forEach(btn => btn.addEventListener('click', () => switchTab('responses')));
  }

  function filteredResponses() {
    if (!search) return responses;
    const needle = search.toLowerCase();
    return responses.filter(response => questions.some(question => {
      const text = answerText(question, response.answers?.[question.id]).toLowerCase();
      return text.includes(needle);
    }));
  }

  function renderResponses() {
    const target = document.querySelector('[data-responses]');
    if (!target) return;
    const list = filteredResponses();
    const count = document.querySelector('[data-tab-count]');
    if (count) count.textContent = formatNumber(responses.length);
    if (!responses.length) {
      target.innerHTML = '';
      return;
    }
    if (!list.length) {
      target.innerHTML = `<div class="empty-wrap">${emptyState({ iconName: 'search', title: 'ไม่พบคำตอบที่ค้นหา', message: 'ลองใช้คำอื่น หรือล้างช่องค้นหา' })}</div>`;
      return;
    }
    target.innerHTML = `<div class="response-list">
      ${list.map(response => responseCard(response, responses.length - responses.indexOf(response), questions)).join('')}
    </div>`;
    target.querySelectorAll('[data-delete-response]').forEach(btn => btn.addEventListener('click', async event => {
      event.preventDefault();
      const id = btn.dataset.deleteResponse;
      const ok = await confirmDialog({
        title: 'ลบคำตอบนี้?',
        message: 'คำตอบนี้จะถูกลบอย่างถาวรและไม่สามารถกู้คืนได้',
        confirmText: 'ลบคำตอบ',
        onConfirm: async () => {
          await deleteResponse(formId, id);
          responses = responses.filter(item => item.id !== id);
          toast('ลบคำตอบแล้ว', 'success');
        }
      });
      if (ok) {
        renderStats();
        renderSummary();
        renderResponses();
        if (tab === 'summary') switchTab('summary');
      }
    }));
  }

  function switchTab(next) {
    tab = next;
    document.querySelectorAll('[data-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tab === tab));
    const summary = document.querySelector('[data-summary]');
    const responseSection = document.querySelector('[data-responses]');
    const searchWrap = document.querySelector('[data-search-wrap]');
    if (summary) summary.hidden = tab !== 'summary';
    if (responseSection) responseSection.hidden = tab !== 'responses';
    if (searchWrap) searchWrap.hidden = tab !== 'responses';
    document.querySelector('[data-empty]')?.classList.toggle('is-hidden', responses.length > 0);
  }

  function exportCsv(showToast = true) {
    if (!responses.length) {
      if (showToast) toast('ยังไม่มีคำตอบให้ดาวน์โหลด', 'warning');
      return;
    }
    const header = ['ลำดับ', 'วันเวลาที่ส่ง', ...questions.map((question, index) => `ข้อ ${index + 1}: ${question.title}`)];
    const rows = responses.map((response, index) => [
      responses.length - index,
      thaiDateTime(response.submittedAt, true),
      ...questions.map(question => answerText(question, response.answers?.[question.id]))
    ]);
    const csv = `\uFEFF${toCsv([header, ...rows])}`;
    downloadBlob(`${safeFilename(form.title)}-responses.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    if (showToast) toast('ดาวน์โหลด CSV แล้ว', 'success');
  }

  function mount(root) {
    renderStats();
    renderSummary();
    renderResponses();
    switchTab('summary');

    root.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

    root.querySelector('[data-refresh]')?.addEventListener('click', async event => {
      const btn = event.currentTarget;
      btn.disabled = true;
      btn.classList.add('is-loading');
      try {
        responses = await listResponses(formId);
        renderStats();
        renderSummary();
        renderResponses();
        switchTab(tab);
        toast('อัปเดตคำตอบล่าสุดแล้ว', 'success');
      } catch (error) {
        toast(error?.message || 'รีเฟรชไม่สำเร็จ', 'error');
      } finally {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    });

    root.querySelector('[data-export]')?.addEventListener('click', () => exportCsv());
    root.addEventListener('click', event => {
      if (event.target.closest('[data-qr]')) openQrModal(form);
    });

    let searchTimer = null;
    root.querySelector('[data-response-search]')?.addEventListener('input', event => {
      clearTimeout(searchTimer);
      const value = event.target.value;
      searchTimer = setTimeout(() => {
        search = value.trim();
        renderResponses();
      }, 160);
    });

    return () => clearTimeout(searchTimer);
  }

  return { html, mount };
}
