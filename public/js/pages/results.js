import { t, pick } from '../i18n.js';
import { state, findTopic } from '../store.js';
import { api } from '../api.js';
import { escapeHtml, icon, formatDateTime, scoreTone } from '../utils.js';
import { scoreRing, emptyState } from '../components.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export async function resultsPage({ params }) {
  let data;
  try {
    data = await api.attempt(params.id);
  } catch (err) {
    const node = document.createElement('div');
    node.className = 'page';
    node.innerHTML = `<div class="container section">${emptyState({
      iconName: 'alert',
      title: t('resultsNotFound'),
      text: t('resultsNotFoundText'),
      action: `<a class="btn btn-primary" href="#/subjects">${escapeHtml(t('goSubjects'))}</a>`,
    })}</div>`;
    return node;
  }

  const { attempt, items, unavailable } = data;
  const isExam = attempt.type === 'exam';
  const topic = attempt.topicId ? findTopic(attempt.topicId)?.topic : null;
  const passScore = topic?.quiz?.passScore ?? 70;
  const passed = attempt.passed;
  const tone = scoreTone(attempt.percent);
  const message =
    attempt.percent >= 80 ? t('resultsGreat') : attempt.percent >= 50 ? t('resultsOk') : t('resultsLow');
  const correctCount = items.filter((i) => i.isCorrect).length;
  const wrongCount = items.filter((i) => !i.isCorrect && i.chosen !== null).length;
  const unansweredCount = items.filter((i) => i.chosen === null).length;
  const retryHref = isExam
    ? `#/exam/${encodeURIComponent(attempt.subjectId)}`
    : `#/quiz/${encodeURIComponent(attempt.topicId)}`;
  const backHref = isExam
    ? `#/subject/${encodeURIComponent(attempt.subjectId)}`
    : `#/lesson/${encodeURIComponent(attempt.topicId)}`;

  const node = document.createElement('div');
  node.className = 'page results-page';
  node.innerHTML = `
    <div class="container">
      <nav class="breadcrumbs" aria-label="breadcrumb">
        <a href="#/subjects">${escapeHtml(t('navSubjects'))}</a>
        ${icon('chevron', 14)}
        <a href="#/subject/${encodeURIComponent(attempt.subjectId)}">${escapeHtml(pick(attempt.subjectTitle))}</a>
        ${icon('chevron', 14)}
        <span aria-current="page">${escapeHtml(t('resultsTitle'))}</span>
      </nav>

      <section class="result-hero card">
        <div class="result-hero-main">
          ${scoreRing(attempt.percent, { size: 168, label: t('percent') })}
          <div class="result-copy">
            <p class="eyebrow">${escapeHtml(isExam ? t('resultsTypeExam') : t('resultsTypeQuiz'))}</p>
            <h1>${escapeHtml(pick(isExam ? attempt.topicTitle : attempt.topicTitle))}</h1>
            <div class="result-badges">
              ${
                isExam
                  ? `<span class="chip chip-brand">${icon('trophy', 14)} ${escapeHtml(t('resultsExamDone'))}</span>`
                  : passed
                    ? `<span class="chip chip-success">${icon('check', 14)} ${escapeHtml(t('resultsPassed'))}</span>`
                    : `<span class="chip chip-warn">${icon('alert', 14)} ${escapeHtml(t('resultsFailed'))}</span>`
              }
              <span class="chip chip-muted">${escapeHtml(t('resultsPercent', { percent: attempt.percent }))}</span>
            </div>
            <p class="result-score-line">${escapeHtml(t('resultsScoreOf', { score: correctCount, total: attempt.total }))}</p>
            <p class="result-message">${escapeHtml(message)}</p>
            <div class="result-meta">
              <span>${icon('calendar', 15)} ${escapeHtml(formatDateTime(attempt.createdAt))}</span>
              <span>${icon('book', 15)} ${escapeHtml(pick(attempt.subjectTitle))}</span>
              ${!isExam ? `<span>${icon('target', 15)} ${escapeHtml(t('resultsPassScore', { pass: passScore }))}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="result-actions">
          <a class="btn btn-primary" href="${retryHref}">${icon('refresh', 18)} ${escapeHtml(t('resultsRetry'))}</a>
          <a class="btn btn-secondary" href="${backHref}">${escapeHtml(isExam ? t('resultsBackSubject') : t('resultsBackTopic'))}</a>
          <a class="btn btn-ghost" href="#/profile">${escapeHtml(t('resultsToProfile'))}</a>
        </div>
      </section>

      <div class="result-stats">
        <div class="result-stat is-correct">
          <span class="result-stat-icon">${icon('check', 18)}</span>
          <div><strong>${correctCount}</strong><span>${escapeHtml(t('correct'))}</span></div>
        </div>
        <div class="result-stat is-wrong">
          <span class="result-stat-icon">${icon('close', 18)}</span>
          <div><strong>${wrongCount}</strong><span>${escapeHtml(t('incorrect'))}</span></div>
        </div>
        <div class="result-stat is-muted">
          <span class="result-stat-icon">${icon('info', 18)}</span>
          <div><strong>${unansweredCount}</strong><span>${escapeHtml(t('unanswered'))}</span></div>
        </div>
        <div class="result-stat is-brand">
          <span class="result-stat-icon">${icon('target', 18)}</span>
          <div><strong>${attempt.percent}%</strong><span>${escapeHtml(t('result'))}</span></div>
        </div>
      </div>

      <section class="section review-section">
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(t('resultsReview'))}</p>
            <h2>${escapeHtml(t('resultsReview'))}</h2>
            <p class="section-lead">${escapeHtml(t('resultsReviewText'))}</p>
          </div>
          <div class="filter-group" role="group" aria-label="${escapeHtml(t('resultsReview'))}">
            <button class="filter-btn is-active" type="button" data-filter="all">${escapeHtml(t('all'))} · ${items.length}</button>
            <button class="filter-btn" type="button" data-filter="wrong">${escapeHtml(t('incorrect'))} · ${wrongCount + unansweredCount}</button>
          </div>
        </div>

        ${
          unavailable
            ? `<div class="info-banner is-warning">
                <div class="info-banner-icon">${icon('alert', 20)}</div>
                <div><strong>${escapeHtml(t('resultsUnavailable'))}</strong><p>${escapeHtml(t('resultsUnavailableText'))}</p></div>
              </div>`
            : ''
        }

        <div class="review-list" id="reviewList">
          ${
            items.length
              ? items
                  .map((item, index) => {
                    const isCorrect = item.isCorrect;
                    return `<article class="review-item ${isCorrect ? 'is-correct' : 'is-wrong'}" data-correct="${isCorrect}">
                      <header class="review-head">
                        <span class="review-num">${String(index + 1).padStart(2, '0')}</span>
                        <div class="review-head-main">
                          <p class="review-question">${escapeHtml(pick(item.text))}</p>
                          <span class="review-status ${isCorrect ? 'is-correct' : 'is-wrong'}">
                            ${icon(isCorrect ? 'check' : 'close', 14)}
                            ${escapeHtml(isCorrect ? t('correct') : item.chosen === null ? t('unanswered') : t('incorrect'))}
                          </span>
                        </div>
                      </header>
                      <ul class="review-options">
                        ${item.options
                          .map((option, optIndex) => {
                            const isRight = optIndex === item.correct;
                            const isChosen = optIndex === item.chosen;
                            return `<li class="review-option ${isRight ? 'is-right' : ''} ${isChosen && !isRight ? 'is-picked-wrong' : ''}">
                              <span class="review-letter">${escapeHtml(LETTERS[optIndex])}</span>
                              <span class="review-option-text">${escapeHtml(pick(option))}</span>
                              <span class="review-tags">
                                ${isRight ? `<span class="review-tag is-right">${escapeHtml(t('resultsCorrectAnswer'))}</span>` : ''}
                                ${isChosen ? `<span class="review-tag is-picked">${escapeHtml(t('resultsYourAnswer'))}</span>` : ''}
                              </span>
                            </li>`;
                          })
                          .join('')}
                      </ul>
                      ${
                        item.chosen === null
                          ? `<p class="review-note">${icon('info', 15)} ${escapeHtml(t('resultsNoAnswer'))}</p>`
                          : ''
                      }
                      <div class="review-explanation">
                        <span class="review-tag-label">${escapeHtml(t('explanation'))}</span>
                        <p>${escapeHtml(pick(item.explanation))}</p>
                      </div>
                    </article>`;
                  })
                  .join('')
              : emptyState({ iconName: 'info', title: t('resultsUnavailable'), text: t('resultsUnavailableText') })
          }
        </div>
        <p class="review-empty" id="reviewEmpty" hidden>${escapeHtml(t('profileNoReviewText'))}</p>
      </section>

      <div class="result-bottom-actions">
        <a class="btn btn-secondary" href="#/subject/${encodeURIComponent(attempt.subjectId)}">${escapeHtml(t('resultsBackSubject'))}</a>
        <a class="btn btn-primary" href="${retryHref}">${icon('refresh', 17)} ${escapeHtml(t('resultsRetry'))}</a>
      </div>
    </div>`;

  const list = node.querySelector('#reviewList');
  node.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      node.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('is-active', b === btn));
      const filter = btn.dataset.filter;
      let visible = 0;
      list.querySelectorAll('.review-item').forEach((item) => {
        const show = filter === 'all' || item.dataset.correct === 'false';
        item.hidden = !show;
        if (show) visible += 1;
      });
      node.querySelector('#reviewEmpty').hidden = visible !== 0;
    });
  });

  return node;
}
