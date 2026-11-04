import { icon, brandMark } from './icons.js';
import { e, avatarTone, initials } from './utils.js';

let toastSeq = 0;

export function toast(message, type = 'success', duration = 3600) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const id = `ftoast_${++toastSeq}`;
  const map = { success: 'check-circle', warning: 'alert-triangle', error: 'x-circle', info: 'info' };
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.id = id;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="toast__icon">${icon(map[type] || 'info', 19)}</span><span class="toast__text">${e(message)}</span><button class="toast__close" type="button" aria-label="ปิด">${icon('x', 15)}</button>`;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  const remove = () => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 240);
  };
  const timer = setTimeout(remove, duration);
  el.querySelector('.toast__close').addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

let currentModal = null;

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const overlay = root.querySelector('.modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.body.classList.remove('modal-open');
  if (currentModal?.keyHandler) document.removeEventListener('keydown', currentModal.keyHandler);
  if (currentModal?.restoreFocus) {
    try { currentModal.restoreFocus.focus(); } catch { /* noop */ }
  }
  currentModal = null;
  setTimeout(() => {
    if (!currentModal) root.innerHTML = '';
  }, 220);
}

export function openModal({
  title = '',
  eyebrow = '',
  body = '',
  footer = '',
  size = 'md',
  onMount = null,
  dismissible = true
} = {}) {
  const root = document.getElementById('modal-root');
  if (!root) return null;
  closeModal();
  const previous = document.activeElement;
  root.innerHTML = `<div class="modal-overlay" role="presentation">
    <div class="modal modal--${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal__head">
        <div class="modal__titles">
          ${eyebrow ? `<span class="modal__eyebrow">${e(eyebrow)}</span>` : ''}
          <h2 class="modal__title" id="modal-title">${e(title)}</h2>
        </div>
        <button class="icon-btn icon-btn--quiet" type="button" data-modal-close aria-label="ปิด">${icon('x', 18)}</button>
      </div>
      <div class="modal__body">${body}</div>
      ${footer ? `<div class="modal__foot">${footer}</div>` : ''}
    </div>
  </div>`;

  const overlay = root.querySelector('.modal-overlay');
  const modal = root.querySelector('.modal');
  requestAnimationFrame(() => overlay.classList.add('is-open'));
  document.body.classList.add('modal-open');

  const keyHandler = event => {
    if (event.key === 'Escape' && dismissible) {
      event.preventDefault();
      closeModal();
    }
    if (event.key === 'Tab') {
      const focusable = [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(node => !node.disabled && node.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', keyHandler);

  overlay.addEventListener('click', event => {
    if (event.target === overlay && dismissible) closeModal();
  });
  root.querySelector('[data-modal-close]')?.addEventListener('click', closeModal);
  root.querySelectorAll('[data-modal-dismiss]').forEach(btn => btn.addEventListener('click', closeModal));

  currentModal = { keyHandler, restoreFocus: previous };
  if (typeof onMount === 'function') onMount(modal);
  setTimeout(() => {
    const autofocus = modal.querySelector('[autofocus], .modal__body input, .modal__body textarea, .modal__body select, .modal__foot .btn--primary');
    try { autofocus?.focus(); } catch { /* noop */ }
  }, 60);
  return modal;
}

export function confirmDialog({
  title = 'ยืนยันการทำรายการ',
  message = '',
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  tone = 'danger',
  onConfirm = null
} = {}) {
  return new Promise(resolve => {
    const modal = openModal({
      title,
      size: 'sm',
      body: `<p class="modal__message">${e(message)}</p>`,
      footer: `<button class="btn btn--ghost" type="button" data-modal-dismiss>${e(cancelText)}</button>
        <button class="btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}" type="button" data-confirm>${e(confirmText)}</button>`,
      onMount: root => {
        root.querySelector('[data-confirm]').addEventListener('click', async () => {
          const button = root.querySelector('[data-confirm]');
          button.disabled = true;
          try {
            if (onConfirm) await onConfirm();
            closeModal();
            resolve(true);
          } catch (err) {
            button.disabled = false;
            toast(err?.message || 'ทำรายการไม่สำเร็จ', 'error');
          }
        });
      }
    });
    if (!modal) resolve(false);
    const root = document.getElementById('modal-root');
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.modal-overlay')) {
        observer.disconnect();
        resolve(false);
      }
    });
    observer.observe(root, { childList: true });
  });
}

export function brand({ href = '#/', variant = 'default', label = true, subtitle = 'แบบสอบถามออนไลน์' } = {}) {
  return `<a class="brand brand--${variant}" href="${href}" aria-label="02._.form หน้าหลัก">
    ${brandMark(variant === 'light' ? 38 : 36)}
    ${label ? `<span class="brand__words"><span class="brand__name">02._.form</span><span class="brand__sub">${e(subtitle)}</span></span>` : ''}
  </a>`;
}

export function avatar(name, size = 36, extraClass = '') {
  return `<span class="avatar avatar--${avatarTone(name)} ${extraClass}" style="width:${size}px;height:${size}px;font-size:${Math.max(11, Math.round(size * 0.36))}px" aria-hidden="true">${e(initials(name))}</span>`;
}

export function badge(label, tone = 'neutral', dot = false) {
  return `<span class="badge badge--${tone}">${dot ? '<span class="badge__dot"></span>' : ''}${e(label)}</span>`;
}

export function emptyState({ iconName = 'inbox', title = 'ยังไม่มีข้อมูล', message = '', action = '' } = {}) {
  return `<div class="empty-state">
    <span class="empty-state__icon">${icon(iconName, 26)}</span>
    <h3>${e(title)}</h3>
    ${message ? `<p>${e(message)}</p>` : ''}
    ${action || ''}
  </div>`;
}

export function skeletonCards(count = 3) {
  return `<div class="skeleton-grid">${Array.from({ length: count }, () => `<div class="skeleton-card">
    <span class="skeleton skeleton--line" style="width:34%"></span>
    <span class="skeleton skeleton--title"></span>
    <span class="skeleton skeleton--line" style="width:78%"></span>
    <span class="skeleton skeleton--line" style="width:54%"></span>
    <span class="skeleton skeleton--foot"></span>
  </div>`).join('')}</div>`;
}

export function copyButton(text, label = 'คัดลอกลิงก์', extra = '') {
  const id = `copy_${Math.random().toString(36).slice(2, 8)}`;
  return `<button class="btn btn--ghost btn--sm" type="button" data-copy-text="${e(text)}" ${extra}>${icon('copy', 15)} <span>${e(label)}</span></button>`;
}
