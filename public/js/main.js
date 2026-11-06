import { t } from './i18n.js';
import { state, setUser, loadContent, refreshProgress } from './store.js';
import { api } from './api.js';
import { startRouter, renderRoute } from './router.js';
import { toast } from './components.js';

const offlineBanner = () => document.getElementById('offline-banner');

function paintOfflineBanner() {
  const banner = offlineBanner();
  if (!banner) return;
  const title = banner.querySelector('[data-offline-title]');
  const text = banner.querySelector('[data-offline-text]');
  const retry = banner.querySelector('#offline-retry');
  if (title) title.textContent = t('serverOffline');
  if (text) text.textContent = t('offlineHint');
  if (retry) retry.textContent = t('retry');
}

function showOffline(show) {
  const banner = offlineBanner();
  if (!banner) return;
  paintOfflineBanner();
  banner.hidden = !show;
}

async function boot() {
  document.documentElement.lang = state.lang === 'kz' ? 'kk' : 'ru';

  const skip = document.getElementById('skipLink');
  skip?.addEventListener('click', () => {
    const app = document.getElementById('app');
    app?.focus();
    app?.scrollIntoView({ block: 'start' });
  });

  try {
    const me = await api.me();
    setUser(me.user);
  } catch (err) {
    if (err.code === 'network') showOffline(true);
  }

  const tasks = [loadContent().catch(() => null)];
  if (state.user) tasks.push(refreshProgress().catch(() => null));
  await Promise.all(tasks);

  try {
    await startRouter();
  } catch (err) {
    console.error('[boot]', err);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `<div class="container section"><div class="state-block state-error">
        <h2>${t('errorTitle')}</h2>
        <p>${t('errorText')}</p>
        <div class="state-actions"><a class="btn btn-primary" href="#/subjects">${t('goSubjects')}</a></div>
      </div></div>`;
    }
  }

  window.addEventListener('offline', () => showOffline(true));
  window.addEventListener('online', () => {
    showOffline(false);
    loadContent({ force: true }).catch(() => {});
    renderRoute({ scroll: false });
  });
  window.addEventListener('app:language', paintOfflineBanner);

  document.getElementById('offline-retry')?.addEventListener('click', async () => {
    try {
      await loadContent({ force: true });
      showOffline(false);
      toast(t('retry'), 'success');
      renderRoute({ scroll: false });
    } catch {
      toast(t('serverOffline'), 'error');
    }
  });
}

boot();
