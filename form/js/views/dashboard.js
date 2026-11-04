import { listForms, listPeople, deleteForm } from '../cloud.js';
import { icon } from '../icons.js';
import { avatar, toast, confirmDialog, emptyState } from '../ui.js';
import { openQrModal, openShareModal, shareUrl } from '../shareKit.js';
import { statusBadge } from '../layout.js';
import {
  e, statusOf, windowLabel, formatNumber, relativeTime, thaiDate, publicLink
} from '../utils.js';

function creatorOptions(people, session) {
  const unique = new Map();
  people.forEach(person => unique.set(person.userId, person));
  unique.set(session.userId, unique.get(session.userId) || { userId: session.userId, name: session.name, isAdmin: session.isAdmin });
  return [...unique.values()].sort((a, b) => {
    if (a.userId === session.userId) return -1;
    if (b.userId === session.userId) return 1;
    return a.name.localeCompare(b.name, 'th');
  });
}

function ownsForm(form, session) {
  return form.ownerId === session.userId;
}

function canSeeResults(form, session) {
  return ownsForm(form, session) || session.isAdmin;
}

function cardMarkup(form, session, peopleById) {
  const meta = statusOf(form);
  const owner = peopleById.get(form.ownerId) || { name: form.ownerName };
  const results = canSeeResults(form, session);
  const editable = ownsForm(form, session) || session.isAdmin;
  const questions = form.questions?.length || 0;
  const responses = Number(form.responseCount || 0);
  const detailHref = results ? `#/forms/${form.id}/results` : publicLink(form.slug);
  const detailAttrs = results ? '' : ' target="_blank" rel="noopener"';
  const menu = `
    <div class="card-menu" data-menu hidden>
      ${results ? `<a class="card-menu__item" href="#/forms/${form.id}/results">${icon('bar-chart', 15)} ดูผลคำตอบ</a>` : ''}
      ${editable ? `<a class="card-menu__item" href="#/forms/${form.id}/edit">${icon('edit', 15)} แก้ไขแบบสอบถาม</a>` : ''}
      ${form.status !== 'draft' ? `<a class="card-menu__item" href="${shareUrl(form)}" target="_blank" rel="noopener">${icon('external-link', 15)} เปิดลิงก์ผู้ตอบ</a>` : ''}
      <button class="card-menu__item" type="button" data-copy-text="${e(shareUrl(form))}">${icon('copy', 15)} คัดลอกลิงก์</button>
      <button class="card-menu__item" type="button" data-qr="${form.id}">${icon('qr', 15)} QR Code</button>
      ${editable ? `<span class="card-menu__sep"></span><button class="card-menu__item card-menu__item--danger" type="button" data-delete="${form.id}">${icon('trash', 15)} ลบแบบสอบถาม</button>` : ''}
    </div>`;

  return `<article class="form-card" data-id="${form.id}">
    <div class="form-card__accent"></div>
    <div class="form-card__top">
      ${statusBadge(meta.key)}
      <div class="card-menu-wrap">
        <button class="icon-btn icon-btn--quiet" type="button" data-menu-toggle aria-label="ตัวเลือกเพิ่มเติม">${icon('more-horizontal', 18)}</button>
        ${menu}
      </div>
    </div>
    <a class="form-card__body" href="${detailHref}"${detailAttrs}>
      <h3>${e(form.title || 'แบบสอบถามไม่มีชื่อ')}</h3>
      <p>${e(form.description || 'ยังไม่มีคำอธิบาย — เพิ่มคำอธิบายเพื่อให้ผู้ตอบเข้าใจวัตถุประสงค์มากขึ้น')}</p>
    </a>
    <div class="form-card__owner">
      ${avatar(owner.name || form.ownerName || '?', 24)}
      <span>${e(owner.name || form.ownerName || 'ไม่ระบุผู้สร้าง')}</span>
      <i>·</i>
      <span>${formatNumber(questions)} ข้อ</span>
    </div>
    <div class="form-card__meta">
      <span class="form-card__stat ${responses ? 'is-active' : ''}">${icon('users', 14)} ${formatNumber(responses)} คำตอบ</span>
      <span class="form-card__when" title="${e(windowLabel(form))}">${icon('calendar-clock', 14)} ${e(windowLabel(form))}</span>
    </div>
    <div class="form-card__foot">
      <button class="form-card__action" type="button" data-copy-text="${e(shareUrl(form))}">${icon('link', 15)} คัดลอกลิงก์</button>
      <button class="form-card__action" type="button" data-qr="${form.id}">${icon('qr', 15)} QR</button>
      <a class="form-card__cta" href="${detailHref}"${detailAttrs}>${results ? 'ดูผล' : 'เปิดดู'} ${icon('arrow-up-right', 14)}</a>
    </div>
  </article>`;
}

export async function dashboardView({ session, scope = 'own', creatorId = null }) {
  const [allForms, people] = await Promise.all([listForms(), listPeople()]);
  const forms = allForms.filter(form => session.isAdmin || form.status !== 'draft' || form.ownerId === session.userId);
  const peopleById = new Map(people.map(person => [person.userId, person]));
  forms.forEach(form => {
    if (!peopleById.has(form.ownerId)) {
      peopleById.set(form.ownerId, { userId: form.ownerId, name: form.ownerName || 'ไม่ระบุผู้สร้าง', isAdmin: false });
    }
  });
  const creators = creatorOptions(people, session);

  const state = {
    scope: creatorId ? (creatorId === session.userId ? 'own' : 'person') : scope,
    creatorId: creatorId || (scope === 'all' ? 'all' : session.userId),
    status: 'all',
    search: ''
  };

  const firstName = String(session.name || '').trim().split(/\s+/)[0] || session.name;

  const html = `<div class="dashboard">
    <header class="dash-hero">
      <div class="dash-hero__copy">
        <span class="eyebrow">ศูนย์จัดการแบบสอบถาม</span>
        <h1>สวัสดี ${e(firstName)} <span class="dash-hero__wave">✦</span></h1>
        <p>สร้างแบบสอบถาม แชร์ด้วยลิงก์หรือ QR Code และติดตามคำตอบได้จากที่เดียว</p>
      </div>
      <div class="dash-hero__actions">
        <a class="btn btn--ghost" href="#/accounts">${icon('users', 16)} ${session.isAdmin ? 'จัดการบัญชี' : 'บัญชีของฉัน'}</a>
        <a class="btn btn--primary btn--lg" href="#/forms/new">${icon('plus', 17)} สร้างแบบสอบถาม</a>
      </div>
    </header>

    <section class="stat-row" aria-label="ภาพรวม">
      <div class="stat-card">
        <span class="stat-card__icon stat-card__icon--ink">${icon('clipboard-list', 18)}</span>
        <div><span class="stat-card__label">แบบสอบถาม</span><strong data-stat="forms">—</strong><small data-stat-sub="forms">ในมุมมองนี้</small></div>
      </div>
      <div class="stat-card">
        <span class="stat-card__icon stat-card__icon--gold">${icon('inbox', 18)}</span>
        <div><span class="stat-card__label">คำตอบทั้งหมด</span><strong data-stat="responses">—</strong><small data-stat-sub="responses">นับรวมทุกฟอร์ม</small></div>
      </div>
      <div class="stat-card">
        <span class="stat-card__icon stat-card__icon--green">${icon('circle-check-big', 18)}</span>
        <div><span class="stat-card__label">กำลังเปิดรับ</span><strong data-stat="open">—</strong><small data-stat-sub="open">พร้อมให้ผู้ตอบเข้าถึง</small></div>
      </div>
      <div class="stat-card">
        <span class="stat-card__icon stat-card__icon--blue">${icon('clock', 18)}</span>
        <div><span class="stat-card__label">คำตอบล่าสุด</span><strong data-stat="last">—</strong><small data-stat-sub="last">ความเคลื่อนไหวล่าสุด</small></div>
      </div>
    </section>

    <section class="toolbar" aria-label="ตัวกรอง">
      <div class="scope-switch" role="group" aria-label="ขอบเขตแบบสอบถาม">
        <button class="scope-switch__btn" type="button" data-scope="own">${icon('user', 15)} ของฉัน</button>
        <button class="scope-switch__btn" type="button" data-scope="all">${icon('users', 15)} ทั้งหมด</button>
      </div>

      <label class="select-control">
        ${icon('filter', 15)}
        <select data-creator aria-label="เลือกผู้สร้าง">
          <option value="all">ผู้สร้างทุกคน</option>
          ${creators.map(person => `<option value="${person.userId}">${e(person.name)}${person.isAdmin ? ' (ผู้ดูแล)' : ''}</option>`).join('')}
        </select>
        ${icon('chevron-down', 14)}
      </label>

      <div class="search-control">
        ${icon('search', 16)}
        <input type="search" data-search placeholder="ค้นหาชื่อแบบสอบถาม…" aria-label="ค้นหาแบบสอบถาม">
      </div>
    </section>

    <div class="status-tabs" role="tablist" aria-label="สถานะ">
      <button class="status-tab is-active" type="button" data-status="all">ทั้งหมด</button>
      <button class="status-tab" type="button" data-status="open">กำลังเปิดรับ</button>
      <button class="status-tab" type="button" data-status="scheduled">กำหนดเปิด</button>
      <button class="status-tab" type="button" data-status="closed">ปิดรับ</button>
      <button class="status-tab" type="button" data-status="draft">ฉบับร่าง</button>
      <span class="status-tabs__count" data-count-label></span>
    </div>

    <section class="form-section">
      <div class="form-grid" data-form-grid></div>
      <div data-empty></div>
    </section>
  </div>`;

  function filtered() {
    return forms.filter(form => {
      if (state.scope === 'own' && form.ownerId !== session.userId) return false;
      if (state.scope === 'person' && form.ownerId !== state.creatorId) return false;
      const meta = statusOf(form);
      if (state.status !== 'all' && meta.key !== state.status) return false;
      if (state.search) {
        const haystack = `${form.title} ${form.description} ${form.ownerName}`.toLowerCase();
        if (!haystack.includes(state.search.toLowerCase())) return false;
      }
      return true;
    });
  }

  function updateStats(list) {
    const totalResponses = list.reduce((sum, form) => sum + Number(form.responseCount || 0), 0);
    const open = list.filter(form => statusOf(form).key === 'open').length;
    const last = list.map(form => form.lastResponseAt).filter(Boolean).sort().pop();
    const set = (key, value) => {
      const node = document.querySelector(`[data-stat="${key}"]`);
      if (node) node.textContent = value;
    };
    set('forms', formatNumber(list.length));
    set('responses', formatNumber(totalResponses));
    set('open', formatNumber(open));
    set('last', last ? relativeTime(last) : '—');
    const sub = document.querySelector('[data-stat-sub="forms"]');
    if (sub) sub.textContent = state.scope === 'all' ? 'จากทุกผู้สร้าง' : state.scope === 'own' ? 'เฉพาะของคุณ' : 'เฉพาะผู้สร้างที่เลือก';
  }

  function renderList() {
    const list = filtered();
    updateStats(list);
    const grid = document.querySelector('[data-form-grid]');
    const empty = document.querySelector('[data-empty]');
    const countLabel = document.querySelector('[data-count-label]');
    if (countLabel) countLabel.textContent = `${formatNumber(list.length)} รายการ`;
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = '';
      const isFiltered = forms.length > 0;
      empty.innerHTML = `<div class="empty-wrap">
        ${emptyState({
          iconName: isFiltered ? 'search' : 'clipboard-list',
          title: isFiltered ? 'ไม่พบแบบสอบถามที่ตรงกับตัวกรอง' : 'ยังไม่มีแบบสอบถามในมุมมองนี้',
          message: isFiltered
            ? 'ลองเปลี่ยนผู้สร้าง เปลี่ยนสถานะ หรือล้างคำค้นหา'
            : state.scope === 'own'
              ? 'เริ่มสร้างแบบสอบถามแรกของคุณ แล้วแชร์ลิงก์ให้ผู้ตอบได้ทันที'
              : 'ยังไม่มีใครสร้างแบบสอบถามในระบบ',
          action: isFiltered
            ? `<button class="btn btn--ghost" type="button" data-reset-filter>${icon('refresh', 15)} ล้างตัวกรอง</button>`
            : `<a class="btn btn--primary" href="#/forms/new">${icon('plus', 16)} สร้างแบบสอบถาม</a>`
        })}
      </div>`;
      empty.querySelector('[data-reset-filter]')?.addEventListener('click', () => {
        state.scope = 'own';
        state.creatorId = session.userId;
        state.status = 'all';
        state.search = '';
        syncControls();
        renderList();
      });
      return;
    }
    empty.innerHTML = '';
    grid.innerHTML = list.map(form => cardMarkup(form, session, peopleById)).join('');
  }

  function syncControls() {
    document.querySelectorAll('[data-scope]').forEach(btn => {
      const activeScope = state.scope === 'person' ? 'all' : state.scope;
      btn.classList.toggle('is-active', btn.dataset.scope === activeScope);
    });
    const select = document.querySelector('[data-creator]');
    if (select) select.value = state.scope === 'all' ? 'all' : state.creatorId;
    document.querySelectorAll('[data-status]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.status === state.status);
    });
    const search = document.querySelector('[data-search]');
    if (search && search.value !== state.search) search.value = state.search;
  }

  function mount(root) {
    syncControls();
    renderList();

    root.querySelectorAll('[data-scope]').forEach(btn => btn.addEventListener('click', () => {
      state.scope = btn.dataset.scope;
      state.creatorId = state.scope === 'own' ? session.userId : 'all';
      syncControls();
      renderList();
    }));

    root.querySelector('[data-creator]')?.addEventListener('change', event => {
      const value = event.target.value;
      if (value === 'all') {
        state.scope = 'all';
        state.creatorId = 'all';
      } else if (value === session.userId) {
        state.scope = 'own';
        state.creatorId = session.userId;
      } else {
        state.scope = 'person';
        state.creatorId = value;
      }
      syncControls();
      renderList();
    });

    let searchTimer = null;
    root.querySelector('[data-search]')?.addEventListener('input', event => {
      clearTimeout(searchTimer);
      const value = event.target.value;
      searchTimer = setTimeout(() => {
        state.search = value.trim();
        renderList();
      }, 180);
    });

    root.querySelectorAll('[data-status]').forEach(btn => btn.addEventListener('click', () => {
      state.status = btn.dataset.status;
      syncControls();
      renderList();
    }));

    const closeMenus = except => {
      root.querySelectorAll('[data-menu]').forEach(menu => {
        if (menu !== except) menu.hidden = true;
      });
    };

    root.addEventListener('click', async event => {
      const toggle = event.target.closest('[data-menu-toggle]');
      if (toggle) {
        event.stopPropagation();
        const menu = toggle.closest('.card-menu-wrap')?.querySelector('[data-menu]');
        if (menu) {
          const willOpen = menu.hidden;
          closeMenus(menu);
          menu.hidden = !willOpen;
        }
        return;
      }

      if (!event.target.closest('[data-menu]')) closeMenus(null);

      const qrButton = event.target.closest('[data-qr]');
      if (qrButton) {
        const form = forms.find(item => item.id === qrButton.dataset.qr);
        if (form) openQrModal(form);
        closeMenus(null);
        return;
      }

      const shareButton = event.target.closest('[data-share]');
      if (shareButton) {
        const form = forms.find(item => item.id === shareButton.dataset.share);
        if (form) openShareModal(form);
        return;
      }

      const deleteButton = event.target.closest('[data-delete]');
      if (deleteButton) {
        const form = forms.find(item => item.id === deleteButton.dataset.delete);
        if (!form) return;
        closeMenus(null);
        const ok = await confirmDialog({
          title: 'ลบแบบสอบถาม?',
          message: `“${form.title}” และคำตอบทั้งหมด ${formatNumber(form.responseCount || 0)} รายการจะถูกลบอย่างถาวร`,
          confirmText: 'ลบแบบสอบถาม',
          tone: 'danger',
          onConfirm: async () => {
            await deleteForm(form.id);
            const index = forms.findIndex(item => item.id === form.id);
            if (index >= 0) forms.splice(index, 1);
            toast('ลบแบบสอบถามแล้ว', 'success');
            renderList();
          }
        });
        if (ok) renderList();
      }
    });

    const onDocumentClick = () => closeMenus(null);
    document.addEventListener('click', onDocumentClick);

    return () => {
      document.removeEventListener('click', onDocumentClick);
      clearTimeout(searchTimer);
    };
  }

  return { html, mount };
}
