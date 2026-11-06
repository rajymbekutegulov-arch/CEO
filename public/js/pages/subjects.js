import { t, pick } from '../i18n.js';
import { state, refreshProgress } from '../store.js';
import { escapeHtml, icon, subjectTheme, subjectIcon } from '../utils.js';
import { pageHead, progressBar, emptyState, loadingState, errorState } from '../components.js';

export async function subjectsPage() {
  const node = document.createElement('div');
  node.className = 'page';
  const subjects = state.content || [];

  if (state.user && !state.progress) {
    node.innerHTML = `<div class="container section">${loadingState()}</div>`;
    try {
      await refreshProgress();
    } catch { /* progress is optional for browsing */ }
  }

  const progress = state.progress;

  node.innerHTML = `
    <div class="container section">
      ${pageHead({
        eyebrow: t('navSubjects'),
        title: t('subjectsTitle'),
        text: t('subjectsSubtitle'),
      })}
      ${
        subjects.length
          ? `<div class="subject-grid subject-grid-lg">
              ${subjects
                .map((subject, index) => {
                  const theme = subjectTheme(subject.id, index);
                  const sp = progress?.subjects.find((p) => p.id === subject.id) || null;
                  const topics = subject.topics.slice(0, 3);
                  return `<a class="subject-card subject-card-lg theme-${theme}" href="#/subject/${encodeURIComponent(subject.id)}">
                    <div class="subject-card-top">
                      <span class="subject-icon">${icon(subjectIcon(subject.id), 28)}</span>
                      ${sp ? `<span class="subject-percent-badge">${sp.percent}%</span>` : `<span class="subject-arrow">${icon('arrow-up-right', 20)}</span>`}
                    </div>
                    <span class="subject-name">${escapeHtml(pick(subject.title))}</span>
                    <span class="subject-tagline">${escapeHtml(pick(subject.tagline))}</span>
                    <span class="subject-description">${escapeHtml(pick(subject.description))}</span>
                    ${
                      topics.length
                        ? `<span class="subject-topics">${topics
                            .map((topic) => `<span class="subject-topic-chip">${escapeHtml(pick(topic.title))}</span>`)
                            .join('')}${subject.topics.length > 3 ? `<span class="subject-topic-more">+${subject.topics.length - 3}</span>` : ''}</span>`
                        : ''
                    }
                    <span class="subject-meta">
                      <span>${icon('book', 15)} ${escapeHtml(t('topicsCount', { count: subject.topicCount }))}</span>
                      <span>${icon('target', 15)} ${escapeHtml(t('testsCount', { count: subject.topics.length + 1 }))}</span>
                      <span>${icon('clock', 15)} ${escapeHtml(t('mockExam'))}</span>
                    </span>
                    ${
                      sp
                        ? `<span class="subject-progress">
                            <span class="subject-progress-row"><span>${escapeHtml(t('completed'))} ${sp.topicsCompleted}/${sp.topicsTotal}</span><span>${sp.percent}%</span></span>
                            ${progressBar(sp.percent, theme)}
                          </span>`
                        : ''
                    }
                    <span class="subject-open">${escapeHtml(t('openSubject'))} ${icon('arrow-right', 17)}</span>
                  </a>`;
                })
                .join('')}
            </div>`
          : emptyState({ iconName: 'book', title: t('subjectsEmpty'), text: t('subjectsEmptyText') })
      }
      ${
        !state.user
          ? `<div class="info-banner">
              <div class="info-banner-icon">${icon('info', 20)}</div>
              <div>
                <strong>${escapeHtml(t('homeGuestTitle'))}</strong>
                <p>${escapeHtml(t('homeGuestText'))}</p>
              </div>
              <a class="btn btn-secondary btn-sm" href="#/register">${escapeHtml(t('register'))}</a>
            </div>`
          : ''
      }
    </div>`;
  return node;
}
