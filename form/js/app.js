import { restoreSession, logout, isLocalMode } from './cloud.js';
import { toast, closeModal, avatar } from './ui.js';
import { icon } from './icons.js';
import { e, copyText } from './utils.js';
import { loginView } from './views/login.js';
import { dashboardView } from './views/dashboard.js';
import { builderView } from './views/builder.js';
import { publicView } from './views/public.js';
import { resultsView } from './views/results.js';
import { shareView } from './views/share.js';
import { accountsView } from './views/accounts.js';

const app = document.getElementById('app');
let session = null;
let cleanup = null;
let renderToken = 0;

function parseRoute() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart] = raw.split('?');
  const path = pathPart || '/';
  const query = new URLSearchParams(queryPart || '');
  const parts = path.split('/').filter(Boolean);
  return { path, parts, query };
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (location.hash === target) return;
  if (replace) {
    history.replaceState(null, '', target);
    render();
  } else {
    location.hash = target;
  }
}

export function getSession() {
  return session;
}

function setSession(next) {
  session = next;
}

function applyCleanup(fn) {
  if (typeof fn === 'function') cleanup = fn;
}

function setTitle(title) {
  document.title = title ? `${title} · 02._.form` : '02._.form — แบบสอบถามออนไลน์';
}

function shell({ active = 'dashboard', content = '', session: current, title = '' }) {
  const navItems = [
    { key: 'dashboard', href: '#/', label: 'แดชบอร์ด', icon: 'layout-dashboard' },
    { key: 'all', href: '#/?scope=all', label: 'แบบสอบถามทั้งหมด', icon: 'clipboard-list' },
    { key: 'accounts', href: '#/accounts', label: current?.isAdmin ? 'บัญชีผู้ใช้' : 'บัญชีของฉัน', icon: 'users' }
  ];
  return `<div class="app-shell">
    <aside class="sidebar" data-sidebar>
      <div class="sidebar__brand">
        <a class="brand brand--light" href="#/" aria-label="02._.form หน้าหลัก">
          <span class="brand-mark brand-mark--dark" style="width:38px;height:38px"><img src="./assets/logo.jpg" alt=""></span>
          <span class="brand__words"><span class="brand__name">02._.form</span><span class="brand__sub">แบบสอบถามออนไลน์</span></span>
        </a>
        <button class="sidebar__close" type="button" data-sidebar-close aria-label="ปิดเมนู">${icon('x', 18)}</button>
      </div>

      <div class="sidebar__create">
        <a class="btn btn--gold btn--wide" href="#/forms/new">${icon('plus', 17)} สร้างแบบสอบถาม</a>
      </div>

      <nav class="sidebar__nav" aria-label="เมนูหลัก">
        <span class="sidebar__label">ภาพรวม</span>
        ${navItems.map(item => `<a class="sidebar__link ${active === item.key ? 'is-active' : ''}" href="${item.href}">
          ${icon(item.icon, 18)}<span>${item.label}</span>
          ${active === item.key ? '<span class="sidebar__dot"></span>' : ''}
        </a>`).join('')}
      </nav>

      <div class="sidebar__note">
        <span class="sidebar__note-icon">${icon('sparkles', 15)}</span>
        <p>ทุกเสียงมีความหมาย<br><strong>สร้างแบบสอบถามที่ใช่</strong> ในไม่กี่นาที</p>
      </div>

      <div class="sidebar__user">
        <a class="sidebar__user-main" href="#/accounts">
          ${avatar(current?.name || '?', 38)}
          <span class="sidebar__user-copy">
            <strong>${e(current?.name || '')}</strong>
            <small>${current?.isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้สร้างแบบสอบถาม'}</small>
          </span>
        </a>
        <button class="icon-btn icon-btn--dark" type="button" data-logout aria-label="ออกจากระบบ" title="ออกจากระบบ">${icon('logout', 17)}</button>
      </div>
    </aside>

    <button class="sidebar-scrim" type="button" data-sidebar-close aria-label="ปิดเมนู"></button>

    <div class="app-main">
      <header class="mobile-topbar">
        <button class="icon-btn" type="button" data-sidebar-open aria-label="เปิดเมนู">${icon('menu', 20)}</button>
        <a class="mobile-topbar__brand" href="#/">02._.form</a>
        <a class="mobile-topbar__avatar" href="#/accounts" aria-label="บัญชีของฉัน">${avatar(current?.name || '?', 32)}</a>
      </header>
      ${isLocalMode() ? `<div class="demo-strip">${icon('info', 14)} โหมดทดลองในเครื่อง — ข้อมูลจะถูกเก็บไว้ในเบราว์เซอร์นี้เท่านั้น</div>` : ''}
      ${title ? `<div class="page-heading"><span class="page-heading__crumb">02._.form</span><h1>${e(title)}</h1></div>` : ''}
      <main class="page">${content}</main>
    </div>
  </div>`;
}

function renderLoader() {
  app.innerHTML = `<div class="boot-loader"><div class="boot-loader__mark"><img src="./assets/logo.jpg" alt=""></div><span class="boot-loader__bar"><i></i></span><p>กำลังเตรียมแบบสอบถาม…</p></div>`;
}

function renderFatal(error) {
  app.innerHTML = `<div class="fatal">
    <span class="fatal__icon">${icon('alert-triangle', 26)}</span>
    <h1>เปิดหน้าเว็บไม่สำเร็จ</h1>
    <p>${e(error?.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด')}</p>
    <button class="btn btn--primary" type="button" onclick="location.reload()">${icon('refresh', 16)} ลองอีกครั้ง</button>
  </div>`;
}

function bindGlobal(root) {
  root.querySelectorAll('[data-sidebar-open]').forEach(btn => btn.addEventListener('click', () => {
    document.body.classList.add('sidebar-open');
  }));
  root.querySelectorAll('[data-sidebar-close]').forEach(btn => btn.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  }));
  root.querySelectorAll('[data-logout]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    await logout();
    session = null;
    closeModal();
    navigate('/login', { replace: true });
    toast('ออกจากระบบแล้ว', 'info');
  }));
}

async function render() {
  const token = ++renderToken;
  if (cleanup) {
    try { cleanup(); } catch { /* noop */ }
    cleanup = null;
  }
  closeModal();
  document.body.classList.remove('sidebar-open');
  const { path, parts, query } = parseRoute();

  // Public survey route — never requires login.
  if (parts[0] === 'f' && parts[1]) {
    setTitle('แบบสอบถาม');
    try {
      const result = await publicView({ slug: decodeURIComponent(parts[1]), query });
      if (token !== renderToken) return;
      app.innerHTML = result.html;
      applyCleanup(result.mount?.(app) || null);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (error) {
      if (token !== renderToken) return;
      renderFatal(error);
    }
    return;
  }

  if (!session) {
    session = await restoreSession();
    if (token !== renderToken) return;
  }

  if (path === '/login') {
    if (session) {
      navigate('/', { replace: true });
      return;
    }
    setTitle('เข้าสู่ระบบ');
    const result = loginView({ onLogin: next => { session = next; } });
    app.innerHTML = result.html;
    bindGlobal(app);
    applyCleanup(result.mount?.(app) || null);
    window.scrollTo({ top: 0, behavior: 'instant' });
    return;
  }

  if (!session) {
    setTitle('เข้าสู่ระบบ');
    const result = loginView({ onLogin: next => { session = next; } });
    app.innerHTML = result.html;
    bindGlobal(app);
    applyCleanup(result.mount?.(app) || null);
    return;
  }

  try {
    if (path === '/' || path === '') {
      const scope = query.get('scope') === 'all' ? 'all' : 'own';
      const creatorId = query.get('creator');
      setTitle('แดชบอร์ด');
      const result = await dashboardView({ session, scope, creatorId });
      if (token !== renderToken) return;
      app.innerHTML = shell({ active: scope === 'all' ? 'all' : 'dashboard', content: result.html, session });
      bindGlobal(app);
      applyCleanup(result.mount?.(app) || null);
    } else if (path === '/accounts') {
      setTitle('บัญชีผู้ใช้');
      const result = await accountsView({ session });
      if (token !== renderToken) return;
      app.innerHTML = shell({ active: 'accounts', content: result.html, session });
      bindGlobal(app);
      applyCleanup(result.mount?.(app) || null);
    } else if (path === '/forms/new') {
      setTitle('สร้างแบบสอบถาม');
      const result = await builderView({ session, formId: null });
      if (token !== renderToken) return;
      app.innerHTML = result.html;
      bindGlobal(app);
      applyCleanup(result.mount?.(app) || null);
    } else if (parts[0] === 'forms' && parts[1] && parts[2] === 'edit') {
      setTitle('แก้ไขแบบสอบถาม');
      const result = await builderView({ session, formId: parts[1] });
      if (token !== renderToken) return;
      app.innerHTML = result.html;
      bindGlobal(app);
      applyCleanup(result.mount?.(app) || null);
    } else if (parts[0] === 'forms' && parts[1] && parts[2] === 'results') {
      setTitle('ผลคำตอบ');
      const result = await resultsView({ session, formId: parts[1] });
      if (token !== renderToken) return;
      app.innerHTML = result.html;
      bindGlobal(app);
      applyCleanup(result.mount?.(app) || null);
    } else if (parts[0] === 'forms' && parts[1] && parts[2] === 'share') {
      setTitle('แชร์แบบสอบถาม');
      const result = await shareView({ session, formId: parts[1], query });
      if (token !== renderToken) return;
      app.innerHTML = result.html;
      bindGlobal(app);
      applyCleanup(result.mount?.(app) || null);
    } else if (path === '/forms') {
      navigate('/');
    } else {
      setTitle('ไม่พบหน้านี้');
      app.innerHTML = shell({
        session,
        content: `<div class="fatal fatal--inline">
          <span class="fatal__icon">${icon('search', 26)}</span>
          <h1>ไม่พบหน้านี้</h1>
          <p>ลิงก์อาจถูกเปลี่ยนหรือหน้านี้ถูกย้ายแล้ว</p>
          <a class="btn btn--primary" href="#/">กลับแดชบอร์ด</a>
        </div>`
      });
      bindGlobal(app);
    }
  } catch (error) {
    if (token !== renderToken) return;
    console.error(error);
    app.innerHTML = shell({
      session,
      content: `<div class="fatal fatal--inline">
        <span class="fatal__icon">${icon('alert-triangle', 26)}</span>
        <h1>โหลดข้อมูลไม่สำเร็จ</h1>
        <p>${e(error?.message || 'เกิดข้อผิดพลาด')}</p>
        <div class="fatal__actions">
          <button class="btn btn--primary" type="button" onclick="location.reload()">${icon('refresh', 16)} ลองอีกครั้ง</button>
          <a class="btn btn--ghost" href="#/login">ไปหน้าเข้าสู่ระบบ</a>
        </div>
      </div>`
    });
    bindGlobal(app);
  }

  if (token === renderToken) {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-copy-text]');
  if (!button) return;
  event.preventDefault();
  try {
    await copyText(button.dataset.copyText);
    toast('คัดลอกลิงก์แล้ว', 'success');
    button.classList.add('is-copied');
    setTimeout(() => button.classList.remove('is-copied'), 1200);
  } catch {
    toast('คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตัวเอง', 'error');
  }
});

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  renderLoader();
  render();
});
