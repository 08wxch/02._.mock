import { downloadBlob, safeFilename } from './utils.js';

function build(text) {
  if (typeof window.qrcode !== 'function') {
    throw new Error('ไลบรารี QR Code ยังโหลดไม่เสร็จ');
  }
  const qr = window.qrcode(0, 'M');
  qr.addData(String(text));
  qr.make();
  return qr;
}

export function qrSvg(text, pixelSize = 220, margin = 4) {
  const qr = build(text);
  const count = qr.getModuleCount();
  const total = count + margin * 2;
  const parts = [];
  for (let row = 0; row < count; row += 1) {
    let start = -1;
    for (let col = 0; col <= count; col += 1) {
      const dark = col < count && qr.isDark(row, col);
      if (dark && start < 0) start = col;
      if (!dark && start >= 0) {
        parts.push(`M${start + margin} ${row + margin}h${col - start}v1H${start + margin}z`);
        start = -1;
      }
    }
  }
  return `<svg class="qr-svg" width="${pixelSize}" height="${pixelSize}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR Code">
    <rect width="${total}" height="${total}" fill="#ffffff"/>
    <path d="${parts.join('')}" fill="#0a0a0a"/>
  </svg>`;
}

export function qrCanvas(text, pixelSize = 720, margin = 4) {
  const qr = build(text);
  const count = qr.getModuleCount();
  const total = count + margin * 2;
  const scale = Math.max(1, Math.floor(pixelSize / total));
  const size = scale * total;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#0a0a0a';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
      }
    }
  }
  return canvas;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || '').split(/(\s+)/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current + word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current.trim());
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = next;
    }
  }
  if (lines.length < maxLines && current.trim()) lines.push(current.trim());
  if (lines.length === maxLines && words.length) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth || current.trim()) {
      let clipped = last;
      while (clipped.length > 2 && ctx.measureText(`${clipped}…`).width > maxWidth) clipped = clipped.slice(0, -1);
      lines[maxLines - 1] = `${clipped}…`;
    }
  }
  return lines;
}

export async function downloadQrCard({ text, title = 'แบบสอบถาม', caption = 'สแกนเพื่อทำแบบสอบถาม', filename = 'qr-code' }) {
  try { await document.fonts.ready; } catch { /* noop */ }

  const width = 1080;
  const height = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f1ede5';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#fffdf9';
  roundRect(ctx, 60, 70, width - 120, height - 140, 44);
  ctx.fill();

  ctx.strokeStyle = '#e2dccf';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0a0a0a';
  ctx.font = '600 30px "Kanit", "IBM Plex Sans Thai", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('02._.form', width / 2, 170);

  ctx.fillStyle = '#8b8478';
  ctx.font = '400 23px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText(caption, width / 2, 215);

  const qr = qrCanvas(text, 720, 4);
  const target = 700;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, (width - target) / 2, 270, target, target);

  ctx.fillStyle = '#b08d57';
  roundRect(ctx, width / 2 - 95, 1030, 190, 4, 2);
  ctx.fill();

  ctx.fillStyle = '#0a0a0a';
  ctx.font = '600 42px "IBM Plex Sans Thai", sans-serif';
  const lines = wrapText(ctx, title, width - 260, 2);
  lines.forEach((line, index) => ctx.fillText(line, width / 2, 1120 + index * 58));

  ctx.fillStyle = '#6f695f';
  ctx.font = '400 22px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText('เปิดลิงก์ด้านล่างหรือสแกน QR Code นี้', width / 2, 1280);

  ctx.fillStyle = '#0a0a0a';
  ctx.font = '500 21px "IBM Plex Mono", monospace';
  const shortLink = String(text).replace(/^https?:\/\//, '');
  ctx.fillText(shortLink.length > 62 ? `${shortLink.slice(0, 59)}…` : shortLink, width / 2, 1322);

  return new Promise(resolve => {
    canvas.toBlob(blob => {
      if (blob) downloadBlob(`${safeFilename(filename, 'qr-code')}-qr.png`, blob);
      resolve(true);
    }, 'image/png');
  });
}
