import { t, pick } from '../i18n.js';
import { state, topicStatus } from '../store.js';
import { api } from '../api.js';
import { escapeHtml, icon, renderMarkdown, subjectTheme, subjectIcon } from '../utils.js';
import { progressBar, emptyState } from '../components.js';

export async function lessonPage({ params }) {
  const data = await api.topic(params.id);
  const { subject, topic, prev, next } = data;
  const theme = subjectTheme(subject.id, 0);
  const lessonText = pick(topic.lesson);
  const progressInfo = topicStatus(subject.id, topic.id);
  const percent = progressInfo.completed ? 100 : progressInfo.bestPercent ?? 0;

  if (state.user) {
    api.lastViewed(subject.id, topic.id).catch(() => {});
  }

  const node = document.createElement('div');
  node.className = `page lesson-page theme-${theme}`;

  if (!lessonText.trim()) {
    node.innerHTML = `<div class="container section">
      <div class="breadcrumbs">
        <a href="#/subjects">${escapeHtml(t('navSubjects'))}</a> ${icon('chevron', 14)}
        <a href="#/subject/${encodeURIComponent(subject.id)}">${escapeHtml(pick(subject.title))}</a>
      </div>
      ${emptyState({
        iconName: 'book',
        title: t('lessonEmpty'),
        text: t('lessonEmptyText'),
        action: `<a class="btn btn-primary" href="#/subject/${encodeURIComponent(subject.id)}">${escapeHtml(t('lessonBackSubject'))}</a>`,
      })}
    </div>`;
    return node;
  }

  node.innerHTML = `
    <div class="container">
      <nav class="breadcrumbs" aria-label="breadcrumb">
        <a href="#/subjects">${escapeHtml(t('navSubjects'))}</a>
        ${icon('chevron', 14)}
        <a href="#/subject/${encodeURIComponent(subject.id)}">${escapeHtml(pick(subject.title))}</a>
        ${icon('chevron', 14)}
        <span aria-current="page">${escapeHtml(pick(topic.title))}</span>
      </nav>

      <div class="lesson-layout">
        <article class="lesson-main">
          <header class="lesson-head">
            <div class="lesson-head-top">
              <span class="subject-icon">${icon(subjectIcon(subject.id), 24)}</span>
              <div>
                <p class="eyebrow">${escapeHtml(t('lessonLabel'))} · ${escapeHtml(t('topic'))} ${topic.order}</p>
                <p class="lesson-subject-name">${escapeHtml(pick(subject.title))}</p>
              </div>
              ${
                progressInfo.completed
                  ? `<span class="chip chip-success">${icon('check', 13)} ${escapeHtml(t('lessonCompleted'))}</span>`
                  : `<span class="chip chip-muted">${escapeHtml(t('lessonNotCompleted'))}</span>`
              }
            </div>
            <h1>${escapeHtml(pick(topic.title))}</h1>
            <p class="lesson-summary">${escapeHtml(pick(topic.summary))}</p>
            <div class="meta-row">
              <span class="meta-item">${icon('clock', 16)} ${escapeHtml(t('lessonReadingTime', { minutes: topic.duration }))}</span>
              <span class="meta-item">${icon('target', 16)} ${topic.practiceCount} ${escapeHtml(t('practice'))}</span>
              <span class="meta-item">${icon('check', 16)} ${topic.quiz.questionCount} ${escapeHtml(t('questions'))}</span>
            </div>
          </header>

          <div class="prose">${renderMarkdown(lessonText)}</div>

          <div class="lesson-next-cta">
            <div>
              <p class="eyebrow is-light">${escapeHtml(t('lessonNextUp'))}</p>
              <h2>${escapeHtml(t('lessonPracticeCta'))}</h2>
              <p>${escapeHtml(t('lessonPracticeText'))}</p>
            </div>
            ${
              topic.practiceCount > 0
                ? `<a class="btn btn-light" href="#/practice/${encodeURIComponent(topic.id)}">${escapeHtml(t('practice'))} ${icon('arrow-right', 18)}</a>`
                : `<a class="btn btn-light" href="#/quiz/${encodeURIComponent(topic.id)}">${escapeHtml(t('test'))} ${icon('arrow-right', 18)}</a>`
            }
          </div>

          <nav class="lesson-nav" aria-label="${escapeHtml(t('lessonNext'))}">
            ${
              prev
                ? `<a class="lesson-nav-link" href="#/lesson/${encodeURIComponent(prev.id)}">
                    ${icon('arrow-left', 18)}
                    <span><small>${escapeHtml(t('lessonPrev'))}</small><strong>${escapeHtml(pick(prev.title))}</strong></span>
                  </a>`
                : '<span></span>'
            }
            ${
              next
                ? `<a class="lesson-nav-link is-next" href="#/lesson/${encodeURIComponent(next.id)}">
                    <span><small>${escapeHtml(t('lessonNext'))}</small><strong>${escapeHtml(pick(next.title))}</strong></span>
                    ${icon('arrow-right', 18)}
                  </a>`
                : `<a class="lesson-nav-link is-next" href="#/subject/${encodeURIComponent(subject.id)}">
                    <span><small>${escapeHtml(t('exam'))}</small><strong>${escapeHtml(t('mockExam'))}</strong></span>
                    ${icon('arrow-right', 18)}
                  </a>`
            }
          </nav>
        </article>

        <aside class="lesson-aside">
          <div class="aside-card">
            <h2 class="aside-title">${escapeHtml(t('lessonProgress'))}</h2>
            <div class="aside-progress-head">
              <span>${progressInfo.completed ? escapeHtml(t('completed')) : progressInfo.status === 'new' ? escapeHtml(t('notStarted')) : escapeHtml(t('inProgress'))}</span>
              <strong>${percent}%</strong>
            </div>
            ${progressBar(percent, theme)}
            <p class="aside-note">${escapeHtml(t('subjectProgress', {
              done: state.progress?.subjects.find((s) => s.id === subject.id)?.topicsCompleted || 0,
              total: state.content?.find((s) => s.id === subject.id)?.topicCount || 1,
            }))}</p>
            ${
              topic.quiz.questionCount > 0
                ? `<a class="btn btn-primary btn-sm btn-block" href="#/quiz/${encodeURIComponent(topic.id)}">${escapeHtml(t('lessonTestCta'))}</a>
                   <p class="aside-hint">${escapeHtml(t('lessonTestText', { count: topic.quiz.questionCount, pass: topic.quiz.passScore }))}</p>`
                : ''
            }
          </div>

          <div class="aside-card aside-tip">
            <span class="aside-tip-icon">${icon('sparkles', 20)}</span>
            <h2 class="aside-title">${escapeHtml(t('lessonAsideTitle'))}</h2>
            <p>${escapeHtml(t('lessonAsideText'))}</p>
          </div>

          <a class="aside-link" href="#/subject/${encodeURIComponent(subject.id)}">
            ${icon('arrow-left', 16)} ${escapeHtml(t('lessonBackSubject'))}
          </a>
        </aside>
      </div>
    </div>
  `;
  return node;
}
