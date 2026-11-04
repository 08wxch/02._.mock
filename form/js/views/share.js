import { getForm, updateForm } from '../cloud.js';
import { workspaceShell, statusBadge } from '../layout.js';
import { icon } from '../icons.js';
import { toast, avatar } from '../ui.js';
import { qrSvg, downloadQrCard } from '../qr.js';
import { shareUrl } from '../shareKit.js';
import { e, thaiDateTime, statusOf, safeFilename, formatNumber } from '../utils.js';

export async function shareView({ session, formId, query }) {
  const form = await getForm(formId);
  if (form.ownerId !== session.userId && !session.isAdmin) {
    throw new Error('คุณไม่มีสิทธิ์เข้าถึงแบบสอบถามนี้');
  }
  const created = query.get('created') === '1';
  const url = shareUrl(form);
  const meta = statusOf(form);
  const isDraft = meta.key === 'draft';

  const actions = `<a class="btn btn--ghost btn--sm" href="#/">${icon('layout-dashboard', 15)} แดชบอร์ด</a>
    <a class="btn btn--primary btn--sm" href="#/forms/${form.id}/results">${icon('bar-chart', 15)} ดูผลคำตอบ</a>`;

  const content = `<div class="share-page">
    <section class="share-hero">
      <div class="success-mark success-mark--lg">${icon('check', 32)}</div>
      <span class="eyebrow">${created ? 'สร้างและเผยแพร่สำเร็จ' : 'แชร์แบบสอบถาม'}</span>
      <h1>${isDraft ? 'บันทึกแบบสอบถามแล้ว' : 'แบบสอบถามพร้อมแชร์'}</h1>
      <p>${isDraft ? 'เผยแพร่ก่อนเพื่อให้ผู้ตอบเปิดลิงก์ได้' : 'ส่งลิงก์หรือให้ผู้ตอบสแกน QR Code — เปิดตอบได้ทันทีโดยไม่ต้องเข้าสู่ระบบ'}</p>
      <div class="share-hero__chips">
        ${statusBadge(meta.key)}
        <span>${icon('clipboard-list', 13)} ${formatNumber(form.questions?.length || 0)} ข้อ</span>
        ${form.closeAt ? `<span>${icon('calendar-clock', 13)} ปิด ${thaiDateTime(form.closeAt)}</span>` : `<span>${icon('clock', 13)} เปิดรับตลอด</span>`}
      </div>
    </section>

    ${isDraft ? `<div class="notice notice--warning">${icon('alert-triangle', 16)}<span>แบบสอบถามนี้ยังเป็นฉบับร่าง ผู้ที่เปิดลิงก์จะยังทำแบบสอบถามไม่ได้</span><button class="btn btn--primary btn--sm" type="button" data-publish>${icon('send', 14)} เผยแพร่ตอนนี้</button></div>` : ''}

    <section class="share-panel">
      <div class="share-panel__qr">
        <div class="qr-frame">${qrSvg(url, 230, 3)}</div>
        <button class="btn btn--ghost btn--sm" type="button" data-download-qr>${icon('download', 15)} ดาวน์โหลด QR Code</button>
        <span class="share-panel__qr-hint">พิมพ์แจกหรือแนบในประกาศ</span>
      </div>
      <div class="share-panel__info">
        <div class="share-panel__owner">${avatar(form.ownerName || session.name, 30)} <span>${e(form.ownerName || session.name)}</span></div>
        <h2>${e(form.title)}</h2>
        ${form.description ? `<p class="share-panel__desc">${e(form.description)}</p>` : ''}
        <div class="link-box link-box--large">
          <span class="link-box__icon">${icon('link', 16)}</span>
          <code>${e(url)}</code>
          <button class="btn btn--dark btn--sm" type="button" data-copy-text="${e(url)}">${icon('copy', 15)} คัดลอก</button>
        </div>
        <div class="share-panel__actions">
          <a class="btn btn--primary" href="${url}" target="_blank" rel="noopener">${icon('external-link', 16)} เปิดแบบสอบถาม</a>
          <button class="btn btn--ghost" type="button" data-copy-text="${e(url)}">${icon('copy', 16)} คัดลอกลิงก์</button>
        </div>
        <div class="share-panel__links">
          <a href="#/forms/${form.id}/edit">${icon('edit', 14)} แก้ไขคำถาม</a>
          <a href="#/forms/${form.id}/results">${icon('bar-chart', 14)} ดูผลตอบรับ</a>
          <a href="#/">${icon('layout-dashboard', 14)} กลับแดชบอร์ด</a>
        </div>
      </div>
    </section>

    <section class="share-tips">
      <div class="share-tip"><span>01</span><div><strong>คัดลอกลิงก์</strong><p>ส่งในกลุ่มแชท อีเมล หรือประกาศหน้าห้องเรียน</p></div></div>
      <div class="share-tip"><span>02</span><div><strong>หรือใช้ QR Code</strong><p>ดาวน์โหลดไปพิมพ์ติดป้าย ให้ผู้ตอบสแกนด้วยมือถือ</p></div></div>
      <div class="share-tip"><span>03</span><div><strong>ติดตามผล</strong><p>ดูคำตอบแบบเรียลไทม์ พร้อมดาวน์โหลดเป็น CSV</p></div></div>
    </section>
  </div>`;

  const html = workspaceShell({
    session,
    back: '#/',
    crumb: created ? 'สร้างแบบสอบถาม' : 'แชร์แบบสอบถาม',
    title: form.title,
    actions,
    content,
    wide: true
  });

  function mount(root) {
    const download = async event => {
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
    };
    root.querySelectorAll('[data-download-qr]').forEach(btn => btn.addEventListener('click', download));
    root.querySelector('[data-publish]')?.addEventListener('click', async event => {
      const btn = event.currentTarget;
      btn.disabled = true;
      try {
        const patch = { status: 'published' };
        if (form.closeAt && new Date(form.closeAt).getTime() < Date.now()) patch.closeAt = null;
        await updateForm(form.id, patch);
        toast('เผยแพร่แบบสอบถามแล้ว', 'success');
        window.location.reload();
      } catch (error) {
        toast(error?.message || 'เผยแพร่ไม่สำเร็จ', 'error');
        btn.disabled = false;
      }
    });
    return null;
  }

  return { html, mount };
}
