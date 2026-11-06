import { getLang } from './i18n.js';

/* ------------------------------- escaping ------------------------------- */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function stripHtml(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '');
}

/* -------------------------------- markdown ------------------------------ */

function inline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Small, safe Markdown renderer for lesson texts.
 * Supports headings (##, ###), paragraphs, bullet/numbered lists, quotes, bold/italic.
 */
export function renderMarkdown(source) {
  const text = String(source || '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const out = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let quote = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      const tag = listType === 'ol' ? 'ol' : 'ul';
      out.push(`<${tag}>${listItems.map((li) => `<li>${inline(li)}</li>`).join('')}</${tag}>`);
      listItems = [];
      listType = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote class="lesson-tip">${inline(quote.join(' '))}</blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushAll();
      continue;
    }
    const heading = line.match(/^(#{2,4})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length, 4);
      out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      continue;
    }
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quote.push(quoteMatch[1].trim());
      continue;
    }
    const bullet = line.match(/^[-•]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(bullet[1].trim());
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(ordered[1].trim());
      continue;
    }
    if (listType) flushList();
    if (quote.length) flushQuote();
    paragraph.push(line.trim());
  }
  flushAll();
  return out.join('\n');
}

/* -------------------------------- helpers ------------------------------- */

export function clampPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function formatDate(iso, lang = getLang()) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export function formatDateTime(iso, lang = getLang()) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatClock(totalSeconds) {
  const secs = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export function subjectTheme(subject, index = 0) {
  if (subject === 'geography') return 'geo';
  if (subject === 'math') return 'math';
  if (subject === 'history') return 'history';
  return `alt-${index % 4}`;
}

export function subjectIcon(subject) {
  if (subject === 'geography') return 'globe';
  if (subject === 'math') return 'sigma';
  if (subject === 'history') return 'landmark';
  return 'book';
}

export function initialsColor(name) {
  const themes = ['geo', 'math', 'history', 'alt-1'];
  let sum = 0;
  for (const ch of String(name || '')) sum += ch.charCodeAt(0);
  return themes[sum % themes.length];
}

export function debounce(fn, wait = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function scoreTone(percent) {
  if (percent >= 80) return 'great';
  if (percent >= 50) return 'good';
  return 'low';
}

export function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, queryString = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(queryString) };
}

export function go(path) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (window.location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

/* --------------------------------- icons -------------------------------- */

const ICONS = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9S9.5 5.4 12 3z"/>',
  sigma: '<path d="M17 5H7l6 7-6 7h10"/>',
  landmark: '<path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M2 10l10-6 10 6z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 19H6.5a2.5 2.5 0 0 0 0 5H20"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M17 5.5A3.5 3.5 0 0 1 17 12M18 20a6 6 0 0 0-2-4.5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M7 3v6h10V3M7 21v-7h10v7"/>',
  shield: '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.9 2.6L22.5 18l-2.6.9L19 21l-.9-2.1L15.5 18l2.6-.4z"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/>',
  alert: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
  'external-link': '<path d="M14 3h7v7M21 3l-9 9"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
  star: '<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L3.6 9.8l6.5-.9z"/>',
  wifi: '<path d="M2 8.5a16 16 0 0 1 20 0M5.5 12.5a11 11 0 0 1 13 0M9 16.5a6 6 0 0 1 6 0M12 20h.01"/>',
};

export function icon(name, size = 20, className = '') {
  const path = ICONS[name] || ICONS.info;
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

export function logoMark(size = 36) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <rect width="48" height="48" rx="14" fill="url(#logo-gradient)"/>
    <path d="M15 33V15h10.5c4 0 6.5 2 6.5 5.2 0 2.3-1.2 3.9-3.2 4.6 2.6.6 4.2 2.4 4.2 5 0 3.4-2.8 5.2-7 5.2H15z" fill="#fff"/>
    <path d="M28.5 13.5 33 9M33 13.5 28.5 9" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/>
    <defs><linearGradient id="logo-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6366F1"/><stop offset="1" stop-color="#8B5CF6"/>
    </linearGradient></defs>
  </svg>`;
}
