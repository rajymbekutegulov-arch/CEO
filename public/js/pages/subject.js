import { t, pick } from '../i18n.js';
import { state, findSubject, refreshProgress, topicStatus } from '../store.js';
import { escapeHtml, icon, subjectTheme, subjectIcon, clampPercent } from '../utils.js';
import { progressBar, emptyState, errorState } from '../components.js';

function topicActions(topic) {
  const lesson = `<a class="btn btn-secondary btn-sm" href="#/lesson/${encodeURIComponent(topic.id)}">${icon('book', 16)} ${escapeHtml(t('lesson'))}</a>`;
  const practice =
    topic.practiceCount > 0
      ? `<a class="btn btn-ghost btn-sm" href="#/practice/${encodeURIComponent(topic.id)}">${icon('target', 16)} ${escapeHtml(t('practice'))}</a>`
      : `<span class="btn btn-ghost btn-sm is-disabled" title="${escapeHtml(t('noQuestions'))}">${icon('target', 16)} ${escapeHtml(t('practice'))}</span>`;
  const quiz =
    topic.quiz.questionCount > 0
      ? `<a class="btn btn-ghost btn-sm" href="#/quiz/${encodeURIComponent(topic.id)}">${icon('check', 16)} ${escapeHtml(t('test'))}</a>`
      : `<span class="btn btn-ghost btn-sm is-disabled" title="${escapeHtml(t('noQuestions'))}">${icon('check', 16)} ${escapeHtml(t('test'))}</span>`;
  return `<div class="topic-actions">${lesson}${practice}${quiz}</div>`;
}

function statusChip(topicId, subjectId) {
  const info = topicStatus(subjectId, topicId);
  if (info.status === 'done') {
    return `<span class="chip chip-success">${icon('check', 13)} ${escapeHtml(t('completed'))}</span>`;
  }
  if (info.status === 'progress') {
    return `<span class="chip chip-warn">${escapeHtml(t('inProgress'))}${info.bestPercent !== null ? ` · ${info.bestPercent}%` : ''}</span>`;
  }
  return '';
}

export async function subjectPage({ params }) {
  if (state.user && !state.progress) {
    try {
      await refreshProgress();
    } catch { /* optional */ }
  }
  const subject = findSubject(params.id);
  if (!subject) {
    return errorState(t('notFoundText'), {
      title: t('notFound'),
      text: t('notFoundText'),
      onRetry: null,
    });
  }

  const index = (state.content || []).findIndex((s) => s.id === subject.id);
  const theme = subjectTheme(subject.id, index);
  const sp = state.progress?.subjects.find((p) => p.id === subject.id) || null;
  const recommended = subject.topics.find((topic) => !topicStatus(subject.id, topic.id).completed) || subject.topics[0] || null;
  const percent = sp ? sp.percent : 0;
  const exam = subject.exam;

  const node = document.createElement('div');
  node.className = `page subject-page theme-${theme}`;
  node.innerHTML = `
    <div class="container">
      <nav class="breadcrumbs" aria-label="breadcrumb">
        <a href="#/subjects">${escapeHtml(t('navSubjects'))}</a>
        ${icon('chevron', 14)}
        <span aria-current="page">${escapeHtml(pick(subject.title))}</span>
      </nav>

      <header class="subject-hero">
        <div class="subject-hero-main">
          <div class="subject-hero-top">
            <span class="subject-icon subject-icon-lg">${icon(subjectIcon(subject.id), 32)}</span>
            <div>
              <p class="eyebrow">${escapeHtml(t('subjectTopicsTitle'))}</p>
              <h1>${escapeHtml(pick(subject.title))}</h1>
              <p class="subject-hero-tagline">${escapeHtml(pick(subject.tagline))}</p>
            </div>
          </div>
          <p class="subject-hero-desc">${escapeHtml(pick(subject.description))}</p>
          <div class="meta-row">
            <span class="meta-item">${icon('book', 16)} ${escapeHtml(t('topicsCount', { count: subject.topicCount }))}</span>
            <span class="meta-item">${icon('target', 16)} ${escapeHtml(t('testsCount', { count: subject.topics.length + 1 }))}</span>
            <span class="meta-item">${icon('clock', 16)} ${escapeHtml(t('minutes'))}: ${exam.durationMin}</span>
          </div>
          <div class="subject-hero-actions">
            ${
              recommended
                ? `<a class="btn btn-primary" href="#/lesson/${encodeURIComponent(recommended.id)}">${icon('play', 18)} ${escapeHtml(sp && percent > 0 ? t('continue') : t('ctaStart'))}</a>`
                : ''
            }
            ${
              exam.questionCount > 0
                ? `<a class="btn btn-secondary" href="#/exam/${encodeURIComponent(subject.id)}">${icon('trophy', 18)} ${escapeHtml(t('mockExam'))}</a>`
                : ''
            }
          </div>
        </div>
        <div class="subject-hero-aside">
          ${
            state.user
              ? `<div class="subject-progress-card">
                  <div class="subject-progress-head">
                    <span>${escapeHtml(t('progress'))}</span>
                    <strong>${percent}%</strong>
                  </div>
                  ${progressBar(percent, theme)}
                  <p>${escapeHtml(t('subjectProgress', { done: sp?.topicsCompleted || 0, total: subject.topicCount }))}</p>
                  <div class="subject-progress-stats">
                    <span><strong>${sp?.topicsCompleted || 0}</strong> ${escapeHtml(t('completed'))}</span>
                    <span><strong>${sp?.examBest ?? '—'}${sp?.examBest !== null && sp?.examBest !== undefined ? '%' : ''}</strong> ${escapeHtml(t('profileExamBest'))}</span>
                  </div>
                </div>`
              : `<div class="subject-progress-card">
                  <div class="subject-progress-head"><span>${escapeHtml(t('subjectLoginProgress'))}</span>${icon('lock', 18)}</div>
                  <p>${escapeHtml(t('subjectLoginProgressText'))}</p>
                  <a class="btn btn-secondary btn-sm btn-block" href="#/login?next=${encodeURIComponent(`#/subject/${subject.id}`)}">${escapeHtml(t('login'))}</a>
                </div>`
          }
        </div>
      </header>

      <section class="section subject-topics-section">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(t('subjectTopicsTitle'))}</h2>
            <p class="section-lead">${escapeHtml(t('subjectTopicsText'))}</p>
          </div>
          <span class="meta-item">${icon('book', 16)} ${escapeHtml(t('topicsCount', { count: subject.topicCount }))}</span>
        </div>
        ${
          subject.topics.length
            ? `<ol class="topic-list">
                ${subject.topics
                  .map((topic, i) => {
                    const isRecommended = recommended && recommended.id === topic.id;
                    return `<li class="topic-row ${isRecommended ? 'is-recommended' : ''}">
                      <span class="topic-index">${String(i + 1).padStart(2, '0')}</span>
                      <div class="topic-main">
                        <div class="topic-title-row">
                          <h3><a href="#/lesson/${encodeURIComponent(topic.id)}">${escapeHtml(pick(topic.title))}</a></h3>
                          ${isRecommended ? `<span class="chip chip-brand">${escapeHtml(t('statusRecommended'))}</span>` : ''}
                          ${statusChip(topic.id, subject.id)}
                        </div>
                        <p class="topic-summary">${escapeHtml(pick(topic.summary))}</p>
                        <div class="topic-meta">
                          <span>${icon('clock', 14)} ${topic.duration} ${escapeHtml(t('minShort'))}</span>
                          <span>${icon('target', 14)} ${topic.practiceCount} ${escapeHtml(t('practice'))}</span>
                          <span>${icon('check', 14)} ${topic.quiz.questionCount} ${escapeHtml(t('questions'))}</span>
                        </div>
                      </div>
                      ${topicActions(topic)}
                    </li>`;
                  })
                  .join('')}
              </ol>`
            : emptyState({
                iconName: 'book',
                title: t('subjectNoTopics'),
                text: t('subjectNoTopicsText'),
                action: `<a class="btn btn-secondary" href="#/subjects">${escapeHtml(t('goSubjects'))}</a>`,
              })
        }
      </section>

      <section class="section">
        <div class="exam-card">
          <div class="exam-card-icon">${icon('trophy', 30)}</div>
          <div class="exam-card-main">
            <p class="eyebrow is-light">${escapeHtml(t('exam'))}</p>
            <h2>${escapeHtml(pick(exam.title))}</h2>
            <p>${escapeHtml(pick(exam.description))}</p>
            <div class="exam-meta">
              <span>${icon('target', 16)} ${exam.questionCount} ${escapeHtml(t('questions'))}</span>
              <span>${icon('clock', 16)} ${exam.durationMin} ${escapeHtml(t('minutes'))}</span>
              <span>${icon('chart', 16)} ${sp && sp.examBest !== null ? escapeHtml(t('subjectExamBest', { percent: sp.examBest })) : escapeHtml(t('subjectExamNoAttempts'))}</span>
            </div>
          </div>
          <div class="exam-card-actions">
            ${
              exam.questionCount > 0
                ? `<a class="btn btn-light" href="#/exam/${encodeURIComponent(subject.id)}">${escapeHtml(t('subjectStartExam'))} ${icon('arrow-right', 18)}</a>`
                : `<span class="btn btn-light is-disabled">${escapeHtml(t('noQuestions'))}</span>`
            }
          </div>
        </div>
      </section>
    </div>
  `;
  return node;
}
