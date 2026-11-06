import { api } from './api.js';
import { initialLang, setLang } from './i18n.js';

export const state = {
  lang: initialLang(),
  user: null,
  content: null,
  contentPromise: null,
  progress: null,
  offline: false,
};

setLang(state.lang, { persist: false });

export function setUser(user) {
  state.user = user;
  if (user?.language) {
    // A saved local choice always wins; otherwise follow the account setting.
    let saved = null;
    try {
      saved = localStorage.getItem('ent8:lang');
    } catch { /* ignore */ }
    if (!saved && (user.language === 'ru' || user.language === 'kz')) {
      setLang(user.language);
      state.lang = user.language;
    }
  }
}

export async function loadContent({ force = false } = {}) {
  if (state.content && !force) return state.content;
  if (state.contentPromise && !force) return state.contentPromise;
  state.contentPromise = api
    .content()
    .then((data) => {
      state.content = data.subjects || [];
      state.offline = false;
      return state.content;
    })
    .catch((err) => {
      state.offline = err.code === 'network';
      throw err;
    })
    .finally(() => {
      state.contentPromise = null;
    });
  return state.contentPromise;
}

export async function refreshProgress() {
  if (!state.user) {
    state.progress = null;
    return null;
  }
  try {
    state.progress = await api.progress();
    return state.progress;
  } catch (err) {
    if (err.code === 'unauthorized') {
      state.user = null;
      state.progress = null;
    }
    throw err;
  }
}

export function findSubject(subjectId) {
  return (state.content || []).find((s) => s.id === subjectId) || null;
}

export function findTopic(topicId) {
  for (const subject of state.content || []) {
    const topic = subject.topics.find((t) => t.id === topicId);
    if (topic) return { subject, topic };
  }
  return null;
}

export function subjectProgress(subjectId) {
  return state.progress?.subjects?.find((s) => s.id === subjectId) || null;
}

export function topicStatus(subjectId, topicId) {
  const sp = subjectProgress(subjectId);
  const topic = sp?.topics.find((t) => t.id === topicId);
  if (!topic) return { status: 'new', bestPercent: null, completed: false };
  if (topic.completed) return { status: 'done', bestPercent: topic.bestPercent, completed: true };
  if (topic.bestPercent !== null || topic.quizAttempts > 0) {
    return { status: 'progress', bestPercent: topic.bestPercent, completed: false };
  }
  return { status: 'new', bestPercent: null, completed: false };
}

export function resetForLogout() {
  state.user = null;
  state.progress = null;
}
