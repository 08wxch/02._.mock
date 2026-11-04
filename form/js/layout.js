import { avatar } from './ui.js';
import { icon } from './icons.js';
import { e } from './utils.js';
import { isLocalMode } from './cloud.js';

export function workspaceShell({
  session,
  back = '#/',
  crumb = 'แบบสอบถาม',
  title = '',
  actions = '',
  content = '',
  tone = 'default',
  wide = false
}) {
  return `<div class="workspace workspace--${tone} ${wide ? 'workspace--wide' : ''}">
    <header class="workspace__bar">
      <a class="icon-btn workspace__back" href="${back}" aria-label="ย้อนกลับ">${icon('arrow-left', 19)}</a>
      <div class="workspace__crumb">
        <span>${e(crumb)}</span>
        <strong>${e(title)}</strong>
      </div>
      <div class="workspace__actions">${actions}</div>
      <a class="workspace__avatar" href="#/accounts" aria-label="บัญชีของฉัน">${avatar(session?.name || '?', 34)}</a>
    </header>
    ${isLocalMode() ? `<div class="demo-strip">${icon('info', 14)} โหมดทดลองในเครื่อง — ข้อมูลจะถูกเก็บไว้ในเบราว์เซอร์นี้เท่านั้น</div>` : ''}
    <main class="workspace__main">${content}</main>
  </div>`;
}

export function statusBadge(status) {
  const map = {
    open: { label: 'กำลังเปิดรับ', tone: 'open', dot: true },
    scheduled: { label: 'กำหนดเปิดภายหลัง', tone: 'scheduled', dot: false },
    closed: { label: 'ปิดรับคำตอบ', tone: 'closed', dot: false },
    draft: { label: 'ฉบับร่าง', tone: 'draft', dot: false }
  };
  const meta = map[status] || map.draft;
  return `<span class="status-pill status-pill--${meta.tone}">${meta.dot ? '<span class="status-pill__dot"></span>' : ''}${meta.label}</span>`;
}
