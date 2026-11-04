import { listPeople, createAccount, changePassword, resetPassword } from '../cloud.js';
import { icon } from '../icons.js';
import { avatar, toast, openModal, closeModal, emptyState } from '../ui.js';
import { e, thaiDate, formatNumber, pluralThai } from '../utils.js';

function passwordField(id, label, placeholder = 'อย่างน้อย 4 ตัวอักษร') {
  return `<div class="field">
    <label class="field__label" for="${id}">${label}</label>
    <div class="input-wrap">
      ${icon('lock', 16)}
      <input class="input" id="${id}" type="password" autocomplete="new-password" placeholder="${placeholder}" required>
      <button class="input-wrap__action" type="button" data-toggle-pass aria-label="แสดงรหัสผ่าน">${icon('eye', 16)}</button>
    </div>
  </div>`;
}

function bindPasswordToggles(root) {
  root.querySelectorAll('[data-toggle-pass]').forEach(btn => btn.addEventListener('click', () => {
    const input = btn.closest('.input-wrap')?.querySelector('input');
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = icon(show ? 'eye-off' : 'eye', 16);
  }));
}

function openPasswordModal({ title, eyebrow, description, onSubmit }) {
  const modal = openModal({
    title,
    eyebrow,
    size: 'sm',
    body: `<div class="modal-form">
      <p class="modal__message">${e(description)}</p>
      ${passwordField('new-password', 'รหัสผ่านใหม่')}
      ${passwordField('confirm-password', 'ยืนยันรหัสผ่านใหม่', 'พิมพ์รหัสผ่านอีกครั้ง')}
      <div class="form-error" data-pass-error>${icon('alert-circle', 15)}<span></span></div>
    </div>`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-dismiss>ยกเลิก</button>
      <button class="btn btn--primary" type="button" data-save-password>${icon('check', 16)} บันทึกรหัสผ่าน</button>`,
    onMount: root => {
      bindPasswordToggles(root);
      const error = root.querySelector('[data-pass-error]');
      const showError = message => {
        error.querySelector('span').textContent = message;
        error.classList.add('is-visible');
      };
      const button = root.querySelector('[data-save-password]');
      button.addEventListener('click', async () => {
        const pass = root.querySelector('#new-password').value;
        const confirm = root.querySelector('#confirm-password').value;
        error.classList.remove('is-visible');
        if (pass.length < 4) {
          showError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
          return;
        }
        if (pass !== confirm) {
          showError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
          return;
        }
        button.disabled = true;
        button.classList.add('is-loading');
        try {
          await onSubmit(pass);
          closeModal();
          toast('เปลี่ยนรหัสผ่านแล้ว', 'success');
        } catch (err) {
          showError(err?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
          button.disabled = false;
          button.classList.remove('is-loading');
        }
      });
    }
  });
  return modal;
}

function openCreateModal({ session, onCreated }) {
  openModal({
    title: 'สร้างบัญชีผู้ใช้',
    eyebrow: 'เพิ่มผู้สร้างแบบสอบถาม',
    size: 'sm',
    body: `<div class="modal-form">
      <p class="modal__message">บัญชีใหม่จะใช้เข้าสู่ระบบด้วย <b>ชื่อ–นามสกุล</b> หรือ <b>รหัสผู้ใช้</b> ที่กำหนด และใช้ระบบเดียวกับ 02._.mock</p>
      <div class="field">
        <label class="field__label" for="account-name">ชื่อ–นามสกุล</label>
        <div class="input-wrap">${icon('user', 16)}<input class="input" id="account-name" type="text" placeholder="เช่น ครูสมชาย ใจดี" autocomplete="off" maxlength="120"></div>
      </div>
      <div class="field">
        <label class="field__label" for="account-code">รหัสผู้ใช้</label>
        <div class="input-wrap">${icon('key', 16)}<input class="input" id="account-code" type="text" placeholder="เช่น TCH-0004" autocomplete="off" maxlength="40"></div>
        <span class="field__hint">ใช้ตัวอักษร ตัวเลข หรือขีดกลาง และต้องไม่ซ้ำกับบัญชีเดิม</span>
      </div>
      ${passwordField('account-password', 'รหัสผ่านเริ่มต้น')}
      <div class="form-error" data-account-error>${icon('alert-circle', 15)}<span></span></div>
    </div>`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-dismiss>ยกเลิก</button>
      <button class="btn btn--primary" type="button" data-create-account>${icon('user-plus', 16)} สร้างบัญชี</button>`,
    onMount: root => {
      bindPasswordToggles(root);
      const error = root.querySelector('[data-account-error]');
      const showError = message => {
        error.querySelector('span').textContent = message;
        error.classList.add('is-visible');
      };
      const button = root.querySelector('[data-create-account]');
      button.addEventListener('click', async () => {
        const name = root.querySelector('#account-name').value.trim();
        const code = root.querySelector('#account-code').value.trim();
        const password = root.querySelector('#account-password').value;
        error.classList.remove('is-visible');
        if (name.length < 2) return showError('กรุณากรอกชื่อ–นามสกุล');
        if (code.length < 3) return showError('รหัสผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
        if (password.length < 4) return showError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
        button.disabled = true;
        button.classList.add('is-loading');
        try {
          await createAccount(session, { name, code, password });
          closeModal();
          toast(`สร้างบัญชี ${name} แล้ว`, 'success');
          await onCreated();
        } catch (err) {
          showError(err?.message || 'สร้างบัญชีไม่สำเร็จ');
          button.disabled = false;
          button.classList.remove('is-loading');
        }
      });
    }
  });
}

export async function accountsView({ session }) {
  let people = await listPeople();
  const self = people.find(person => person.userId === session.userId) || {
    userId: session.userId,
    name: session.name,
    code: session.code,
    isAdmin: session.isAdmin,
    formCount: 0,
    createdAt: null
  };
  const adminCount = people.filter(person => person.isAdmin).length;
  const totalForms = people.reduce((sum, person) => sum + Number(person.formCount || 0), 0);

  const html = `<div class="accounts">
    <header class="dash-hero accounts-hero">
      <div class="dash-hero__copy">
        <span class="eyebrow">${session.isAdmin ? 'ผู้ดูแลและทีมงาน' : 'บัญชีของฉัน'}</span>
        <h1>บัญชีผู้ใช้</h1>
        <p>${session.isAdmin ? 'จัดการบัญชีผู้สร้างแบบสอบถาม เปลี่ยนรหัสผ่าน และดูว่าใครสร้างฟอร์มอะไรไว้บ้าง' : 'เปลี่ยนรหัสผ่านของคุณ และดูภาพรวมแบบสอบถามที่คุณสร้าง'}</p>
      </div>
      <div class="dash-hero__actions">
        ${session.isAdmin
          ? `<button class="btn btn--primary" type="button" data-create>${icon('user-plus', 16)} สร้างบัญชี</button>`
          : `<span class="badge badge--neutral">${icon('shield-check', 12)} เปลี่ยนรหัสผ่านได้ด้วยตัวเอง</span>`}
      </div>
    </header>

    <section class="account-self">
      <div class="account-self__profile">
        ${avatar(self.name, 58)}
        <div>
          <span class="account-self__eyebrow">บัญชีของคุณ</span>
          <h2>${e(self.name)} ${self.isAdmin ? '<span class="badge badge--gold">ผู้ดูแลระบบ</span>' : ''}</h2>
          <p><code>${e(self.code || '—')}</code> · สร้าง ${formatNumber(self.formCount || 0)} แบบสอบถาม</p>
        </div>
      </div>
      <div class="account-self__actions">
        <button class="btn btn--ghost" type="button" data-change-own>${icon('key', 16)} เปลี่ยนรหัสผ่าน</button>
      </div>
    </section>

    ${session.isAdmin ? `<section class="account-stats">
      <div><span>${icon('users', 16)} บัญชีทั้งหมด</span><strong data-stat-accounts>${formatNumber(people.length)}</strong></div>
      <div><span>${icon('shield-check', 16)} ผู้ดูแลระบบ</span><strong data-stat-admins>${formatNumber(adminCount)}</strong></div>
      <div><span>${icon('clipboard-list', 16)} แบบสอบถามรวม</span><strong data-stat-forms>${formatNumber(totalForms)}</strong></div>
    </section>` : ''}

    ${session.isAdmin ? `<section class="team-section">
      <div class="section-head">
        <div><span class="eyebrow">ทีมผู้สร้าง</span><h2>บัญชีทั้งหมด</h2></div>
        <div class="team-search">${icon('search', 15)}<input type="search" data-team-search placeholder="ค้นหาชื่อหรือรหัส…" aria-label="ค้นหาบัญชี"></div>
      </div>
      <div class="team-list" data-team-list></div>
      <div data-team-empty></div>
    </section>` : `<div class="notice notice--info">${icon('info', 16)}<span>เฉพาะผู้ดูแลระบบเท่านั้นที่ดูและจัดการบัญชีทั้งหมดได้ — คุณยังเปลี่ยนรหัสผ่านของตัวเองได้ตามปกติ</span></div>`}

    <div class="account-note">${icon('shield-check', 15)} บัญชีทั้งหมดใช้ระบบเดียวกับ 02._.mock และถูกป้องกันด้วยสิทธิ์ระดับฐานข้อมูล</div>
  </div>`;

  function personRow(person) {
    const isSelf = person.userId === session.userId;
    return `<div class="team-row" data-person="${person.userId}">
      ${avatar(person.name, 40)}
      <div class="team-row__main">
        <strong>${e(person.name)} ${isSelf ? '<span class="team-row__you">คุณ</span>' : ''} ${person.isAdmin ? '<span class="badge badge--gold">ผู้ดูแล</span>' : ''}</strong>
        <span><code>${e(person.code || '—')}</code>${person.createdAt ? ` · เข้าร่วม ${thaiDate(person.createdAt)}` : ''}</span>
      </div>
      <span class="team-row__forms">${icon('clipboard-list', 14)} ${pluralThai(Number(person.formCount || 0), 'แบบสอบถาม')}</span>
      <div class="team-row__actions">
        <a class="btn btn--ghost btn--sm" href="#/?creator=${person.userId}">${icon('eye', 14)} ดูฟอร์ม</a>
        ${session.isAdmin && !isSelf ? `<button class="btn btn--ghost btn--sm" type="button" data-reset="${person.userId}" title="รีเซ็ตรหัสผ่านให้ ${e(person.name)}">${icon('key', 14)} รีเซ็ตรหัส</button>` : ''}
      </div>
    </div>`;
  }

  function renderTeam(search = '') {
    const list = document.querySelector('[data-team-list]');
    const empty = document.querySelector('[data-team-empty]');
    if (!list) return;
    const needle = search.toLowerCase();
    const filtered = people.filter(person => !needle || `${person.name} ${person.code}`.toLowerCase().includes(needle));
    if (!filtered.length) {
      list.innerHTML = '';
      empty.innerHTML = emptyState({ iconName: 'search', title: 'ไม่พบบัญชีที่ค้นหา', message: 'ลองพิมพ์ชื่อหรือรหัสผู้ใช้อีกครั้ง' });
      return;
    }
    empty.innerHTML = '';
    list.innerHTML = filtered.map(personRow).join('');
    list.querySelectorAll('[data-reset]').forEach(btn => btn.addEventListener('click', () => {
      const person = people.find(item => item.userId === btn.dataset.reset);
      if (!person) return;
      openPasswordModal({
        title: `รีเซ็ตรหัสผ่านของ ${person.name}`,
        eyebrow: 'รีเซ็ตรหัสผ่าน',
        description: 'กำหนดรหัสผ่านใหม่ให้บัญชีนี้ ผู้ใช้จะเข้าสู่ระบบด้วยรหัสใหม่ทันที',
        onSubmit: async password => { await resetPassword(person, password); }
      });
    }));
  }

  function mount(root) {
    renderTeam();

    const refreshStats = () => {
      const total = people.reduce((sum, person) => sum + Number(person.formCount || 0), 0);
      const admins = people.filter(person => person.isAdmin).length;
      const set = (selector, value) => {
        const node = root.querySelector(selector);
        if (node) node.textContent = formatNumber(value);
      };
      set('[data-stat-accounts]', people.length);
      set('[data-stat-admins]', admins);
      set('[data-stat-forms]', total);
    };

    root.querySelector('[data-create]')?.addEventListener('click', () => {
      openCreateModal({
        session,
        onCreated: async () => {
          people = await listPeople();
          refreshStats();
          renderTeam(root.querySelector('[data-team-search]')?.value || '');
        }
      });
    });

    root.querySelector('[data-change-own]')?.addEventListener('click', () => {
      openPasswordModal({
        title: 'เปลี่ยนรหัสผ่านของคุณ',
        eyebrow: 'ความปลอดภัยของบัญชี',
        description: 'เมื่อเปลี่ยนแล้ว ให้ใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไป',
        onSubmit: async password => { await changePassword(session, password); }
      });
    });

    let timer = null;
    root.querySelector('[data-team-search]')?.addEventListener('input', event => {
      clearTimeout(timer);
      const value = event.target.value;
      timer = setTimeout(() => renderTeam(value), 160);
    });

    return () => clearTimeout(timer);
  }

  return { html, mount };
}
