import { t } from '../i18n.js';
import { escapeHtml, icon, logoMark } from '../utils.js';

export function notFoundPage() {
  const node = document.createElement('div');
  node.className = 'page';
  node.innerHTML = `
    <div class="container section">
      <div class="notfound">
        <div class="notfound-art" aria-hidden="true">
          <span class="notfound-number">404</span>
          <span class="notfound-orbit">${icon('globe', 48)}</span>
        </div>
        <p class="eyebrow">${escapeHtml(t('appName'))}</p>
        <h1>${escapeHtml(t('notFound'))}</h1>
        <p class="page-lead">${escapeHtml(t('notFoundText'))}</p>
        <div class="state-actions">
          <a class="btn btn-primary" href="#/">${escapeHtml(t('backHome'))}</a>
          <a class="btn btn-secondary" href="#/subjects">${escapeHtml(t('goSubjects'))}</a>
        </div>
      </div>
    </div>`;
  return node;
}
