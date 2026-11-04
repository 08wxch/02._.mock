export const BANGKOK = 'Asia/Bangkok';

export function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export const e = escapeHTML;

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function randomSlug(length = 8) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function thaiDate(value, opts = {}) {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: BANGKOK, ...opts
  }).format(d);
}

export function thaiMonthDay(value) {
  return thaiDate(value, { year: undefined });
}

export function thaiTime(value, withSeconds = false) {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false, timeZone: BANGKOK
  }).format(d);
}

export function thaiDateTime(value, withSeconds = false) {
  const d = toDate(value);
  if (!d) return '—';
  return `${thaiDate(d)} เวลา ${thaiTime(d, withSeconds)} น.`;
}

export function longThaiDate(value) {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: BANGKOK
  }).format(d);
}

export function shortThaiDate(value) {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric', month: 'short', timeZone: BANGKOK
  }).format(d);
}

export function relativeTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  if (diff < 0) {
    const future = Math.abs(diff);
    if (future < 60_000) return 'อีกไม่ถึงนาที';
    if (future < 3_600_000) return `อีก ${Math.floor(future / 60_000)} นาที`;
    if (future < 86_400_000) return `อีก ${Math.floor(future / 3_600_000)} ชั่วโมง`;
    return `อีก ${Math.floor(future / 86_400_000)} วัน`;
  }
  if (diff < 45_000) return 'เมื่อสักครู่';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} นาทีที่แล้ว`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ชั่วโมงที่แล้ว`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} วันที่แล้ว`;
  return thaiDate(d);
}

export function formatNumber(n, digits = 0) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: digits }).format(Number(n) || 0);
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts[0].slice(0, 1).toUpperCase();
}

const avatarTones = ['sand', 'sage', 'sky', 'rose', 'lilac', 'mint'];
export function avatarTone(seed = 0) {
  const n = typeof seed === 'number' ? seed : [...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return avatarTones[Math.abs(n) % avatarTones.length];
}

export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try { document.execCommand('copy'); } catch { /* noop */ }
  area.remove();
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function downloadDataUrl(filename, dataUrl) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function toCsv(rows) {
  return rows.map(row => row.map(cell => {
    const raw = String(cell ?? '');
    // Prevent spreadsheet formula injection from free-text answers.
    const value = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  }).join(',')).join('\r\n');
}

export function safeFilename(name, fallback = 'form') {
  const cleaned = String(name || '').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 60);
  return cleaned || fallback;
}

export function baseUrl() {
  const url = new URL(location.href);
  const path = url.pathname.replace(/index\.html?$/i, '');
  return `${url.origin}${path}`;
}

export function examAppUrl() {
  return new URL('../', baseUrl()).href;
}

export function publicLink(slug) {
  const local = new URLSearchParams(location.search).has('local') ? '?local=1' : '';
  return `${baseUrl()}${local}#/f/${slug}`;
}

export function statusOf(form) {
  if (!form) return { key: 'draft', label: 'ฉบับร่าง', tone: 'neutral' };
  if (form.status === 'draft') return { key: 'draft', label: 'ฉบับร่าง', tone: 'neutral' };
  if (form.status === 'closed' || form.closedManually) return { key: 'closed', label: 'ปิดรับคำตอบ', tone: 'closed' };
  const now = Date.now();
  const open = toDate(form.openAt || form.open_at);
  const close = toDate(form.closeAt || form.close_at);
  if (open && now < open.getTime()) return { key: 'scheduled', label: 'กำหนดเปิดภายหลัง', tone: 'scheduled' };
  if (close && now > close.getTime()) return { key: 'closed', label: 'ปิดรับคำตอบ', tone: 'closed' };
  return { key: 'open', label: 'กำลังเปิดรับ', tone: 'open' };
}

export function windowLabel(form) {
  const open = form?.openAt || form?.open_at;
  const close = form?.closeAt || form?.close_at;
  if (!open && !close) return 'เปิดรับคำตอบตลอด';
  if (open && close) return `${thaiMonthDay(open)} ${thaiTime(open)} – ${thaiMonthDay(close)} ${thaiTime(close)} น.`;
  if (open) return `เปิด ${thaiDateTime(open)}`;
  return `ปิด ${thaiDateTime(close)}`;
}

export function datetimeLocalValue(value) {
  const d = toDate(value);
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(d).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromDatetimeLocal(value) {
  if (!value) return null;
  // The input is always Thai wall-clock time (Asia/Bangkok, UTC+7, no DST).
  const normalized = String(value).length === 16 ? `${value}:00` : String(value);
  const d = new Date(`${normalized}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function pluralThai(n, one, many = one) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export function answerPreview(answer) {
  if (Array.isArray(answer)) return answer.join(', ');
  if (answer === true) return 'ใช่';
  if (answer === false) return 'ไม่ใช่';
  if (answer === null || answer === undefined || answer === '') return '—';
  return String(answer);
}
