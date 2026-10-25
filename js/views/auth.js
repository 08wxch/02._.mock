import { icon, brandMark } from '../icons.js';
import { e, thaiDate, thaiTime, formatDuration } from '../utils.js';
import { brand, toast, openModal, closeModal } from '../ui.js';
import { getDB, setSession, clearSession, classIdsOf, studentClassLabel, replaceDB } from '../store.js';
import { cloudLogin, cloudGuestLogin, cloudLogout } from '../cloud.js';
import { navigate } from '../router.js';

function authLiveStats(db = null) {
  const students = Array.isArray(db?.students) ? db.students : [];
  const exams = Array.isArray(db?.exams) ? db.exams : [];
  const attempts = Array.isArray(db?.attempts) ? db.attempts : [];
  const submitted = attempts.filter(attempt => attempt.status && attempt.status !== 'in_progress' && exams.some(exam => exam.id === attempt.examId));
  const attended = new Set(submitted.map(attempt => attempt.studentId).filter(Boolean)).size;
  const openExams = exams.filter(exam => exam.status === 'open').length;
  const announced = exams.filter(exam => exam.status === 'announced').length;
  return [
    [`นักเรียนเข้าสอบแล้ว ${attended} คน`, `จากนักเรียน ${students.length} คน`],
    [`ชุดสอบในระบบ ${exams.length} ชุด`, `เปิดสอบอยู่ ${openExams} ชุด`],
    [`ส่งคำตอบแล้ว ${submitted.length} ครั้ง`, `ประกาศผลแล้ว ${announced} ชุด`]
  ];
}

function readLiveDB() {
  return getDB();
}

function authVisual(db = null) {
  const initialLive = authLiveStats(db)[0];
  return `<section class="auth-visual">
    <div class="auth-visual__top">
      ${brand({ href: '#/login', variant: 'light', subtitle: 'ระบบสอบออนไลน์' })}
      <span class="auth-visual__badge">${icon('sparkles', 13)} ห้องสอบที่ออกแบบมาเพื่อนักเรียน</span>
    </div>
    <div class="auth-visual__hero">
      <div class="eyebrow eyebrow--light" style="color:#d9b775"><span style="width:18px;height:1px;background:#d9b775"></span>จากห้องเรียน สู่หน้าจอ</div>
      <h1 class="auth-visual__quote">ตั้งสติให้มั่นทำสมาธิให้ดี<br><em>แล้วขอให้โชคดีกับการทำข้อสอบ</em></h1>
      <p>ทำข้อสอบได้จากทุกอุปกรณ์ ระบบบันทึกคำตอบให้อัตโนมัติ พร้อมบอกเวลาที่เหลือ และดูผลสอบได้ทันทีเมื่อครูประกาศผล</p>
      <div class="auth-points">
        <div class="auth-point"><span>${icon('check', 14)}</span><span>ตรวจผลอัตโนมัติ</span></div>
        <div class="auth-point"><span>${icon('cloud-check', 14)}</span><span>บันทึกคำตอบทุกคลิก</span></div>
        <div class="auth-point"><span>${icon('shield-check', 14)}</span><span>ครูคุมการประกาศผล</span></div>
      </div>
    </div>
    <div class="auth-preview-wrap">
      <div class="auth-float auth-float--one">
        <span class="auth-float__icon">${icon('users', 15)}</span>
        <span><strong data-auth-live-stat>${e(initialLive[0])}</strong><small data-auth-live-sub>${e(initialLive[1])}</small></span>
      </div>
      <div class="auth-preview">
        <div class="auth-preview__top">
          <span>คณิตศาสตร์ · บทที่ 3</span>
          <strong>${icon('clock', 11)} <span data-auth-countdown>24:35</span></strong>
        </div>
        <h3>ข้อ 5 จาก 20 — 2 + 3 × 4 เท่ากับเท่าใด?</h3>
        <div class="auth-preview__options" data-auth-options>
          <button class="auth-preview__option" type="button" data-auth-option="A"><b>A</b><span>10</span>${icon('check-circle', 15)}</button>
          <button class="auth-preview__option is-selected" type="button" data-auth-option="B"><b>B</b><span>14</span>${icon('check-circle', 15)}</button>
          <button class="auth-preview__option" type="button" data-auth-option="C"><b>C</b><span>20</span>${icon('check-circle', 15)}</button>
          <button class="auth-preview__option" type="button" data-auth-option="D"><b>D</b><span>24</span>${icon('check-circle', 15)}</button>
        </div>
        <div class="auth-preview__foot">
          <span data-auth-save-label>${icon('cloud-check', 12)} บันทึกคำตอบข้อ B แล้ว</span>
          <span>เลือกได้สูงสุด 1 ข้อ</span>
        </div>
      </div>
      <div class="auth-float auth-float--two">
        <span class="auth-float__icon">${icon('bar-chart', 15)}</span>
        <span><strong>ตรวจปรนัยเสร็จใน 0.3 วิ</strong><small>พร้อมให้ครูยืนยัน</small></span>
      </div>
    </div>
    <div class="auth-visual__foot">
      <span>${icon('shield-check', 12)} ข้อมูลสอบซิงก์ออนไลน์อย่างปลอดภัย</span>
      <span>© 2569 02._.mock</span>
    </div>
  </section>`;
}

function studentPanel() {
  return `<div class="auth-tabs" role="tablist" aria-label="วิธีเข้าสอบ">
      <button class="auth-tab is-active" type="button" role="tab" data-auth-tab="code" aria-selected="true">รหัสเข้าสอบ</button>
      <button class="auth-tab" type="button" role="tab" data-auth-tab="account" aria-selected="false">บัญชีนักเรียน</button>
    </div>
    <form class="auth-form is-active" id="code-form" data-auth-form="code" novalidate>
      <div class="field">
        <label>รหัสเข้าสอบ 6 หลัก</label>
        <div class="code-inputs" data-code-inputs>
          ${Array.from({ length: 6 }, (_, i) => `<input class="code-input" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="หลักที่ ${i + 1}" data-code-index="${i}" autocomplete="one-time-code" ${i === 0 ? 'autofocus' : ''}>`).join('')}
        </div>
        <span class="field__hint">รหัสนี้ได้รับจากครูผู้สอนหน้าห้องสอบ</span>
      </div>
      <div class="form-error" data-code-error>${icon('alert-circle', 15)}<span></span></div>
      <button class="btn btn--primary btn--wide btn--lg auth-submit" type="submit">${icon('arrow-right', 17)} เข้าสอบ</button>
    </form>
    <form class="auth-form" id="account-form" data-auth-form="account" novalidate>
      <div class="field">
        <label for="student-code">รหัสนักเรียน หรือ ชื่อ–นามสกุล</label>
        <div class="input-with-icon">${icon('user', 17)}<input class="input input--lg" id="student-code" name="studentCode" placeholder="0000 หรือ ชื่อ นามสกุล" autocomplete="username" value=""></div>
        <span class="field__hint">เข้าสู่ระบบด้วยรหัสนักเรียนหรือชื่อ–นามสกุล</span>
      </div>
      <div class="field">
        <label for="student-password">รหัสผ่าน</label>
        <div class="input-with-icon">${icon('lock', 17)}<input class="input input--lg" id="student-password" name="password" type="password" placeholder="••••••" autocomplete="current-password" value=""></div>
      </div>
      <div class="form-error" data-account-error>${icon('alert-circle', 15)}<span></span></div>
      <button class="btn btn--primary btn--wide btn--lg auth-submit" type="submit">${icon('arrow-right', 17)} เข้าสู่ระบบ</button>
    </form>`;
}

function teacherPanel() {
  return `<form class="auth-form is-active" id="teacher-form" data-auth-form="teacher" novalidate>
    <div class="field">
      <label for="teacher-identifier">รหัสครู หรือ ชื่อ–นามสกุล</label>
      <div class="input-with-icon">${icon('key', 17)}<input class="input input--lg" id="teacher-identifier" name="identifier" type="text" placeholder="TCH/MGR-0000 หรือ ชื่อ นามสกุล" autocomplete="username" value=""></div>
    </div>
    <div class="field">
      <label for="teacher-password">รหัสผ่าน</label>
      <div class="input-with-icon">${icon('lock', 17)}<input class="input input--lg" id="teacher-password" name="password" type="password" placeholder="••••••" autocomplete="current-password" value=""></div>
    </div>
    <div class="form-error" data-teacher-error>${icon('alert-circle', 15)}<span></span></div>
    <button class="btn btn--primary btn--wide btn--lg auth-submit" type="submit">${icon('layout-dashboard', 17)} เข้าสู่หลังบ้านครู</button>
    <div class="teacher-hint">${icon('info', 15)}<span>เข้าสู่ระบบด้วยรหัสครูหรือชื่อ–นามสกุล · รหัสเริ่มต้นเป็น 123456</span></div>
  </form>`;
}

export function authView(ctx) {
  const db = getDB();
  const sharedCode = (ctx.query.get('code') || '').replace(/\D/g, '').slice(0, 6);
  const forceFresh = ctx.query.get('fresh') === '1' || Boolean(sharedCode);
  let freshSignOut = Promise.resolve();
  if (forceFresh) {
    freshSignOut = cloudLogout().catch(err => console.warn('Cloud sign out failed', err));
  }
  const session = ctx.session;
  // A valid session should never be destroyed just because the login route was
  // opened (for example after an in-app refresh or a browser back action).
  // Shared exam links explicitly request a fresh session with ?fresh=1.
  if (!forceFresh && session) {
    const account = session.role === 'teacher'
      ? db.teachers.find(person => person.id === session.teacherId && !person.deletedAt)
      : session.role === 'student'
        ? db.students.find(person => person.id === session.studentId)
        : null;
    if (account) {
      const target = session.role === 'teacher' ? '/teacher' : '/student';
      return {
        html: '<div class="page-loader"><span class="spinner"></span></div>',
        mount() {
          setTimeout(() => {
            if (window.location.hash.startsWith('#/login')) navigate(target, { replace: true });
          }, 0);
        }
      };
    }
  }
  // No usable session (or a shared link asked for a fresh one): start clean.
  clearSession();
  if (ctx.query.get('fresh') === '1') {
    const cleanHash = `#/login${sharedCode ? `?code=${sharedCode}` : ''}`;
    try { history.replaceState(null, '', `${window.location.pathname}${window.location.search}${cleanHash}`); } catch (err) { /* URL cleanup is best effort */ }
  }
  const initialRole = ctx.query.get('role') === 'teacher' ? 'teacher' : 'student';
  const html = `<div class="auth-page">
    ${authVisual(db)}
    <section class="auth-panel">
      <div class="auth-card">
        <div class="auth-mobile-brand">
          ${brand({ href: '#/login' })}
          <span class="badge badge--neutral">${icon('shield-check', 12)} ข้อมูลซิงก์ออนไลน์</span>
        </div>
        <div class="auth-card__intro">
          <div class="eyebrow">ยินดีต้อนรับ</div>
          <h2 data-auth-title>${initialRole === 'teacher' ? 'เข้าสู่ห้องทำงานครู' : 'เข้าสู่ห้องสอบออนไลน์'}</h2>
          <p data-auth-subtitle>${initialRole === 'teacher' ? 'จัดการชุดสอบ รับคำตอบ และประกาศผลได้ในที่เดียว' : 'ใช้รหัสเข้าสอบจากครู หรือเข้าสู่ระบบด้วยบัญชีนักเรียน'}</p>
          <p class="auth-mobile-quote">ตั้งสติให้มั่นทำสมาธิให้ดี <em>แล้วขอให้โชคดีกับการทำข้อสอบ</em></p>
        </div>
        <div class="role-switch" role="tablist" aria-label="เลือกบทบาท">
          <button type="button" data-role-btn="student" class="${initialRole === 'student' ? 'is-active' : ''}" aria-selected="${initialRole === 'student'}">${icon('graduation-cap', 15)} นักเรียน</button>
          <button type="button" data-role-btn="teacher" class="${initialRole === 'teacher' ? 'is-active' : ''}" aria-selected="${initialRole === 'teacher'}">${icon('book-open', 15)} ครู / ผู้จัดการ</button>
        </div>
        <div class="auth-form-panel">
          <div data-role-panel="student" class="${initialRole === 'student' ? '' : 'hidden'}">${studentPanel()}</div>
          <div data-role-panel="teacher" class="${initialRole === 'teacher' ? '' : 'hidden'}">${teacherPanel()}</div>
        </div>
        <div class="auth-card__footer">
          <span>© 2569 02._.mock · ระบบสอบออนไลน์</span>
        </div>
      </div>
    </section>
  </div>`;

  function mount() {
    const page = document.querySelector('.auth-page');
    const rolePanels = {
      student: page.querySelector('[data-role-panel="student"]'),
      teacher: page.querySelector('[data-role-panel="teacher"]')
    };
    const title = page.querySelector('[data-auth-title]');
    const subtitle = page.querySelector('[data-auth-subtitle]');

    function setRole(role) {
      page.querySelectorAll('[data-role-btn]').forEach(btn => {
        const active = btn.dataset.roleBtn === role;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', String(active));
      });
      Object.entries(rolePanels).forEach(([key, panel]) => panel.classList.toggle('hidden', key !== role));
      if (role === 'teacher') {
        page.querySelector('#teacher-form')?.classList.add('is-active');
      } else {
        const activeTab = page.querySelector('[data-auth-tab].is-active');
        if (activeTab) {
          page.querySelectorAll('[data-auth-form]').forEach(form => {
            form.classList.toggle('is-active', form.dataset.authForm === activeTab.dataset.authTab);
          });
        }
      }
      title.textContent = role === 'teacher' ? 'เข้าสู่ห้องทำงานครู' : 'เข้าสู่ห้องสอบออนไลน์';
      subtitle.textContent = role === 'teacher'
        ? 'จัดการชุดสอบ รับคำตอบ และประกาศผลได้ในที่เดียว'
        : 'ใช้รหัสเข้าสอบจากครู หรือเข้าสู่ระบบด้วยบัญชีนักเรียน';
      if (role === 'teacher') setTimeout(() => page.querySelector('#teacher-identifier')?.focus(), 50);
      else setTimeout(() => page.querySelector('[data-code-index="0"]')?.focus(), 50);
    }
    page.querySelectorAll('[data-role-btn]').forEach(btn => btn.addEventListener('click', () => setRole(btn.dataset.roleBtn)));

    // Live countdown + playful preview controls on the login visual
    const countdown = page.querySelector('[data-auth-countdown]');
    if (countdown) {
      let remaining = 24 * 60 + 35;
      const paintCountdown = () => {
        const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
        const seconds = String(remaining % 60).padStart(2, '0');
        countdown.textContent = `${minutes}:${seconds}`;
      };
      paintCountdown();
      const countdownTimer = setInterval(() => {
        if (!document.body.contains(page)) { clearInterval(countdownTimer); return; }
        remaining -= 1;
        if (remaining < 0) remaining = 25 * 60;
        paintCountdown();
      }, 1000);
    }

    const liveStat = page.querySelector('[data-auth-live-stat]');
    const liveSub = page.querySelector('[data-auth-live-sub]');
    if (liveStat && liveSub) {
      let liveIndex = 0;
      let liveStats = authLiveStats(readLiveDB());
      const paintLive = () => {
        const item = liveStats[liveIndex] || liveStats[0];
        liveStat.textContent = item[0];
        liveSub.textContent = item[1];
      };
      paintLive();
      const refreshLive = setInterval(() => {
        if (!document.body.contains(page)) { clearInterval(refreshLive); return; }
        liveStats = authLiveStats(readLiveDB());
        paintLive();
      }, 1000);
      const rotateLive = setInterval(() => {
        if (!document.body.contains(page)) { clearInterval(rotateLive); return; }
        liveStat.style.opacity = '0';
        liveStat.style.transform = 'translateY(4px)';
        liveSub.style.opacity = '0';
        setTimeout(() => {
          liveIndex = (liveIndex + 1) % liveStats.length;
          paintLive();
          liveStat.style.opacity = '1';
          liveStat.style.transform = 'translateY(0)';
          liveSub.style.opacity = '1';
        }, 180);
      }, 4200);
      [liveStat, liveSub].forEach(node => { node.style.transition = 'opacity .18s ease, transform .18s ease'; });
    }

    const optionButtons = [...page.querySelectorAll('[data-auth-option]')];
    const saveLabel = page.querySelector('[data-auth-save-label]');
    optionButtons.forEach(button => button.addEventListener('click', () => {
      optionButtons.forEach(item => item.classList.toggle('is-selected', item === button));
      if (saveLabel) saveLabel.innerHTML = `${icon('cloud-check', 12)} บันทึกคำตอบข้อ ${button.dataset.authOption} แล้ว`;
      button.animate?.(
        [{ transform: 'scale(.985)' }, { transform: 'scale(1)' }],
        { duration: 160, easing: 'ease-out' }
      );
    }));

    // Auth sub-tabs
    const tabs = [...page.querySelectorAll('[data-auth-tab]')];
    const forms = [...page.querySelectorAll('[data-auth-form]')];
    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(t => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
      });
      forms.forEach(form => form.classList.toggle('is-active', form.dataset.authForm === tab.dataset.authTab));
    }));

    const codeInputs = [...page.querySelectorAll('.code-input')];
    // Prefill an exam code from a shared link, then open the confirmation modal.
    const presetCode = (ctx.query.get('code') || '').replace(/\D/g, '').slice(0, 6);
    if (presetCode.length === 6) {
      codeInputs.forEach((input, i) => {
        input.value = presetCode[i];
        input.classList.add('is-filled');
      });
      setTimeout(() => page.querySelector('#code-form')?.requestSubmit(), 220);
    }

    const codeError = page.querySelector('[data-code-error]');
    function codeValue() { return codeInputs.map(i => i.value).join(''); }
    function setCodeError(message) {
      if (!message) {
        codeError.classList.remove('is-visible');
        codeInputs.forEach(i => i.classList.remove('is-error'));
        return;
      }
      codeError.querySelector('span').textContent = message;
      codeError.classList.add('is-visible');
      codeInputs.forEach(i => i.classList.add('is-error'));
    }
    codeInputs.forEach((input, idx) => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(-1);
        input.classList.toggle('is-filled', Boolean(input.value));
        setCodeError('');
        if (input.value && idx < codeInputs.length - 1) codeInputs[idx + 1].focus();
        if (codeValue().length === 6) setTimeout(() => page.querySelector('#code-form').requestSubmit(), 90);
      });
      input.addEventListener('keydown', ev => {
        if (ev.key === 'Backspace' && !input.value && idx > 0) {
          codeInputs[idx - 1].focus();
          codeInputs[idx - 1].value = '';
          codeInputs[idx - 1].classList.remove('is-filled');
          setCodeError('');
        }
        if (ev.key === 'ArrowLeft' && idx > 0) { ev.preventDefault(); codeInputs[idx - 1].focus(); }
        if (ev.key === 'ArrowRight' && idx < codeInputs.length - 1) { ev.preventDefault(); codeInputs[idx + 1].focus(); }
      });
      input.addEventListener('paste', ev => {
        ev.preventDefault();
        const digits = (ev.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        if (!digits) return;
        digits.split('').forEach((d, i) => {
          if (codeInputs[i]) { codeInputs[i].value = d; codeInputs[i].classList.add('is-filled'); }
        });
        setCodeError('');
        codeInputs[Math.min(digits.length, 5)].focus();
        if (digits.length === 6) setTimeout(() => page.querySelector('#code-form').requestSubmit(), 90);
      });
    });

    // Exam code flow
    page.querySelector('#code-form').addEventListener('submit', ev => {
      ev.preventDefault();
      const code = codeValue();
      if (code.length !== 6) {
        setCodeError('กรุณากรอกครบทั้ง 6 หลัก');
        return;
      }
      const exam = db.exams.find(x => x.code === code);
      if (!exam) {
        setCodeError('ไม่พบรหัสเข้าสอบนี้ กรุณาตรวจสอบอีกครั้ง');
        return;
      }
      if (exam.status !== 'open') {
        const message = exam.status === 'announced'
          ? 'ชุดสอบนี้ประกาศผลแล้ว ไม่เปิดรับคำตอบเพิ่ม'
          : exam.status === 'saved' || exam.status === 'draft'
            ? 'ชุดสอบนี้ยังไม่เปิดให้เข้าสอบ กรุณารอประกาศจากครูผู้สอน'
            : 'ชุดสอบนี้ปิดรับคำตอบแล้ว';
        setCodeError(message);
        return;
      }
      const roster = db.students.filter(student => !Array.isArray(exam.assignedStudentIds) || exam.assignedStudentIds.includes(student.id));
      if (!roster.length) {
        setCodeError('ชุดสอบนี้ยังไม่มีรายชื่อผู้เข้าสอบ กรุณาติดต่อครูผู้สอน');
        return;
      }
      openCodeModal(exam, roster);
    });

    function openCodeModal(exam, roster) {
      const byClass = new Map();
      roster.forEach(student => {
        const primaryId = classIdsOf(student)[0];
        const cls = db.classes.find(c => c.id === primaryId);
        const code = cls?.code || student.class || 'ไม่ระบุ class';
        if (!byClass.has(code)) byClass.set(code, []);
        byClass.get(code).push(student);
      });
      const options = [...byClass.entries()].map(([code, list]) => `<optgroup label="${e(code)}">${list.map(student => {
        const label = studentClassLabel(student, db);
        const extra = label && label !== code ? ` · ${e(label)}` : '';
        return `<option value="${e(student.id)}">${e(student.name)} · ${e(student.code)}${extra}</option>`;
      }).join('')}</optgroup>`).join('');
      openModal({
        title: 'ยืนยันตัวตนก่อนเข้าสอบ',
        eyebrow: 'ขั้นตอนที่ 1 จาก 2',
        body: `<div class="submit-summary" style="margin-bottom:16px">
          <span class="submit-summary__icon">${icon('file-text', 21)}</span>
          <span class="submit-summary__copy"><strong>${e(exam.title)}</strong><span>${exam.questions.length} ข้อ · ${exam.duration} นาที · ${exam.totalPoints} คะแนน</span></span>
        </div>
        <div class="field">
          <label for="guest-student">เลือกชื่อของคุณจากรายชื่อที่ครูอนุมัติ</label>
          <select class="select select--lg" id="guest-student" autofocus>
            <option value="">— เลือกชื่อ–นามสกุล —</option>
            ${options}
          </select>
          <span class="field__hint">เห็นเฉพาะ ${roster.length} คนที่ได้รับสิทธิ์เข้าสอบชุดนี้</span>
        </div>
        <div class="form-error" data-guest-error style="margin-top:13px">${icon('alert-circle', 15)}<span></span></div>
        <div class="modal-note">${icon('shield-check', 14)} ระบบจะบันทึกคำตอบภายใต้ชื่อที่เลือก และเริ่มนับเวลาเมื่อเข้าสู่คำชี้แจง</div>`,
        footer: `<button class="btn btn--ghost" type="button" data-modal-close>ยกเลิก</button>
          <button class="btn btn--primary" type="button" data-guest-confirm>${icon('arrow-right', 16)} ไปที่คำชี้แจง</button>`,
        onMount(overlay) {
          const select = overlay.querySelector('#guest-student');
          const error = overlay.querySelector('[data-guest-error]');
          const submit = async () => {
            const student = roster.find(s => s.id === select.value);
            if (!student) {
              error.querySelector('span').textContent = 'กรุณาเลือกชื่อของคุณจากรายชื่อ';
              error.classList.add('is-visible');
              select.setAttribute('aria-invalid', 'true');
              select.focus();
              return;
            }
            const confirmBtn = overlay.querySelector('[data-guest-confirm]');
            if (confirmBtn.disabled) return;
            confirmBtn.disabled = true;
            error.classList.remove('is-visible');
            await freshSignOut;
            const result = await cloudGuestLogin(exam.id, student.id);
            if (!result.ok) {
              confirmBtn.disabled = false;
              error.querySelector('span').textContent = result.error || 'ยืนยันตัวตนไม่สำเร็จ';
              error.classList.add('is-visible');
              return;
            }
            setSession(result.session);
            replaceDB(result.db);
            closeModal();
            toast('ยืนยันตัวตนสำเร็จ อ่านคำชี้แจงก่อนเริ่มสอบ', 'success');
            navigate(`/student/exam/${exam.id}/instructions`);
          };
          overlay.querySelector('[data-guest-confirm]').addEventListener('click', submit);
          select.addEventListener('change', () => {
            error.classList.remove('is-visible');
            select.removeAttribute('aria-invalid');
          });
          select.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); submit(); } });
        }
      });
    }

    // Account login
    page.querySelector('#account-form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const code = page.querySelector('#student-code').value.trim();
      const password = page.querySelector('#student-password').value;
      const error = page.querySelector('[data-account-error]');
      const submitBtn = page.querySelector('#account-form button[type="submit"]');
      if (!code) {
        error.querySelector('span').textContent = 'กรุณากรอกรหัสนักเรียนหรือชื่อ–นามสกุล';
        error.classList.add('is-visible');
        return;
      }
      submitBtn.disabled = true;
      error.classList.remove('is-visible');
      await freshSignOut;
      const result = await cloudLogin(code, password);
      if (!result.ok || result.session.role !== 'student') {
        if (result.ok) await cloudLogout();
        submitBtn.disabled = false;
        error.querySelector('span').textContent = result.error || 'รหัสนักเรียน/ชื่อ หรือรหัสผ่านไม่ถูกต้อง';
        error.classList.add('is-visible');
        page.querySelector('#student-code').setAttribute('aria-invalid', 'true');
        return;
      }
      setSession(result.session);
      replaceDB(result.db);
      toast(`ยินดีต้อนรับ ${result.session.name}`, 'success');
      const sharedExam = sharedCode
        ? (result.db.exams || []).find(exam => exam.code === sharedCode && exam.status === 'open')
        : null;
      navigate(sharedExam ? `/student/exam/${sharedExam.id}/instructions` : '/student');
    });

    // Teacher login by staff code or full name
    page.querySelector('#teacher-form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const identifier = page.querySelector('#teacher-identifier').value.trim();
      const password = page.querySelector('#teacher-password').value;
      const error = page.querySelector('[data-teacher-error]');
      const submitBtn = page.querySelector('#teacher-form button[type="submit"]');
      if (!identifier) {
        error.querySelector('span').textContent = 'กรุณากรอกรหัสครูหรือชื่อ–นามสกุล';
        error.classList.add('is-visible');
        return;
      }
      submitBtn.disabled = true;
      error.classList.remove('is-visible');
      await freshSignOut;
      const result = await cloudLogin(identifier, password);
      if (!result.ok || result.session.role !== 'teacher') {
        if (result.ok) await cloudLogout();
        submitBtn.disabled = false;
        error.querySelector('span').textContent = result.error || 'รหัสครู ชื่อ–นามสกุล หรือรหัสผ่านไม่ถูกต้อง';
        error.classList.add('is-visible');
        page.querySelector('#teacher-identifier').setAttribute('aria-invalid', 'true');
        return;
      }
      page.querySelector('#teacher-identifier').removeAttribute('aria-invalid');
      setSession(result.session);
      replaceDB(result.db);
      toast(`ยินดีต้อนรับ ${result.session.name}`, 'success');
      navigate('/teacher');
    });

    setRole(initialRole);
  }

  return { html, mount, cleanup: null };
}
