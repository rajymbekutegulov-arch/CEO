import { t } from './i18n.js';
import { state, loadContent } from './store.js';
import { parseHash, go } from './utils.js';
import { renderHeader, renderFooter, errorState, skeletonPage } from './components.js';
import { homePage } from './pages/home.js';
import { subjectsPage } from './pages/subjects.js';
import { subjectPage } from './pages/subject.js';
import { lessonPage } from './pages/lesson.js';
import { practicePage } from './pages/practice.js';
import { testPage } from './pages/test.js';
import { resultsPage } from './pages/results.js';
import { profilePage } from './pages/profile.js';
import { loginPage, registerPage } from './pages/auth.js';
import { teacherPage } from './pages/teacher.js';
import { notFoundPage } from './pages/notfound.js';

const routes = [
  { path: '/', view: homePage },
  { path: '/subjects', view: subjectsPage },
  { path: '/subject/:id', view: subjectPage },
  { path: '/lesson/:id', view: lessonPage },
  { path: '/practice/:id', view: practicePage },
  { path: '/quiz/:id', view: testPage, props: { type: 'quiz' } },
  { path: '/exam/:id', view: testPage, props: { type: 'exam' } },
  { path: '/results/:id', view: resultsPage, requiresAuth: true },
  { path: '/login', view: loginPage },
  { path: '/register', view: registerPage },
  { path: '/profile', view: profilePage, requiresAuth: true },
  { path: '/teacher', view: teacherPage, requiresAuth: true },
];

let cleanup = null;
let renderSeq = 0;
let currentPath = null;

function matchRoute(path) {
  const segments = path.split('/').filter(Boolean);
  for (const route of routes) {
    const routeSegments = route.path.split('/').filter(Boolean);
    if (routeSegments.length !== segments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < routeSegments.length; i += 1) {
      const rs = routeSegments[i];
      if (rs.startsWith(':')) {
        params[rs.slice(1)] = decodeURIComponent(segments[i]);
      } else if (rs !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

function setLoading(active) {
  const bar = document.getElementById('route-bar');
  if (!bar) return;
  bar.classList.toggle('is-loading', active);
}

function afterMount(app) {
  const heading = app.querySelector('h1');
  document.title = heading ? `${heading.textContent.trim()} · ${t('appName')}` : t('appName');
  app.focus({ preventScroll: true });
}

export async function renderRoute({ scroll = true } = {}) {
  const seq = ++renderSeq;
  const { path, query } = parseHash();
  const app = document.getElementById('app');
  const headerRoot = document.getElementById('app-header');
  const footerRoot = document.getElementById('app-footer');
  if (!app) return;

  if (headerRoot) renderHeader(headerRoot, path);
  if (footerRoot) renderFooter(footerRoot);

  const matched = matchRoute(path);
  if (!matched) {
    cleanup?.();
    cleanup = null;
    app.innerHTML = '';
    app.appendChild(notFoundPage());
    afterMount(app);
    setLoading(false);
    return;
  }

  const { route, params } = matched;

  if (route.requiresAuth && !state.user) {
    const next = encodeURIComponent(window.location.hash || '#/profile');
    go(`/login?next=${next}`);
    return;
  }

  // Show a lightweight skeleton only on real navigation, not on language switches.
  if (scroll && currentPath !== path && app.innerHTML.trim() === '') {
    app.innerHTML = skeletonPage();
  }
  setLoading(true);

  try {
    if (route.path !== '/login' && route.path !== '/register') {
      await loadContent();
    }
    const result = await route.view({ params, query, path, ...(route.props || {}) });
    if (seq !== renderSeq) return;
    cleanup?.();
    cleanup = null;
    const node = result instanceof HTMLElement ? result : result?.node;
    if (!(node instanceof HTMLElement)) throw new Error('View did not return a node');
    cleanup = typeof result?.cleanup === 'function' ? result.cleanup : null;
    app.innerHTML = '';
    app.appendChild(node);
    afterMount(app);
    if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    if (seq !== renderSeq) return;
    console.error('[route]', path, err);
    app.innerHTML = '';
    const node = errorState(err?.message, {
      onRetry: () => renderRoute({ scroll: false }),
      title: err?.code === 'network' ? t('serverOffline') : t('errorTitle'),
      text: err?.code === 'network' ? t('offlineHint') : t('errorText'),
    });
    app.appendChild(node);
    afterMount(app);
  } finally {
    if (seq === renderSeq) setLoading(false);
  }
  currentPath = path;
}

export function startRouter() {
  window.addEventListener('hashchange', () => renderRoute());
  window.addEventListener('app:language', () => renderRoute({ scroll: false }));
  window.addEventListener('app:auth', () => renderRoute({ scroll: false }));
  if (!window.location.hash) {
    window.history.replaceState(null, '', '#/');
  }
  return renderRoute();
}
