import { icon } from './icons.js';
import { cloudSetPassword, cloudGetPassword } from './cloud.js';
import { e } from './utils.js';
import { avatar, toast, openModal, closeModal, mountCopyButtons } from './ui.js';
import {
  getDB, findOrganization, studentClassLabel,
  setTeacherPassword, setStudentPassword
} from './store.js';

function maskPassword(value) {
  return '•'.repeat(Math.max(6, Math.min(14, String(value || '').length)));
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
        <div class="profile-detail"><span>${isTeacher ? 'รหัสครู' : 'รหัสนักเรียน'}</span><strong class="profile-code">${e(person.code)} <button class="icon-btn" type="button" data-copy="${e(person.code)}" aria-label="คัดลอกรหัส" title="คัดลอกรหัส">${icon('copy', 12)}</button></strong></div>
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
        <div class="field"><label for="profile-new-password">รหัสผ่านใหม่</label><input class="input" id="profile-new-password" name="password" type="password" minlength="4" maxlength="64" autocomplete="new-password" placeholder="อย่างน้อย 4 ตัวอักษร" required></div>
        <div class="field"><label for="profile-confirm-password">ยืนยันรหัสผ่านใหม่</label><input class="input" id="profile-confirm-password" name="confirm" type="password" minlength="4" maxlength="64" autocomplete="new-password" placeholder="พิมพ์อีกครั้ง" required></div>
        <div class="profile-password-form__actions">
          <button class="btn btn--ghost btn--sm" type="button" data-cancel-password>ยกเลิก</button>
          <button class="btn btn--primary btn--sm" type="submit">${icon('save', 13)} บันทึกรหัสใหม่</button>
        </div>
      </form>
      <p class="account-profile__hint">${icon('shield-check', 12)} ข้อมูลนี้ใช้สำหรับเข้าสู่ระบบเท่านั้น · ครูในหน่วยงานเดียวกันเห็นข้อมูลนักเรียนได้</p>
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
      form?.addEventListener('submit', async ev => {
        ev.preventDefault();
        const next = String(new FormData(form).get('password') || '');
        const confirm = String(new FormData(form).get('confirm') || '');
        if (next !== confirm) { toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'error'); return; }
        const previous = person.password;
        const result = isTeacher
          ? setTeacherPassword(person.id, next, session)
          : setStudentPassword(person.id, next, session);
        if (!result.ok) { toast(result.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ', 'error'); return; }
        person.password = next;
        const submit = form.querySelector('button[type=submit]');
        if (submit) submit.disabled = true;
        const cloud = await cloudSetPassword(isTeacher ? 'teacher' : 'student', person.id, next);
        if (submit) submit.disabled = false;
        if (!cloud.ok) {
          if (isTeacher) setTeacherPassword(person.id, previous, session);
          else setStudentPassword(person.id, previous, session);
          person.password = previous;
          toast(cloud.error || 'อัปเดตรหัสผ่านบนคลาวด์ไม่สำเร็จ กรุณาลองใหม่', 'error', 6000);
          return;
        }
        visible = false;
        if (secret) secret.textContent = maskPassword(next);
        if (reveal) { reveal.innerHTML = icon('eye', 15); reveal.setAttribute('aria-label', 'เปิดดูรหัสผ่าน'); }
        form.setAttribute('hidden', '');
        form.reset();
        toast('เปลี่ยนรหัสผ่านแล้ว', 'success');
        if (typeof onChanged === 'function') onChanged(result);
      });
    }
  });
}
