import { e } from './utils.js';

export function questionImageHTML(question, className = 'question-figure') {
  const url = String(question?.image || '').trim();
  if (!url) return '';
  const alt = String(question?.imageAlt || 'ภาพประกอบโจทย์').trim() || 'ภาพประกอบโจทย์';
  return `<figure class="${className}"><img src="${e(url)}" alt="${e(alt)}" loading="lazy" decoding="async"></figure>`;
}

export function optionImageHTML(option, className = 'option-figure') {
  const url = String(option?.image || '').trim();
  if (!url) return '';
  const letter = String(option?.id || '').trim();
  const alt = `ภาพประกอบตัวเลือก ${letter || ''}`.trim();
  return `<span class="${className}"><img src="${e(url)}" alt="${e(alt)}" loading="lazy" decoding="async"></span>`;
}
