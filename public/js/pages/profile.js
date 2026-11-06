import { t, pick, getLang } from '../i18n.js';
import { state, refreshProgress } from '../store.js';
import { api } from '../api.js';
import {
  escapeHtml,
  icon,
  formatDate,
  formatDateTime,
  initials,
  subjectTheme,
  subjectIcon,
  scoreTone,
  go,
} from '../utils.js';
import { progressBar, scoreRing, emptyState, pageHead, toast, changeLanguage } from '../components.js';

export async function profilePage() {
  const progress = await refreshProgress();
  const user = state.user;
  const totals = progress.totals;
  const node = document.createElement('div');
  node.className = 'page profile-page';

  const attempts = progress.recentAttempts || [];

  node.innerHTML = `
    <div class="container section">
      ${pageHead({
        eyebrow: t('profile'),
        title: t('profileGreeting', { name: user.name.split(' ')[0] }),
        text: t('profileSubtitle'),
        actions: `<button class="btn btn-secondary btn-sm" type="button" data-logout>${icon('logout', 17)} ${escapeHtml(t('logout'))}</button>`,
      })}

      <div class="profile-layout">
        <aside class="profile-side">
          <section class="profile-card card">
            <span class="profile-avatar theme-${initials(user.name)}">${escapeHtml(initials(user.name))}</span>
            <h2>${escapeHtml(user.name)}</h2>
            <p class="profile-email">${icon('mail', 15)} ${escapeHtml(user.email)}</p>
            <div class="profile-badges">
              <span class="chip ${user.role === 'teacher' ? 'chip-brand' : 'chip-muted'}">${escapeHtml(t(user.role === 'teacher' ? 'teacher' : 'student'))}</span>
              <span class="chip chip-muted">${escapeHtml(getLang() === 'kz' ? t('kz') : t('ru'))}</span>
            </div>
            <p class="profile-since">${escapeHtml(t('profileMemberSince', { date: formatDate(user.createdAt) }))}</p>
            ${
              user.role === 'teacher'
                ? `<a class="btn btn-primary btn-sm btn-block" href="#/teacher">${icon('shield', 17)} ${escapeHtml(t('profileTeacherPanel'))}</a>`
                : ''
            }
          </section>

          <section class="profile-card card">
            <h2 class="aside-title">${escapeHtml(t('profileSettings'))}</h2>
            <form class="profile-form" id="profileForm" novalidate>
              <label class="field">
                <span class="field-label">${escapeHtml(t('name'))}</span>
                <input class="input" type="text" name="name" value="${escapeHtml(user.name)}" maxlength="60" required>
              </label>
              <div class="field">
                <span class="field-label">${escapeHtml(t('language'))}</span>
                <div class="lang-switch is-wide" role="group" aria-label="${escapeHtml(t('switchLanguage'))}">
                  <button type="button" class="lang-btn ${getLang() === 'ru' ? 'is-active' : ''}" data-lang="ru" aria-pressed="${getLang() === 'ru'}">${escapeHtml(t('ru'))}</button>
                  <button type="button" class="lang-btn ${getLang() === 'kz' ? 'is-active' : ''}" data-lang="kz" aria-pressed="${getLang() === 'kz'}">${escapeHtml(t('kz'))}</button>
                </div>
              </div>
              <p class="form-error" id="profileError" role="alert" hidden></p>
              <button class="btn btn-primary btn-block" type="submit">${escapeHtml(t('profileSave'))}</button>
            </form>
          </section>
        </aside>

        <div class="profile-main">
          <section class="profile-overview card">
            <div class="profile-overview-ring">${scoreRing(totals.percent, { size: 132, label: t('profileOverall') })}</div>
            <div class="profile-overview-copy">
              <p class="eyebrow">${escapeHtml(t('profileStats'))}</p>
              <h2>${escapeHtml(t('subjectProgress', { done: totals.topicsCompleted, total: totals.topicsTotal }))}</h2>
              <div class="profile-stats">
                <div class="profile-stat"><strong>${totals.topicsCompleted}</strong><span>${escapeHtml(t('profileCompletedTopics'))}</span></div>
                <div class="profile-stat"><strong>${totals.attempts}</strong><span>${escapeHtml(t('profileTestsTaken'))}</span></div>
                <div class="profile-stat"><strong>${totals.averageQuiz !== null ? `${totals.averageQuiz}%` : '—'}</strong><span>${escapeHtml(t('profileAverageScore'))}</span></div>
                <div class="profile-stat"><strong>${mathBest(progress) !== null ? `${mathBest(progress)}%` : '—'}</strong><span>${escapeHtml(t('profileExamBest'))}</span></div>
              </div>
            </div>
          </section>

          <section class="resume-card card">
            <div class="resume-icon">${icon(progress.resume ? 'play' : 'map', 22)}</div>
            <div class="resume-copy">
              <p class="eyebrow">${escapeHtml(t('profileContinue'))}</p>
              ${
                progress.resume
                  ? `<h2>${escapeHtml(pick(progress.resume.topicTitle))}</h2>
                     <p class="resume-sub">${escapeHtml(pick(progress.resume.subjectTitle))}</p>`
                  : `<h2>${escapeHtml(t('profileNoResume'))}</h2>
                     <p class="resume-sub">${escapeHtml(t('profileNoResumeText'))}</p>`
              }
            </div>
            <a class="btn btn-primary" href="${progress.resume ? `#/lesson/${encodeURIComponent(progress.resume.topicId)}` : '#/subjects'}">
              ${escapeHtml(progress.resume ? t('profileContinue') : t('ctaStart'))} ${icon('arrow-right', 18)}
            </a>
          </section>

          <section class="profile-section">
            <div class="section-head">
              <div>
                <h2>${escapeHtml(t('profileSubjects'))}</h2>
                <p class="section-lead">${escapeHtml(t('subjectsSubtitle'))}</p>
              </div>
            </div>
            <div class="profile-subjects">
              ${(progress.subjects || [])
                .map((sp, index) => {
                  const subject = state.content.find((s) => s.id === sp.id);
                  if (!subject) return '';
                  const theme = subjectTheme(sp.id, index);
                  return `<a class="profile-subject card theme-${theme}" href="#/subject/${encodeURIComponent(sp.id)}">
                    <div class="profile-subject-top">
                      <span class="subject-icon">${icon(subjectIcon(sp.id), 22)}</span>
                      <span class="profile-subject-percent">${sp.percent}%</span>
                    </div>
                    <h3>${escapeHtml(pick(sp.title))}</h3>
                    ${progressBar(sp.percent, theme)}
                    <p class="profile-subject-meta">${escapeHtml(t('subjectProgress', { done: sp.topicsCompleted, total: sp.topicsTotal }))}</p>
                    <p class="profile-subject-meta">${escapeHtml(t('profileExamBest'))}: ${sp.examBest !== null ? `${sp.examBest}%` : '—'}</p>
                  </a>`;
                })
                .join('')}
            </div>
          </section>

          <section class="profile-section">
            <div class="section-head">
              <div>
                <h2>${escapeHtml(t('profileReview'))}</h2>
                <p class="section-lead">${escapeHtml(t('profileReviewText'))}</p>
              </div>
            </div>
            ${
              progress.reviewTopics?.length
                ? `<ul class="review-topic-list">
                    ${progress.reviewTopics
                      .map(
                        (item) => `<li class="review-topic-row">
                          <span class="review-topic-icon">${icon('refresh', 18)}</span>
                          <div class="review-topic-main">
                            <strong>${escapeHtml(pick(item.topicTitle))}</strong>
                            <span>${escapeHtml(pick(item.subjectTitle))} · ${item.bestPercent}% / ${item.passScore}%</span>
                          </div>
                          <a class="btn btn-secondary btn-sm" href="#/lesson/${encodeURIComponent(item.topicId)}">${escapeHtml(t('review'))}</a>
                          <a class="btn btn-ghost btn-sm" href="#/quiz/${encodeURIComponent(item.topicId)}">${escapeHtml(t('test'))}</a>
                        </li>`,
                      )
                      .join('')}
                  </ul>`
                : emptyState({ iconName: 'check', title: t('profileNoReview'), text: t('profileNoReviewText') })
            }
          </section>

          <section class="profile-section">
            <div class="section-head">
              <div>
                <h2>${escapeHtml(t('profileRecent'))}</h2>
                <p class="section-lead">${escapeHtml(t('profileRecentText'))}</p>
              </div>
            </div>
            ${
              attempts.length
                ? `<div class="attempt-list">
                    ${attempts
                      .map(
                        (attempt) => `<a class="attempt-row" href="#/results/${encodeURIComponent(attempt.id)}">
                          <span class="attempt-type ${attempt.type === 'exam' ? 'is-exam' : ''}">${icon(attempt.type === 'exam' ? 'trophy' : 'target', 17)}</span>
                          <span class="attempt-main">
                            <strong>${escapeHtml(pick(attempt.topicTitle) || t(attempt.type === 'exam' ? 'resultsTypeExam' : 'resultsTypeQuiz'))}</strong>
                            <span>${escapeHtml(pick(attempt.subjectTitle))} · ${escapeHtml(formatDateTime(attempt.createdAt))}</span>
                          </span>
                          <span class="attempt-score tone-${scoreTone(attempt.percent)}">
                            <strong>${attempt.percent}%</strong>
                            <span>${attempt.score}/${attempt.total}</span>
                          </span>
                          ${icon('chevron', 16)}
                        </a>`,
                      )
                      .join('')}
                  </div>`
                : emptyState({ iconName: 'chart', title: t('profileNoAttempts'), text: t('profileNoAttemptsText') })
            }
          </section>
        </div>
      </div>
    </div>`;

  const form = node.querySelector('#profileForm');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const errorBox = node.querySelector('#profileError');
    errorBox.hidden = true;
    if (name.length < 2) {
      errorBox.textContent = t('errorInvalidName');
      errorBox.hidden = false;
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const result = await api.updateMe({ name });
      state.user = result.user;
      toast(t('profileSaved'), 'success');
      window.dispatchEvent(new CustomEvent('app:auth'));
    } catch (err) {
      errorBox.textContent = err.code === 'invalid_name' ? t('errorInvalidName') : t('errorGeneric');
      errorBox.hidden = false;
      submit.disabled = false;
    }
  });

  form?.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => changeLanguage(btn.dataset.lang));
  });

  node.querySelector('[data-logout]')?.addEventListener('click', async () => {
    try {
      await api.logout();
    } catch { /* ignore */ }
    state.user = null;
    state.progress = null;
    toast(t('logout'), 'success');
    go('/');
    window.dispatchEvent(new CustomEvent('app:auth'));
  });

  return node;
}

function mathBest(progress) {
  const values = (progress.subjects || [])
    .map((s) => s.examBest)
    .filter((v) => v !== null && v !== undefined);
  return values.length ? Math.max(...values) : null;
}
