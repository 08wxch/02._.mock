import { getPublicForm, submitResponse } from '../cloud.js';
import { icon } from '../icons.js';
import { e, thaiDateTime, relativeTime, formatNumber, pluralThai } from '../utils.js';
import {
  questionInputMarkup, normalizeQuestion, readAnswer, validateAnswer, answeredCount,
  buildPages, isAnswerable
} from '../questionRenderer.js';
import { toast } from '../ui.js';

function publicHeader() {
  return `<header class="public-topbar">
    <div class="public-brand">
      <span class="brand-mark" style="width:34px;height:34px"><img src="./assets/logo.jpg" alt=""></span>
      <span class="public-brand__words"><strong>02._.form</strong><small>แบบสอบถามออนไลน์</small></span>
    </div>
    <span class="public-topbar__note">${icon('lock', 12)} ไม่ต้องเข้าสู่ระบบ</span>
  </header>`;
}

function publicFooter() {
  return `<footer class="public-footer">
    <span>${icon('shield-check', 13)} คำตอบของคุณถูกส่งอย่างปลอดภัยและไม่ระบุตัวตน</span>
    <span>02._.form</span>
  </footer>`;
}

function statePage({ iconName, eyebrow, title, message, meta = '', tone = 'neutral' }) {
  return `${publicHeader()}
  <main class="public-main">
    <div class="public-state public-state--${tone}">
      <span class="public-state__icon">${icon(iconName, 30)}</span>
      <span class="eyebrow">${e(eyebrow)}</span>
      <h1>${e(title)}</h1>
      <p>${e(message)}</p>
      ${meta ? `<div class="public-state__meta">${meta}</div>` : ''}
      <div class="public-state__brand">${icon('sparkles', 13)} สร้างด้วย 02._.form</div>
    </div>
    ${publicFooter()}
  </main>`;
}

function notFoundPage() {
  return statePage({
    iconName: 'search',
    eyebrow: 'ไม่พบแบบสอบถาม',
    title: 'ลิงก์นี้อาจไม่ถูกต้อง',
    message: 'แบบสอบถามอาจถูกลบไปแล้ว หรือลิงก์ถูกคัดลอกมาไม่ครบ กรุณาตรวจสอบลิงก์อีกครั้ง',
    tone: 'neutral'
  });
}

function scheduledPage(form) {
  return statePage({
    iconName: 'calendar-clock',
    eyebrow: 'ยังไม่เปิดรับคำตอบ',
    title: form.title,
    message: form.description || 'แบบสอบถามนี้จะเปิดให้ตอบตามเวลาที่กำหนดไว้',
    meta: `<span>${icon('calendar', 14)} เปิด ${thaiDateTime(form.openAt)}</span><span>${icon('clock', 14)} ${relativeTime(form.openAt)}</span>`,
    tone: 'scheduled'
  });
}

function closedPage(form) {
  const closedAt = form.closeAt ? thaiDateTime(form.closeAt) : 'ที่ผ่านมา';
  return statePage({
    iconName: 'lock',
    eyebrow: 'ปิดรับคำตอบแล้ว',
    title: form.title,
    message: 'แบบสอบถามนี้ปิดรับคำตอบแล้ว ขอบคุณทุกคนที่สละเวลาร่วมตอบ',
    meta: `<span>${icon('calendar', 14)} ปิด ${closedAt}</span><span>${icon('users', 14)} ${formatNumber(form.responseCount || 0)} คำตอบ</span>`,
    tone: 'closed'
  });
}

function successPage(form) {
  const confirmation = form.settings?.confirmation || 'ขอบคุณที่สละเวลาตอบแบบสอบถาม ความคิดเห็นของคุณมีความหมายกับเรามาก';
  return `<div class="public-card public-card--success">
    <div class="success-mark">${icon('check', 34)}</div>
    <span class="eyebrow">ส่งคำตอบเรียบร้อย</span>
    <h1>ขอบคุณสำหรับคำตอบ</h1>
    <p>${e(confirmation)}</p>
    <div class="success-actions">
      <button class="btn btn--ghost" type="button" data-again>${icon('refresh', 15)} ส่งคำตอบอีกครั้ง</button>
    </div>
    <p class="success-note">${icon('shield-check', 12)} ระบบไม่บันทึกชื่อหรืออีเมลของผู้ตอบ</p>
  </div>`;
}

export async function publicView({ slug }) {
  const form = await getPublicForm(slug);
  if (!form) {
    return { html: `<div class="public-page">${notFoundPage()}</div>` };
  }
  if (form.state === 'scheduled') {
    return { html: `<div class="public-page">${scheduledPage(form)}</div>` };
  }
  if (form.state === 'closed') {
    return { html: `<div class="public-page">${closedPage(form)}</div>` };
  }

  const questions = (form.questions || []).map(normalizeQuestion);
  if (!questions.length) {
    return {
      html: `<div class="public-page">${statePage({
        iconName: 'clipboard-list',
        eyebrow: 'แบบสอบถามยังไม่พร้อม',
        title: form.title,
        message: 'ผู้สร้างยังไม่ได้เพิ่มคำถามในแบบสอบถามนี้ กรุณากลับมาใหม่อีกครั้ง',
        tone: 'neutral'
      })}</div>`
    };
  }

  const pages = buildPages(questions);
  const answerQuestions = questions.filter(question => isAnswerable(question.type));
  const sectionPages = pages.filter(page => page.section);
  const answerIndex = new Map(answerQuestions.map((question, index) => [question.id, index]));
  const minutes = Math.max(1, Math.ceil(answerQuestions.length * 0.6));

  const html = `<div class="public-page">
    ${publicHeader()}
    <main class="public-main">
      <div class="public-card" data-public-card>
        <div class="public-card__accent"></div>
        <div class="public-card__head">
          <span class="eyebrow">แบบสอบถาม</span>
          <h1>${e(form.title)}</h1>
          ${form.description ? `<p class="public-card__desc">${e(form.description)}</p>` : ''}
          <div class="public-meta">
            <span class="public-meta__owner">${icon('user', 13)} ${e(form.ownerName || 'ผู้สร้างแบบสอบถาม')}</span>
            <span>${icon('clipboard-list', 13)} ${pluralThai(answerQuestions.length, 'ข้อ')}</span>
            ${sectionPages.length ? `<span>${icon('layout-dashboard', 13)} ${pluralThai(sectionPages.length, 'ส่วน')}</span>` : ''}
            <span>${icon('clock', 13)} ประมาณ ${minutes} นาที</span>
            <span>${icon('shield-check', 13)} ไม่ระบุตัวตน</span>
          </div>
          ${form.closeAt ? `<div class="public-deadline">${icon('calendar-clock', 14)} เปิดรับถึง ${thaiDateTime(form.closeAt)}</div>` : ''}
        </div>

        <form class="public-form" data-public-form novalidate>
          ${form.settings?.showProgress && answerQuestions.length ? `<div class="public-progress" data-progress-wrap>
            <div class="public-progress__top"><span>ความคืบหน้า</span><strong data-progress-label>ตอบแล้ว 0 จาก ${answerQuestions.length} ข้อ</strong></div>
            <div class="public-progress__track"><span data-progress-bar style="width:0%"></span></div>
          </div>` : ''}

          <div class="public-pages" data-pages>
            ${pages.map((page, pageIndex) => {
              const sectionNumber = page.section ? sectionPages.indexOf(page) + 1 : 0;
              return `<section class="public-page-step" data-page="${pageIndex}" ${pageIndex ? 'hidden' : ''}>
                ${page.section ? `<header class="public-section-head">
                  <span class="public-section-head__eyebrow">${icon('layout-dashboard', 13)} ส่วนที่ ${sectionNumber} จาก ${sectionPages.length}</span>
                  <h2>${e(page.section.title || `ส่วนที่ ${sectionNumber}`)}</h2>
                  ${page.section.description ? `<p>${e(page.section.description)}</p>` : ''}
                </header>` : ''}
                <div class="public-questions">
                  ${page.items.map(item => questionInputMarkup(item, answerIndex.get(item.id) ?? 0, {})).join('')}
                </div>
              </section>`;
            }).join('')}
          </div>

          <div class="public-step-nav" data-step-nav ${pages.length > 1 ? '' : 'hidden'}>
            <button class="btn btn--ghost" type="button" data-prev>${icon('arrow-left', 15)} ย้อนกลับ</button>
            <span class="public-step-nav__label" data-page-label></span>
            <button class="btn btn--primary" type="button" data-next>ถัดไป ${icon('arrow-right', 15)}</button>
          </div>

          <div class="public-submit" data-submit-wrap ${pages.length > 1 ? 'hidden' : ''}>
            <button class="btn btn--primary btn--lg btn--wide" type="submit" data-submit>
              <span class="btn__label">${icon('send', 17)} ส่งคำตอบ</span>
              <span class="spinner spinner--sm" aria-hidden="true"></span>
            </button>
            <p class="public-submit__note">${icon('alert-circle', 12)} ตรวจสอบคำตอบก่อนกดส่ง — หลังส่งแล้วจะแก้ไขไม่ได้</p>
          </div>
        </form>
      </div>
      ${publicFooter()}
    </main>
  </div>`;

  function mount(root) {
    const formEl = root.querySelector('[data-public-form]');
    const card = root.querySelector('[data-public-card]');
    const submit = root.querySelector('[data-submit]');
    const submitWrap = root.querySelector('[data-submit-wrap]');
    const stepNav = root.querySelector('[data-step-nav]');
    const prev = root.querySelector('[data-prev]');
    const next = root.querySelector('[data-next]');
    const pageLabel = root.querySelector('[data-page-label]');
    const pageEls = [...root.querySelectorAll('[data-page]')];
    let currentPage = 0;
    if (!formEl) return null;

    const pageFor = question => question.closest('[data-page]');
    const pageIndexOf = element => pageEls.indexOf(element);
    const growOther = field => {
      if (!field) return;
      field.style.height = 'auto';
      field.style.height = `${Math.min(field.scrollHeight || 34, 160)}px`;
    };

    const showPage = (index, { scroll = true } = {}) => {
      currentPage = Math.max(0, Math.min(index, pages.length - 1));
      pageEls.forEach((page, pageIndex) => { page.hidden = pageIndex !== currentPage; });
      if (prev) prev.hidden = currentPage === 0;
      if (next) next.hidden = currentPage === pages.length - 1;
      if (submitWrap) submitWrap.hidden = currentPage !== pages.length - 1;
      if (stepNav) stepNav.hidden = pages.length <= 1;
      if (pageLabel) pageLabel.textContent = pages.length > 1 ? `หน้า ${currentPage + 1} จาก ${pages.length}` : '';
      pageEls[currentPage]?.querySelectorAll('[data-other-input]').forEach(growOther);
      if (scroll) card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const showErrors = errors => {
      formEl.querySelectorAll('.question').forEach(section => section.classList.remove('has-error'));
      Object.entries(errors).forEach(([qid, message]) => {
        const section = formEl.querySelector(`[data-qid="${qid}"]`);
        if (!section) return;
        section.classList.add('has-error');
        const slot = section.querySelector('.question__error span');
        if (slot) slot.textContent = message;
      });
      const first = formEl.querySelector('.question.has-error');
      if (!first) return;
      const page = pageFor(first);
      const index = pageIndexOf(page);
      if (index >= 0 && index !== currentPage) showPage(index, { scroll: false });
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const validateList = list => {
      const errors = {};
      list.forEach(question => {
        const value = readAnswer(formEl, question);
        const error = validateAnswer(question, value);
        if (error) errors[question.id] = error;
      });
      return errors;
    };

    const updateProgress = () => {
      if (!form.settings?.showProgress || !answerQuestions.length) return;
      const count = answeredCount(formEl, answerQuestions);
      const bar = root.querySelector('[data-progress-bar]');
      const label = root.querySelector('[data-progress-label]');
      if (bar) bar.style.width = `${Math.round((count / answerQuestions.length) * 100)}%`;
      if (label) label.textContent = `ตอบแล้ว ${count} จาก ${answerQuestions.length} ข้อ`;
    };

    formEl.addEventListener('input', event => {
      if (event.target.matches('[data-other-input]')) {
        growOther(event.target);
        const choice = formEl.querySelector(`[data-other-choice="${event.target.dataset.otherInput}"]`);
        if (choice) choice.checked = true;
      }
      const section = event.target.closest('.question');
      if (section) section.classList.remove('has-error');
      updateProgress();
    });
    formEl.addEventListener('change', event => {
      const section = event.target.closest('.question');
      if (section) section.classList.remove('has-error');
      updateProgress();
    });

    prev?.addEventListener('click', () => showPage(currentPage - 1));
    next?.addEventListener('click', () => {
      const pageQuestions = pages[currentPage].items.filter(question => isAnswerable(question.type));
      const errors = validateList(pageQuestions);
      if (Object.keys(errors).length) {
        showErrors(errors);
        toast('กรุณาตอบข้อที่จำเป็นในส่วนนี้ให้ครบก่อนไปต่อ', 'warning');
        return;
      }
      showPage(currentPage + 1);
    });

    formEl.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.target.tagName !== 'INPUT' || pages.length <= 1) return;
      event.preventDefault();
      if (currentPage < pages.length - 1) next?.click();
      else submit?.click();
    });

    formEl.addEventListener('submit', async event => {
      event.preventDefault();
      submit.classList.add('is-loading');
      submit.disabled = true;

      const answers = {};
      const errors = validateList(answerQuestions);
      answerQuestions.forEach(question => {
        if (!errors[question.id]) answers[question.id] = readAnswer(formEl, question);
      });

      if (Object.keys(errors).length) {
        showErrors(errors);
        toast('กรุณาตอบข้อที่จำเป็นให้ครบก่อนส่ง', 'warning');
        submit.classList.remove('is-loading');
        submit.disabled = false;
        return;
      }

      try {
        const result = await submitResponse(form.slug, answers);
        if (result?.ok) {
          card.outerHTML = successPage(form);
          document.querySelector('[data-again]')?.addEventListener('click', () => window.location.reload());
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (result?.error === 'closed' || result?.error === 'not_open' || result?.error === 'not_found') {
          window.location.reload();
          return;
        }
        if (result?.error === 'required') {
          const target = answerQuestions.find(question => question.title === result.question);
          if (target) showErrors({ [target.id]: 'ข้อนี้จำเป็นต้องตอบ' });
          toast('กรุณาตอบข้อที่จำเป็นให้ครบ', 'warning');
        } else {
          toast('ส่งคำตอบไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
        submit.classList.remove('is-loading');
        submit.disabled = false;
      } catch (error) {
        toast(error?.message || 'ส่งคำตอบไม่สำเร็จ กรุณาลองใหม่', 'error');
        submit.classList.remove('is-loading');
        submit.disabled = false;
      }
    });

    showPage(0, { scroll: false });
    updateProgress();
    return null;
  }

  return { html, mount };
}
