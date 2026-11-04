import { icon } from './icons.js';
import { openModal, toast, badge } from './ui.js';
import { copyText, publicLink, safeFilename, e } from './utils.js';
import { qrSvg, downloadQrCard } from './qr.js';

export function shareUrl(form) {
  return publicLink(form.slug);
}

export function openQrModal(form, { onCopy } = {}) {
  const url = shareUrl(form);
  openModal({
    title: 'QR Code สำหรับแชร์',
    eyebrow: 'สแกนเพื่อทำแบบสอบถาม',
    size: 'sm',
    body: `<div class="qr-modal">
      <div class="qr-modal__frame">${qrSvg(url, 260, 3)}</div>
      <h3 class="qr-modal__title">${e(form.title || 'แบบสอบถาม')}</h3>
      <p class="qr-modal__hint">ให้ผู้ตอบสแกน QR Code นี้ หรือเปิดลิงก์ด้านล่าง — ไม่ต้องเข้าสู่ระบบ</p>
      <div class="link-box">
        <span class="link-box__icon">${icon('link', 15)}</span>
        <code>${e(url)}</code>
        <button class="icon-btn" type="button" data-copy-link title="คัดลอกลิงก์" aria-label="คัดลอกลิงก์">${icon('copy', 16)}</button>
      </div>
    </div>`,
    footer: `<button class="btn btn--ghost" type="button" data-download-qr>${icon('download', 16)} ดาวน์โหลด QR</button>
      <button class="btn btn--primary" type="button" data-copy-qr>${icon('copy', 16)} คัดลอกลิงก์</button>`,
    onMount: root => {
      const copy = async () => {
        await copyText(url);
        toast('คัดลอกลิงก์แล้ว', 'success');
        onCopy?.();
      };
      root.querySelector('[data-copy-link]')?.addEventListener('click', copy);
      root.querySelector('[data-copy-qr]')?.addEventListener('click', copy);
      root.querySelector('[data-download-qr]')?.addEventListener('click', async event => {
        const btn = event.currentTarget;
        btn.disabled = true;
        try {
          await downloadQrCard({
            text: url,
            title: form.title,
            caption: 'สแกนเพื่อทำแบบสอบถาม',
            filename: `${safeFilename(form.title)}-${form.slug}`
          });
          toast('ดาวน์โหลด QR Code แล้ว', 'success');
        } catch (error) {
          toast(error?.message || 'ดาวน์โหลดไม่สำเร็จ', 'error');
        } finally {
          btn.disabled = false;
        }
      });
    }
  });
}

export function openShareModal(form) {
  const url = shareUrl(form);
  openModal({
    title: 'แชร์แบบสอบถาม',
    eyebrow: 'ส่งลิงก์ให้ผู้ตอบ',
    size: 'md',
    body: `<div class="share-modal">
      <div class="share-modal__qr">${qrSvg(url, 168, 3)}</div>
      <div class="share-modal__copy">
        <h3>${e(form.title)}</h3>
        <p>${badge('ไม่ต้องเข้าสู่ระบบ', 'gold')} ผู้ตอบเปิดลิงก์แล้วตอบได้ทันที</p>
        <div class="link-box">
          <span class="link-box__icon">${icon('link', 15)}</span>
          <code>${e(url)}</code>
          <button class="icon-btn" type="button" data-copy-link aria-label="คัดลอกลิงก์">${icon('copy', 16)}</button>
        </div>
      </div>
    </div>`,
    footer: `<button class="btn btn--ghost" type="button" data-download-qr>${icon('download', 16)} ดาวน์โหลด QR</button>
      <a class="btn btn--ghost" href="${url}" target="_blank" rel="noopener">${icon('external-link', 16)} เปิดฟอร์ม</a>
      <button class="btn btn--primary" type="button" data-copy-qr>${icon('copy', 16)} คัดลอกลิงก์</button>`,
    onMount: root => {
      const copy = async () => {
        await copyText(url);
        toast('คัดลอกลิงก์แล้ว', 'success');
      };
      root.querySelector('[data-copy-link]')?.addEventListener('click', copy);
      root.querySelector('[data-copy-qr]')?.addEventListener('click', copy);
      root.querySelector('[data-download-qr]')?.addEventListener('click', async () => {
        await downloadQrCard({ text: url, title: form.title, filename: form.slug });
        toast('ดาวน์โหลด QR Code แล้ว', 'success');
      });
    }
  });
}
