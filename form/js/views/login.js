import { login } from '../cloud.js';
import { brand } from '../ui.js';
import { icon } from '../icons.js';
import { e } from '../utils.js';
import { isLocalMode } from '../cloud.js';
import { navigate } from '../app.js';
import { toast } from '../ui.js';

export function loginView({ onLogin }) {
  const lastId = localStorage.getItem('formio_last_id') || '';
  const local = isLocalMode();

  const html = `<div class="login-page">
    <aside class="login-aside">
      <div class="login-aside__glow"></div>
      <div class="login-aside__top">
        ${brand({ href: '#/login', variant: 'light', subtitle: 'แบบสอบถามออนไลน์' })}
        <span class="login-aside__badge">${icon('sparkles', 13)} ฟังทุกเสียง</span>
      </div>

      <div class="login-aside__hero">
        <span class="eyebrow eyebrow--gold">แบบสอบถามที่ใช่<br>เริ่มจากคำถามที่ดี</span>
        <h1>ทุกความคิดเห็น<br><em>มีความหมาย</em></h1>
        <p>สร้างแบบสอบถามออนไลน์ได้ในไม่กี่นาที แชร์ด้วยลิงก์หรือ QR Code และดูผลตอบรับแบบเรียลไทม์ — ผู้ตอบไม่ต้องเข้าสู่ระบบ</p>
      </div>

      <div class="login-preview">
        <div class="login-preview__card">
          <div class="login-preview__head">
            <span class="login-preview__dot"></span>
            <span>แบบสำรวจความพึงพอใจ</span>
            <span class="login-preview__live">${icon('circle-check-big', 11)} เปิดรับ</span>
          </div>
          <h3>กิจกรรมใดที่ช่วยให้คุณเข้าใจบทเรียนได้ดีที่สุด?</h3>
          <div class="login-preview__options">
            <span class="login-preview__option is-picked"><i>A</i> การอธิบายพร้อมตัวอย่าง <b>${icon('check', 12)}</b></span>
            <span class="login-preview__option"><i>B</i> แบบฝึกหัดระหว่างคาบ</span>
            <span class="login-preview__option"><i>C</i> งานกลุ่มและกิจกรรมแข่งขัน</span>
          </div>
          <div class="login-preview__foot">
            <span>${icon('users', 12)} มีผู้ตอบแล้ว 128 คน</span>
            <span>ตอบแล้ว 68%</span>
          </div>
        </div>
        <div class="login-float login-float--qr">
          <span class="login-float__icon">${icon('qr', 16)}</span>
          <span><strong>สแกนแล้วตอบได้เลย</strong><small>ไม่ต้องเข้าสู่ระบบ</small></span>
        </div>
        <div class="login-float login-float--chart">
          <span class="login-float__icon">${icon('bar-chart', 16)}</span>
          <span><strong>สรุปผลอัตโนมัติ</strong><small>กราฟและ CSV พร้อมใช้</small></span>
        </div>
      </div>

      <div class="login-aside__foot">
        <span>${icon('shield-check', 12)} ระบบเดียวกับ 02._.mock · ข้อมูลปลอดภัย</span>
        <span>© 2569 02._.form</span>
      </div>
    </aside>

    <section class="login-main">
      <div class="login-main__inner">
        <div class="login-mobile-brand">
          ${brand({ href: '#/login', subtitle: 'แบบสอบถามออนไลน์' })}
          <span class="badge badge--gold">${icon('sparkles', 12)} ฟังทุกเสียง</span>
        </div>

        <div class="login-card">
          <span class="eyebrow">สำหรับผู้สร้างแบบสอบถาม</span>
          <h2>เข้าสู่ระบบ</h2>
          <p class="login-card__lead">ใช้บัญชีเดียวกับระบบ <strong>02._.mock</strong> — บัญชีเริ่มต้นคือ Wich Pitchon</p>

          <form class="login-form" data-login-form novalidate>
            <div class="field">
              <label class="field__label" for="login-id">รหัสผู้ใช้ หรือ ชื่อ–นามสกุล</label>
              <div class="input-wrap">
                ${icon('user', 17)}
                <input class="input input--lg" id="login-id" name="identifier" type="text" autocomplete="username" placeholder="เช่น Wich Pitchon หรือ TCH-0001" value="${e(lastId)}" required>
              </div>
            </div>

            <div class="field">
              <label class="field__label" for="login-password">รหัสผ่าน</label>
              <div class="input-wrap">
                ${icon('lock', 17)}
                <input class="input input--lg" id="login-password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required>
                <button class="input-wrap__action" type="button" data-toggle-password aria-label="แสดงรหัสผ่าน">${icon('eye', 17)}</button>
              </div>
            </div>

            <div class="form-error" data-login-error role="alert">
              ${icon('alert-circle', 15)}<span></span>
            </div>

            <button class="btn btn--primary btn--lg btn--wide login-submit" type="submit">
              <span class="btn__label">${icon('arrow-right', 17)} เข้าสู่ระบบ</span>
              <span class="spinner spinner--sm" aria-hidden="true"></span>
            </button>
          </form>

          <div class="login-hint">
            <span class="login-hint__icon">${icon('info', 15)}</span>
            <p>หากลืมรหัสผ่าน ติดต่อผู้ดูแลระบบเพื่อรีเซ็ตให้ — ผู้ตอบแบบสอบถามไม่ต้องเข้าสู่ระบบ</p>
          </div>

          ${local ? `<div class="login-demo">
            <strong>${icon('info', 14)} โหมดทดลองในเครื่อง</strong>
            <span>เข้าใช้งานด้วย <b>Wich Pitchon</b> และรหัสผ่าน <b>123456</b></span>
          </div>` : ''}

          <div class="login-card__foot">
            <span>${icon('shield-check', 13)} การเชื่อมต่อถูกเข้ารหัส</span>
            <span>02._.form · 2569</span>
          </div>
        </div>
      </div>
    </section>
  </div>`;

  function mount(root) {
    const form = root.querySelector('[data-login-form]');
    const errorBox = root.querySelector('[data-login-error]');
    const submit = root.querySelector('.login-submit');

    const showError = message => {
      errorBox.querySelector('span').textContent = message;
      errorBox.classList.add('is-visible');
      form.classList.add('has-error');
    };
    const clearError = () => {
      errorBox.classList.remove('is-visible');
      form.classList.remove('has-error');
    };

    root.querySelector('[data-toggle-password]')?.addEventListener('click', event => {
      const button = event.currentTarget;
      const input = root.querySelector('#login-password');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.innerHTML = icon(show ? 'eye-off' : 'eye', 17);
      button.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      clearError();
      const identifier = form.identifier.value.trim();
      const password = form.password.value;
      if (!identifier) {
        showError('กรุณากรอกรหัสผู้ใช้หรือชื่อ–นามสกุล');
        form.identifier.focus();
        return;
      }
      if (!password) {
        showError('กรุณากรอกรหัสผ่าน');
        form.password.focus();
        return;
      }
      submit.classList.add('is-loading');
      submit.disabled = true;
      try {
        const session = await login(identifier, password);
        localStorage.setItem('formio_last_id', identifier);
        onLogin(session);
        toast(`ยินดีต้อนรับ ${session.name}`, 'success');
        navigate('/', { replace: true });
      } catch (error) {
        showError(error?.message || 'เข้าสู่ระบบไม่สำเร็จ');
        submit.classList.remove('is-loading');
        submit.disabled = false;
      }
    });

    setTimeout(() => {
      if (!form.identifier.value) form.identifier.focus();
      else form.password.focus();
    }, 120);
  }

  return { html, mount };
}
