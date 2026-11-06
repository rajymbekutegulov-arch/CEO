import { t, getLang, setLang } from '../i18n.js';
import { state, setUser, refreshProgress } from '../store.js';
import { api } from '../api.js';
import { escapeHtml, icon, logoMark } from '../utils.js';
import { toast } from '../components.js';

function safeNext(query) {
  const raw = query.get('next');
  if (!raw) return null;
  const path = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return `#${path}`;
}

function errorMessage(err) {
  switch (err.code) {
    case 'invalid_credentials':
      return t('errorInvalidCredentials');
    case 'email_taken':
      return t('errorEmailTaken');
    case 'invalid_email':
      return t('errorInvalidEmail');
    case 'invalid_password':
      return t('errorInvalidPassword');
    case 'invalid_name':
      return t('errorInvalidName');
    case 'rate_limited':
      return t('errorRateLimited');
    case 'network':
      return t('errorNetwork');
    default:
      return err.message || t('errorGeneric');
  }
}

function authAside() {
  const items = [t('authAside1'), t('authAside2'), t('authAside3'), t('authAside4')];
  return `<aside class="auth-aside">
    <div class="auth-aside-glow" aria-hidden="true"></div>
    <div class="auth-aside-brand">${logoMark(44)}<span>${escapeHtml(t('appName'))}</span></div>
    <h2>${escapeHtml(t('authAsideTitle'))}</h2>
    <ul class="auth-benefits">
      ${items
        .map(
          (item) => `<li><span class="auth-check">${icon('check', 15)}</span><span>${escapeHtml(item)}</span></li>`,
        )
        .join('')}
    </ul>
    <p class="auth-aside-note">${icon('shield', 15)} ${escapeHtml(t('authNote'))}</p>
  </aside>`;
}

async function afterAuth(result, next) {
  setUser(result.user);
  try {
    await refreshProgress();
  } catch { /* progress loads later */ }
  toast(
    t(result.created ? 'welcomeNew' : 'welcomeBack', { name: result.user.name.split(' ')[0] }),
    'success',
  );
  window.location.hash = next && next !== '#/login' && next !== '#/register' ? next : '#/profile';
}

export function loginPage({ query }) {
  if (state.user) {
    window.location.hash = safeNext(query) || '#/profile';
  }
  const next = safeNext(query);
  const node = document.createElement('div');
  node.className = 'page auth-page';
  node.innerHTML = `
    <div class="container auth-container">
      <div class="auth-grid">
        <section class="auth-card card">
          <a class="auth-back" href="#/">${icon('arrow-left', 16)} ${escapeHtml(t('backHome'))}</a>
          <p class="eyebrow">${escapeHtml(t('login'))}</p>
          <h1>${escapeHtml(t('loginTitle'))}</h1>
          <p class="auth-sub">${escapeHtml(t('loginSubtitle'))}</p>
          <form id="loginForm" novalidate>
            <label class="field">
              <span class="field-label">${escapeHtml(t('emailLabel'))}</span>
              <input class="input" type="email" name="email" autocomplete="email" placeholder="${escapeHtml(t('emailPlaceholder'))}" required>
            </label>
            <label class="field">
              <span class="field-label">${escapeHtml(t('passwordLabel'))}</span>
              <input class="input" type="password" name="password" autocomplete="current-password" placeholder="${escapeHtml(t('passwordPlaceholder'))}" minlength="6" required>
            </label>
            <p class="form-error" id="authError" role="alert" hidden></p>
            <button class="btn btn-primary btn-block btn-lg" type="submit">${escapeHtml(t('loginButton'))} ${icon('arrow-right', 18)}</button>
          </form>
          <p class="auth-switch">${escapeHtml(t('noAccount'))} <a href="#/register${next ? `?next=${encodeURIComponent(next)}` : ''}">${escapeHtml(t('toRegister'))}</a></p>

          <div class="demo-box">
            <div class="demo-head"><span class="demo-dot"></span><strong>${escapeHtml(t('demoTitle'))}</strong></div>
            <div class="demo-actions">
              <button class="btn btn-secondary btn-sm" type="button" data-demo="student">${icon('user', 16)} ${escapeHtml(t('demoStudent'))}</button>
              <button class="btn btn-secondary btn-sm" type="button" data-demo="teacher">${icon('shield', 16)} ${escapeHtml(t('demoTeacher'))}</button>
            </div>
            <p class="demo-hint">${escapeHtml(t('demoHint'))}</p>
          </div>
        </section>
        ${authAside()}
      </div>
    </div>`;

  const form = node.querySelector('#loginForm');
  const errorBox = node.querySelector('#authError');

  async function doLogin(email, password, button) {
    errorBox.hidden = true;
    if (button) button.disabled = true;
    form.querySelector('button[type="submit"]').disabled = true;
    try {
      const result = await api.login(email, password);
      result.created = false;
      await afterAuth(result, next);
    } catch (err) {
      errorBox.textContent = errorMessage(err);
      errorBox.hidden = false;
      form.querySelector('button[type="submit"]').disabled = false;
      if (button) button.disabled = false;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errorBox.textContent = t('errorInvalidEmail');
      errorBox.hidden = false;
      return;
    }
    if (password.length < 6) {
      errorBox.textContent = t('errorInvalidPassword');
      errorBox.hidden = false;
      return;
    }
    doLogin(email, password, null);
  });

  node.querySelectorAll('[data-demo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const student = btn.dataset.demo === 'student';
      form.elements.email.value = student ? 'student@school8.kz' : 'teacher@school8.kz';
      form.elements.password.value = student ? 'student123' : 'teacher123';
      doLogin(form.elements.email.value, form.elements.password.value, btn);
    });
  });

  return node;
}

export function registerPage({ query }) {
  if (state.user) {
    window.location.hash = safeNext(query) || '#/profile';
  }
  const next = safeNext(query);
  const node = document.createElement('div');
  node.className = 'page auth-page';
  node.innerHTML = `
    <div class="container auth-container">
      <div class="auth-grid">
        <section class="auth-card card">
          <a class="auth-back" href="#/">${icon('arrow-left', 16)} ${escapeHtml(t('backHome'))}</a>
          <p class="eyebrow">${escapeHtml(t('register'))}</p>
          <h1>${escapeHtml(t('registerTitle'))}</h1>
          <p class="auth-sub">${escapeHtml(t('registerSubtitle'))}</p>
          <form id="registerForm" novalidate>
            <label class="field">
              <span class="field-label">${escapeHtml(t('nameLabel'))}</span>
              <input class="input" type="text" name="name" autocomplete="name" placeholder="${escapeHtml(t('namePlaceholder'))}" maxlength="60" required>
              <span class="field-hint">${escapeHtml(t('nameHint'))}</span>
            </label>
            <label class="field">
              <span class="field-label">${escapeHtml(t('emailLabel'))}</span>
              <input class="input" type="email" name="email" autocomplete="email" placeholder="${escapeHtml(t('emailPlaceholder'))}" required>
            </label>
            <label class="field">
              <span class="field-label">${escapeHtml(t('passwordLabel'))}</span>
              <input class="input" type="password" name="password" autocomplete="new-password" placeholder="${escapeHtml(t('passwordPlaceholder'))}" minlength="6" required>
              <span class="field-hint">${escapeHtml(t('passwordHint'))}</span>
            </label>
            <div class="field">
              <span class="field-label">${escapeHtml(t('language'))}</span>
              <div class="lang-switch is-wide" role="group" aria-label="${escapeHtml(t('switchLanguage'))}">
                <button type="button" class="lang-btn ${getLang() === 'ru' ? 'is-active' : ''}" data-lang="ru" aria-pressed="${getLang() === 'ru'}">${escapeHtml(t('ru'))}</button>
                <button type="button" class="lang-btn ${getLang() === 'kz' ? 'is-active' : ''}" data-lang="kz" aria-pressed="${getLang() === 'kz'}">${escapeHtml(t('kz'))}</button>
              </div>
            </div>
            <p class="form-error" id="authError" role="alert" hidden></p>
            <button class="btn btn-primary btn-block btn-lg" type="submit">${escapeHtml(t('registerButton'))} ${icon('arrow-right', 18)}</button>
          </form>
          <p class="auth-switch">${escapeHtml(t('hasAccount'))} <a href="#/login${next ? `?next=${encodeURIComponent(next)}` : ''}">${escapeHtml(t('toLogin'))}</a></p>
          <p class="auth-note">${icon('shield', 15)} ${escapeHtml(t('authNote'))}</p>
        </section>
        ${authAside()}
      </div>
    </div>`;

  const form = node.querySelector('#registerForm');
  const errorBox = node.querySelector('#authError');
  let language = getLang();

  node.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      language = btn.dataset.lang;
      setLang(language);
      state.lang = language;
      window.dispatchEvent(new CustomEvent('app:language'));
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (name.length < 2) {
      errorBox.textContent = t('errorInvalidName');
      errorBox.hidden = false;
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errorBox.textContent = t('errorInvalidEmail');
      errorBox.hidden = false;
      return;
    }
    if (password.length < 6) {
      errorBox.textContent = t('errorInvalidPassword');
      errorBox.hidden = false;
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const result = await api.register({ name, email, password, language });
      result.created = true;
      await afterAuth(result, next);
    } catch (err) {
      errorBox.textContent = errorMessage(err);
      errorBox.hidden = false;
      submit.disabled = false;
    }
  });

  return node;
}
