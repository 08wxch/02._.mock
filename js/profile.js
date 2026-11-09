import { icon } from './icons.js';
import { cloudSetPassword, cloudGetPassword, cloudSetCode, hasCloudSession } from './cloud.js';
import { e } from './utils.js';
import { avatar, toast, openModal, closeModal, mountCopyButtons } from './ui.js';
import {
  getDB, findOrganization, studentClassLabel,
  setTeacherPassword, setStudentPassword, setTeacherCode, setStudentCode
} from './store.js';

function maskPassword(value) {
  return '•'.repeat(Math.max(6, Math.min(14, String(value || '').length)));
}

// Shared password rule so every screen enforces the same strength.
// 8+ characters, at least one letter and one digit.
export async function verifyAccountPassword(role, id, password) {
  if (!hasCloudSession()) return { ok: false, error: 'ยังเชื่อมต่อฐานข้อมูลกลางไม่ได้ จึงยืนยันรหัสผ่านปัจจุบันไม่ได้' };
  const result = await cloudGetPassword(role, id);
  if (!result.ok) return { ok: false, error: result.error || 'ตรวจสอบรหัสผ่านปัจจุบันไม่สำเร็จ' };
  if (String(result.password) !== String(password || '')) {
    return { ok: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' };
  }
  return { ok: true };
}

export function passwordIssue(value) {
  const text = String(value || '');
  if (text.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  if (text.length > 64) return 'รหัสผ่านต้องไม่เกิน 64 ตัวอักษร';
  if (!/[A-Za-z]/.test(text) || !/[0-9]/.test(text)) return 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข';
  if (/^[A-Za-z0-9]+$/.test(text) && new Set(text.toLowerCase()).size < 6) {
    return 'รหัสผ่านคาดเดาง่ายเกินไป กรุณาใช้ตัวอักษรให้หลากหลายขึ้น';
  }
  if (/^(12345678|87654321|password|passw0rd|02\._\.mock)$/i.test(text)) {
    return 'รหัสผ่านนี้คาดเดาง่ายเกินไป กรุณาตั้งรหัสใหม่';
  }
  return '';
}

export function passwordStrength(value) {
  const text = String(value || '');
  let score = 0;
  if (text.length >= 8) score += 1;
  if (text.length >= 12) score += 1;
  if (/[a-z]/.test(text) && /[A-Z]/.test(text)) score += 1;
  if (/[0-9]/.test(text)) score += 1;
  if (/[^A-Za-z0-9]/.test(text)) score += 1;
  const level = score >= 5 ? 'strong' : score >= 3 ? 'medium' : 'weak';
  return {
    level,
    label: level === 'strong' ? 'แข็งแรง' : level === 'medium' ? 'ปานกลาง' : 'อ่อน',
    score: Math.min(100, Math.round((score / 5) * 100))
  };
}

function strengthMarkup() {
  return `<div class="password-meter" data-password-meter hidden>
    <div class="password-meter__bar"><span data-password-meter-bar style="width:0%"></span></div>
    <div class="password-meter__row"><span data-password-meter-label>ความปลอดภัยของรหัสผ่าน</span><button class="btn btn--link" type="button" data-generate-password>${icon('sparkles', 12)} ตั้งรหัสให้อัตโนมัติ</button></div>
  </div>`;
}

function randomPassword(length = 10) {
  const letters = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const bytes = new Uint32Array(length);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 0xffffffff);
  const pick = (set, i) => set[bytes[i] % set.length];
  const all = letters + digits + symbols;
  const chars = [pick(letters, 0), pick(letters, 1), pick(digits, 2), pick(symbols, 3)];
  for (let i = 4; i < length; i += 1) chars.push(pick(all, i));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function bindPasswordTools(scope, form) {
  if (!form) return;
  const inputs = [...form.querySelectorAll('input[type="password"]')];
  const meter = form.querySelector('[data-password-meter]');
  const bar = form.querySelector('[data-password-meter-bar]');
  const label = form.querySelector('[data-password-meter-label]');
  const paint = () => {
    const value = form.querySelector('input[name="password"]')?.value || '';
    if (!meter || !bar || !label) return;
    if (!value) { meter.hidden = true; bar.style.width = '0%'; return; }
    const info = passwordStrength(value);
    meter.hidden = false;
    bar.style.width = `${info.score}%`;
    bar.dataset.level = info.level;
    label.textContent = `ความปลอดภัย: ${info.label}`;
    label.dataset.level = info.level;
  };
  inputs.forEach(input => input.addEventListener('input', paint));
  form.querySelector('[data-generate-password]')?.addEventListener('click', async () => {
    const value = randomPassword(10);
    inputs.forEach(input => { input.type = 'text'; input.value = value; });
    paint();
    try {
      await navigator.clipboard.writeText(value);
      toast('สร้างรหัสผ่านใหม่และคัดลอกแล้ว · อย่าลืมบันทึก', 'success', 4200);
    } catch {
      toast('สร้างรหัสผ่านใหม่แล้ว · กรุณาคัดลอกเก็บไว้', 'info', 4200);
    }
  });
  paint();
}

export function openAccountProfile({ kind = 'teacher', personId, session, title = 'ข้อมูลบัญชีของฉัน', onChanged = null } = {}) {
  const db = getDB();
  const isTeacher = kind === 'teacher';
  const person = isTeacher
    ? db.teachers.find(t => t.id === personId)
    : db.students.find(s => s.id === personId);
  if (!person) {
    toast('ไม่พบข้อมูลบัญชีนี้', 'error');
    return;
  }
  const org = findOrganization(person.orgId, db);
  const roleLabel = isTeacher
    ? (person.isOwner ? 'ผู้สร้างระบบ' : person.staffRole === 'manager' ? 'ผู้จัดการ' : 'ครูผู้สอน')
    : 'นักเรียน';
  const classLabel = isTeacher ? '' : studentClassLabel(person, db);
  const isSelf = isTeacher ? person.id === session.teacherId : person.id === session.studentId;
  const detailRows = isTeacher
    ? `<div class="profile-detail"><span>หน่วยงาน / โรงเรียน</span><strong>${e(org?.name || person.school || 'ไม่ระบุ')}</strong></div>
       <div class="profile-detail"><span>บทบาท</span><strong>${e(roleLabel)}</strong></div>
       <div class="profile-detail"><span>ชื่อย่อหน่วยงาน</span><strong>${e(org?.shortName || '—')}</strong></div>`
    : `<div class="profile-detail"><span>หน่วยงาน / โรงเรียน</span><strong>${e(org?.name || 'ไม่ระบุ')}</strong></div>
       <div class="profile-detail"><span>class</span><strong>${e(classLabel)}</strong></div>
       <div class="profile-detail"><span>ชื่อย่อหน่วยงาน</span><strong>${e(org?.shortName || '—')}</strong></div>`;
  openModal({
    title,
    eyebrow: isTeacher ? 'โปรไฟล์ครู' : 'โปรไฟล์นักเรียน',
    size: 'sm',
    body: `<div class="account-profile">
      <div class="account-profile__hero">
        ${avatar(person.name, person.id, 'lg')}
        <div><strong>${e(person.name)}</strong><span>${e(roleLabel)} · ${e(org?.name || 'ไม่ระบุหน่วยงาน')}</span></div>
      </div>
      <div class="account-profile__details">
        <div class="profile-detail"><span>${isTeacher ? 'รหัสเข้าสู่ระบบ (รหัสครู)' : 'รหัสเข้าสู่ระบบ (รหัสนักเรียน)'}</span><strong class="profile-code">${e(person.code)} <button class="icon-btn" type="button" data-copy="${e(person.code)}" aria-label="คัดลอกรหัส" title="คัดลอกรหัส">${icon('copy', 12)}</button></strong></div>
        ${detailRows}
      </div>
      <div class="profile-secret">
        <div class="profile-secret__label"><span>${icon('key', 12)} รหัสผ่าน</span><small>ปิดไว้เพื่อความปลอดภัย</small></div>
        <div class="profile-secret__row">
          <strong data-secret-value>${maskPassword(person.password)}</strong>
          <button class="icon-btn" type="button" data-reveal-secret aria-label="เปิดดูรหัสผ่าน" title="เปิดดูรหัสผ่าน">${icon('eye', 15)}</button>
          <button class="btn btn--ghost btn--sm" type="button" data-open-password>เปลี่ยนรหัสผ่าน</button>
        </div>
      </div>
      <form class="profile-password-form" data-password-form hidden>
        ${isSelf ? `<div class="field"><label for="profile-current-password">รหัสผ่านปัจจุบัน</label><input class="input" id="profile-current-password" name="current" type="password" maxlength="64" autocomplete="current-password" placeholder="ยืนยันรหัสผ่านเดิมก่อนเปลี่ยน" required></div>` : ''}
        <div class="field"><label for="profile-new-password">รหัสผ่านใหม่</label><input class="input" id="profile-new-password" name="password" type="password" minlength="8" maxlength="64" autocomplete="new-password" placeholder="อย่างน้อย 8 ตัว มีตัวอักษรและตัวเลข" required>
          <span class="field__hint">${icon('shield-check', 11)} อย่างน้อย 8 ตัว · ต้องมีทั้งตัวอักษรและตัวเลข · ห้ามใช้รหัสเดิม</span>
          ${strengthMarkup()}
        </div>
        <div class="field"><label for="profile-confirm-password">ยืนยันรหัสผ่านใหม่</label><input class="input" id="profile-confirm-password" name="confirm" type="password" minlength="8" maxlength="64" autocomplete="new-password" placeholder="พิมพ์อีกครั้ง" required></div>
        <div class="profile-password-form__actions">
          <button class="btn btn--ghost btn--sm" type="button" data-cancel-password>ยกเลิก</button>
          <button class="btn btn--primary btn--sm" type="submit">${icon('save', 13)} บันทึกรหัสใหม่</button>
        </div>
      </form>
      <p class="account-profile__hint">${icon('shield-check', 12)} ${isTeacher
        ? (isSelf ? 'รหัสครูใช้เข้าสู่ระบบแทนอีเมล · แก้รหัสครูได้ที่เมนู “ครูและบุคลากร”' : 'รหัสครูใช้เข้าสู่ระบบแทนอีเมล · การเปลี่ยนรหัสจะมีผลกับการเข้าสู่ระบบครั้งถัดไป')
        : 'ข้อมูลนี้ใช้สำหรับเข้าสู่ระบบเท่านั้น · ครูในหน่วยงานเดียวกันเห็นข้อมูลนักเรียนได้'}</p>
    </div>`,
    footer: `<button class="btn btn--ghost" type="button" data-modal-close>ปิด</button>`,
    onMount(overlay) {
      mountCopyButtons(overlay);
      overlay.querySelector('[data-modal-close]')?.addEventListener('click', () => closeModal());
      const secret = overlay.querySelector('[data-secret-value]');
      const reveal = overlay.querySelector('[data-reveal-secret]');
      let visible = false;
      let revealing = false;
      reveal?.addEventListener('click', async () => {
        if (revealing) return;
        if (visible) {
          visible = false;
          if (secret) secret.textContent = maskPassword(person.password);
          reveal.innerHTML = icon('eye', 15);
          reveal.setAttribute('aria-label', 'เปิดดูรหัสผ่าน');
          reveal.setAttribute('title', 'เปิดดูรหัสผ่าน');
          return;
        }
        let value = String(person.password || '');
        if (!value) {
          revealing = true;
          reveal.disabled = true;
          const result = await cloudGetPassword(isTeacher ? 'teacher' : 'student', person.id);
          revealing = false;
          reveal.disabled = false;
          if (!result.ok) {
            toast(result.error || 'ไม่พบรหัสผ่านของบัญชีนี้', 'error', 6000);
            return;
          }
          value = result.password;
          person.password = value;
        }
        visible = true;
        if (secret) secret.textContent = value;
        reveal.innerHTML = icon('eye-off', 15);
        reveal.setAttribute('aria-label', 'ซ่อนรหัสผ่าน');
        reveal.setAttribute('title', 'ซ่อนรหัสผ่าน');
      });
      const form = overlay.querySelector('[data-password-form]');
      overlay.querySelector('[data-open-password]')?.addEventListener('click', () => {
        form?.removeAttribute('hidden');
        overlay.querySelector('#profile-new-password')?.focus();
      });
      overlay.querySelector('[data-cancel-password]')?.addEventListener('click', () => {
        form?.setAttribute('hidden', '');
        form?.reset();
      });
      bindPasswordTools(overlay, form);
      form?.addEventListener('submit', async ev => {
        ev.preventDefault();
        const data = new FormData(form);
        const next = String(data.get('password') || '');
        const confirm = String(data.get('confirm') || '');
        if (next !== confirm) { toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'error'); return; }
        if (isSelf) {
          const current = String(data.get('current') || '');
          if (!current) { toast('กรุณากรอกรหัสผ่านปัจจุบัน', 'error'); return; }
          const verified = await verifyAccountPassword(isTeacher ? 'teacher' : 'student', person.id, current);
          if (!verified.ok) { toast(verified.error || 'รหัสผ่านปัจจุบันไม่ถูกต้อง', 'error', 5000); return; }
        }
        const issue = passwordIssue(next);
        if (issue) { toast(issue, 'error', 5000); return; }
        if (isTeacher && person.isOwner && next === String(person.code || '').toLowerCase()) {
          toast('ห้ามใช้รหัสครูเป็นรหัสผ่าน', 'error');
          return;
        }
        const previous = person.password;
        const submit = form.querySelector('button[type=submit]');
        if (submit) { submit.disabled = true; submit.dataset.originalText = submit.innerHTML; submit.innerHTML = `${icon('refresh', 13)} กำลังบันทึก...`; }
        const cloud = await cloudSetPassword(isTeacher ? 'teacher' : 'student', person.id, next);
        if (!cloud.ok) {
          if (submit) { submit.disabled = false; submit.innerHTML = submit.dataset.originalText || 'บันทึกรหัสใหม่'; }
          toast(cloud.error || 'อัปเดตรหัสผ่านบนคลาวด์ไม่สำเร็จ กรุณาลองใหม่', 'error', 6000);
          return;
        }
        const result = isTeacher
          ? setTeacherPassword(person.id, next, session)
          : setStudentPassword(person.id, next, session);
        if (!result.ok) {
          await cloudSetPassword(isTeacher ? 'teacher' : 'student', person.id, previous);
          if (submit) { submit.disabled = false; submit.innerHTML = submit.dataset.originalText || 'บันทึกรหัสใหม่'; }
          toast(result.error || 'บันทึกรหัสผ่านไม่สำเร็จ', 'error', 5000);
          return;
        }
        person.password = next;
        if (submit) { submit.disabled = false; submit.innerHTML = submit.dataset.originalText || 'บันทึกรหัสใหม่'; }
        visible = false;
        if (secret) secret.textContent = maskPassword(next);
        if (reveal) { reveal.innerHTML = icon('eye', 15); reveal.setAttribute('aria-label', 'เปิดดูรหัสผ่าน'); }
        form.setAttribute('hidden', '');
        form.reset();
        form.querySelectorAll('input[type="text"]').forEach(input => { input.type = 'password'; });
        toast('เปลี่ยนรหัสผ่านแล้ว · ใช้รหัสใหม่ในการเข้าสู่ระบบครั้งถัดไป', 'success', 4200);
        if (typeof onChanged === 'function') onChanged(result);
      });
    }
  });
}
