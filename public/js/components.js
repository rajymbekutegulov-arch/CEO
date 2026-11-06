import { t, pick, getLang, setLang } from './i18n.js';
import { state, setUser, resetForLogout } from './store.js';
import { api } from './api.js';
import {
  escapeHtml,
  icon,
  logoMark,
  initials,
  subjectTheme,
  subjectIcon,
  clampPercent,
  go,
} from './utils.js';

/* -------------------------------- toasts -------------------------------- */

let toastSeq = 0;

export function toast(message, type = 'info', timeout = 4200) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const id = `toast-${++toastSeq}`;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.id = id;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const ico = type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info';
  el.innerHTML = `<span class="toast-icon">${icon(ico, 18)}</span><span class="toast-text">${escapeHtml(message)}</span>
    <button class="toast-close" type="button" aria-label="${escapeHtml(t('close'))}">${icon('close', 16)}</button>`;
  root.appendChild(el);
  const remove = () => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  };
  const timer = setTimeout(remove, timeout);
  el.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

/* -------------------------------- modals -------------------------------- */

export function confirmDialog({
  title,
  text,
  confirmLabel = t('confirm'),
  cancelLabel = t('cancel'),
  danger = false,
}) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.innerHTML = `
      <form method="dialog" class="modal-card">
        <div class="modal-icon ${danger ? 'is-danger' : ''}">${icon(danger ? 'alert' : 'info', 22)}</div>
        <h2 class="modal-title">${escapeHtml(title)}</h2>
        <p class="modal-text">${escapeHtml(text)}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" value="cancel">${escapeHtml(cancelLabel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </form>`;
    root.appendChild(dialog);
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      dialog.close();
      setTimeout(() => dialog.remove(), 150);
    };
    dialog.addEventListener('close', () => finish(false));
    dialog.querySelector('button[value="cancel"]').addEventListener('click', (e) => {
      e.preventDefault();
      finish(false);
    });
    dialog.querySelector('button[value="confirm"]').addEventListener('click', (e) => {
      e.preventDefault();
      finish(true);
    });
    dialog.showModal();
  });
}

/* ------------------------------ state blocks ---------------------------- */

export function loadingState(message = t('loading')) {
  return `<div class="state-block" role="status">
    <span class="spinner" aria-hidden="true"></span>
    <p>${escapeHtml(message)}</p>
  </div>`;
}

export function errorState(message, { onRetry = null, title = t('errorTitle'), text = t('errorText') } = {}) {
  const node = document.createElement('div');
  node.className = 'state-block state-error';
  node.innerHTML = `<div class="state-icon">${icon('alert', 30)}</div>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message || text)}</p>
    <div class="state-actions">
      <button class="btn btn-primary" type="button" data-retry>${icon('refresh', 18)} ${escapeHtml(t('retry'))}</button>
      <a class="btn btn-secondary" href="#/subjects">${escapeHtml(t('goSubjects'))}</a>
    </div>`;
  if (onRetry) node.querySelector('[data-retry]').addEventListener('click', onRetry);
  else node.querySelector('[data-retry]').remove();
  return node;
}

export function emptyState({ iconName = 'book', title, text, action = '' }) {
  return `<div class="state-block state-empty">
    <div class="state-icon">${icon(iconName, 30)}</div>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(text)}</p>
    ${action ? `<div class="state-actions">${action}</div>` : ''}
  </div>`;
}

export function skeletonPage() {
  return `<div class="container page page-skeleton">
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton-grid">
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    </div>
  </div>`;
}

/* ------------------------------- fragments ------------------------------ */

export function progressBar(percent, tone = 'brand', label = false) {
  const value = clampPercent(percent);
  return `<div class="progress tone-${tone}" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(t('progress'))}: ${value}%">
    <span class="progress-bar" style="width:${value}%"></span>
  </div>${label ? `<span class="progress-value">${value}%</span>` : ''}`;
}

export function scoreRing(percent, { size = 148, label = null } = {}) {
  const value = clampPercent(percent);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const tone = value >= 80 ? 'great' : value >= 50 ? 'good' : 'low';
  return `<div class="score-ring tone-${tone}" style="--ring-size:${size}px">
    <svg viewBox="0 0 128 128" role="img" aria-label="${escapeHtml(label || `${value}%`)}">
      <circle class="ring-track" cx="64" cy="64" r="${radius}"></circle>
      <circle class="ring-value" cx="64" cy="64" r="${radius}"
        stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
    </svg>
    <div class="score-ring-center"><strong>${value}%</strong>${label ? `<span>${escapeHtml(label)}</span>` : ''}</div>
  </div>`;
}

export function chip(text, tone = 'muted') {
  return `<span class="chip chip-${tone}">${escapeHtml(text)}</span>`;
}

export function userAvatar(name, size = 38) {
  return `<span class="avatar theme-${initials(name)}" style="--avatar-size:${size}px" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

export function pageHead({ eyebrow, title, text, actions = '' }) {
  return `<header class="page-head">
    <div class="page-head-copy">
      ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
      <h1>${escapeHtml(title)}</h1>
      ${text ? `<p class="page-lead">${escapeHtml(text)}</p>` : ''}
    </div>
    ${actions ? `<div class="page-head-actions">${actions}</div>` : ''}
  </header>`;
}

export function subjectCard(subject, index, { progress = null, href = null, compact = false } = {}) {
  const theme = subjectTheme(subject.id, index);
  const link = href || `#/subject/${encodeURIComponent(subject.id)}`;
  const percent = progress ? progress.percent : 0;
  return `<a class="subject-card theme-${theme} ${compact ? 'is-compact' : ''}" href="${link}">
    <span class="subject-icon">${icon(subjectIcon(subject.id), 26)}</span>
    <span class="subject-body">
      <span class="subject-name">${escapeHtml(pick(subject.title))}</span>
      <span class="subject-tagline">${escapeHtml(pick(subject.tagline))}</span>
      <span class="subject-meta">
        <span>${icon('book', 15)} ${escapeHtml(t('topicsCount', { count: subject.topicCount }))}</span>
        <span>${icon('target', 15)} ${escapeHtml(t('testsCount', { count: subject.topics.length + 1 }))}</span>
      </span>
      ${progress ? `<span class="subject-progress">
        <span class="subject-progress-row"><span>${escapeHtml(t('completed'))}</span><span>${percent}%</span></span>
        ${progressBar(percent, theme)}
      </span>` : ''}
    </span>
    <span class="subject-arrow">${icon('arrow-up-right', 20)}</span>
  </a>`;
}

/* --------------------------------- header ------------------------------- */

function isActive(path, target) {
  if (target === '/') return path === '/';
  if (target === '/subjects') {
    return ['/subjects', '/subject', '/lesson', '/practice', '/quiz', '/exam', '/results'].some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
  }
  return path === target || path.startsWith(`${target}/`);
}

function headerControls(mobile = false) {
  const lang = getLang();
  const user = state.user;
  return `
    <div class="lang-switch" role="group" aria-label="${escapeHtml(t('switchLanguage'))}">
      <button type="button" class="lang-btn ${lang === 'ru' ? 'is-active' : ''}" data-lang="ru" aria-pressed="${lang === 'ru'}" title="${escapeHtml(t('ru'))}">RU</button>
      <button type="button" class="lang-btn ${lang === 'kz' ? 'is-active' : ''}" data-lang="kz" aria-pressed="${lang === 'kz'}" title="${escapeHtml(t('kz'))}">KZ</button>
    </div>
    <div class="header-auth ${mobile ? 'is-mobile' : ''}">
      ${
        user
          ? `<a class="user-pill" href="#/profile" title="${escapeHtml(t('profile'))}">
               ${userAvatar(user.name, 32)}
               <span class="user-name">${escapeHtml(user.name.split(' ')[0])}</span>
             </a>
             <button type="button" class="icon-btn" data-logout aria-label="${escapeHtml(t('logout'))}" title="${escapeHtml(t('logout'))}">${icon('logout', 19)}</button>`
          : `<a class="btn btn-ghost btn-sm" href="#/login">${escapeHtml(t('navLogin'))}</a>
             <a class="btn btn-primary btn-sm" href="#/register">${escapeHtml(t('navRegister'))}</a>`
      }
    </div>`;
}

export function renderHeader(root, path) {
  const user = state.user;
  const navItems = [
    { href: '#/', label: t('navHome'), target: '/' },
    { href: '#/subjects', label: t('navSubjects'), target: '/subjects' },
  ];
  if (user) navItems.push({ href: '#/profile', label: t('navProfile'), target: '/profile' });
  if (user?.role === 'teacher') navItems.push({ href: '#/teacher', label: t('navTeacher'), target: '/teacher' });

  root.innerHTML = `
    <header class="site-header" id="siteHeader">
      <div class="container header-inner">
        <a class="brand" href="#/" aria-label="${escapeHtml(t('appName'))}">
          ${logoMark(38)}
          <span class="brand-text"><strong>ЕНТ</strong><small>${escapeHtml(t('appTagline'))} · №8</small></span>
        </a>
        <nav class="main-nav" aria-label="${escapeHtml(t('navMenu'))}">
          ${navItems
            .map(
              (item) =>
                `<a class="nav-link ${isActive(path, item.target) ? 'is-active' : ''}" href="${item.href}" ${
                  isActive(path, item.target) ? 'aria-current="page"' : ''
                }>${escapeHtml(item.label)}</a>`,
            )
            .join('')}
        </nav>
        <div class="header-actions">
          ${headerControls()}
          <button type="button" class="mobile-toggle" aria-label="${escapeHtml(t('navOpenMenu'))}" aria-expanded="false" aria-controls="mobileNav">
            ${icon('menu', 22)}
          </button>
        </div>
      </div>
      <div class="mobile-nav" id="mobileNav" hidden>
        <nav class="mobile-nav-links" aria-label="${escapeHtml(t('navMenu'))}">
          ${navItems
            .map(
              (item) =>
                `<a class="mobile-nav-link ${isActive(path, item.target) ? 'is-active' : ''}" href="${item.href}">${escapeHtml(item.label)}</a>`,
            )
            .join('')}
        </nav>
        <div class="mobile-nav-controls">${headerControls(true)}</div>
      </div>
    </header>`;

  wireHeader(root);
}

function wireHeader(root) {
  const header = root.querySelector('.site-header');
  const toggle = root.querySelector('.mobile-toggle');
  const mobileNav = root.querySelector('#mobileNav');

  const closeMenu = () => {
    if (!header || !toggle || !mobileNav) return;
    header.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', t('navOpenMenu'));
    mobileNav.hidden = true;
  };

  toggle?.addEventListener('click', () => {
    const open = header.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? t('navCloseMenu') : t('navOpenMenu'));
    mobileNav.hidden = !open;
    toggle.innerHTML = icon(open ? 'close' : 'menu', 22);
  });

  root.querySelectorAll('.mobile-nav a').forEach((a) => a.addEventListener('click', closeMenu));

  root.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => changeLanguage(btn.dataset.lang));
  });

  root.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api.logout();
      } catch { /* session is local anyway */ }
      resetForLogout();
      toast(t('logout'), 'success');
      go('/');
      window.dispatchEvent(new CustomEvent('app:auth'));
    });
  });
}

export async function changeLanguage(lang) {
  if (lang !== 'ru' && lang !== 'kz') return;
  setLang(lang);
  state.lang = lang;
  if (state.user) {
    state.user.language = lang;
    try {
      await api.updateMe({ language: lang });
    } catch (err) {
      toast(t('errorGeneric'), 'error');
    }
  }
  window.dispatchEvent(new CustomEvent('app:language'));
}

/* --------------------------------- footer ------------------------------- */

export function renderFooter(root) {
  root.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          ${logoMark(32)}
          <div>
            <strong>${escapeHtml(t('appName'))}</strong>
            <p>${escapeHtml(t('homeSubtitle'))}</p>
          </div>
        </div>
        <nav class="footer-nav" aria-label="${escapeHtml(t('navMenu'))}">
          <a href="#/">${escapeHtml(t('navHome'))}</a>
          <a href="#/subjects">${escapeHtml(t('navSubjects'))}</a>
          <a href="#/profile">${escapeHtml(t('profile'))}</a>
          <a href="#/teacher">${escapeHtml(t('navTeacher'))}</a>
        </nav>
      </div>
      <div class="container footer-bottom">
        <span>© ${new Date().getFullYear()} ${escapeHtml(t('appName'))}</span>
        <span>${escapeHtml(t('bilingualTitle'))} · RU / KZ</span>
      </div>
    </footer>`;
}

/* ------------------------------ auth prompt ----------------------------- */

export function authPrompt(nextPath, { title = t('loginRequired'), text = t('loginRequiredText') } = {}) {
  const next = encodeURIComponent(nextPath);
  return `<div class="auth-prompt card">
    <div class="auth-prompt-icon">${icon('lock', 26)}</div>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(text)}</p>
    <div class="auth-prompt-actions">
      <a class="btn btn-primary" href="#/login?next=${next}">${escapeHtml(t('login'))}</a>
      <a class="btn btn-secondary" href="#/register?next=${next}">${escapeHtml(t('register'))}</a>
    </div>
  </div>`;
}
