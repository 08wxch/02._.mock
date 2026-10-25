import { e } from './utils.js';

export function questionImageHTML(question, className = 'question-figure') {
  const url = String(question?.image || '').trim();
  if (!url) return '';
  const alt = String(question?.imageAlt || 'ภาพประกอบโจทย์').trim() || 'ภาพประกอบโจทย์';
  return `<figure class="${className}"><img src="${e(url)}" alt="${e(alt)}" loading="lazy" decoding="async"></figure>`;
}
