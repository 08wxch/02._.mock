import katex from '../assets/vendor/katex/katex.mjs';
import { e } from './utils.js';

const MATH_TOKEN = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$(?!\$)([^$\n]+?)\$/g;

function mathHTML(source, displayMode) {
  const value = String(source || '').trim();
  if (!value) return '';
  try {
    const html = katex.renderToString(value, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'html',
      maxSize: 30
    });
    return displayMode
      ? `<span class="math-display">${html}</span>`
      : `<span class="math-inline">${html}</span>`;
  } catch (err) {
    return `<code class="math-invalid" title="${e(err.message || 'สมการไม่ถูกต้อง')}">${e(value)}</code>`;
  }
}

/**
 * Renders plain text plus inline/display LaTeX safely.
 * Supported: $...$, $$...$$, \(...\), \[...\].
 */
export function mathText(value) {
  const input = String(value ?? '');
  let cursor = 0;
  let output = '';
  MATH_TOKEN.lastIndex = 0;
  for (const match of input.matchAll(MATH_TOKEN)) {
    output += e(input.slice(cursor, match.index)).replace(/\n/g, '<br>');
    const display = Boolean(match[1] || match[2]);
    const source = match[1] || match[2] || match[3] || match[4] || '';
    output += mathHTML(source, display);
    cursor = match.index + match[0].length;
  }
  output += e(input.slice(cursor)).replace(/\n/g, '<br>');
  return output;
}

export function hasMath(value) {
  MATH_TOKEN.lastIndex = 0;
  return MATH_TOKEN.test(String(value ?? ''));
}
