import { t, pick } from '../i18n.js';
import { state } from '../store.js';
import { api } from '../api.js';
import { escapeHtml, icon, subjectTheme, go } from '../utils.js';
import { progressBar, scoreRing, emptyState, toast } from '../components.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export async function practicePage({ params }) {
  const data = await api.practice(params.id);
  const { subject, topic, questions } = data;
  const theme = subjectTheme(subject.id, 0);

  const node = document.createElement('div');
  node.className = `page practice-page theme-${theme}`;

  if (!questions.length) {
    node.innerHTML = `<div class="container section">
      <div class="breadcrumbs">
        <a href="#/subjects">${escapeHtml(t('navSubjects'))}</a> ${icon('chevron', 14)}
        <a href="#/subject/${encodeURIComponent(subject.id)}">${escapeHtml(pick(subject.title))}</a>
        ${icon('chevron', 14)}
        <span>${escapeHtml(pick(topic.title))}</span>
      </div>
      ${emptyState({
        iconName: 'target',
        title: t('practiceEmpty'),
        text: t('practiceEmptyText'),
        action: `<a class="btn btn-primary" href="#/lesson/${encodeURIComponent(topic.id)}">${escapeHtml(t('practiceToLesson'))}</a>
                 <a class="btn btn-secondary" href="#/subject/${encodeURIComponent(subject.id)}">${escapeHtml(t('practiceToSubject'))}</a>`,
      })}
    </div>`;
    return node;
  }

  if (state.user) {
    api.lastViewed(subject.id, topic.id).catch(() => {});
  }

  const stateLocal = {
    index: 0,
    selected: null,
    checked: false,
    correctCount: 0,
    finished: false,
  };

  node.innerHTML = `
    <div class="container">
      <nav class="breadcrumbs" aria-label="breadcrumb">
        <a href="#/subjects">${escapeHtml(t('navSubjects'))}</a>
        ${icon('chevron', 14)}
        <a href="#/subject/${encodeURIComponent(subject.id)}">${escapeHtml(pick(subject.title))}</a>
        ${icon('chevron', 14)}
        <a href="#/lesson/${encodeURIComponent(topic.id)}">${escapeHtml(pick(topic.title))}</a>
      </nav>
      <header class="practice-head">
        <div>
          <p class="eyebrow">${escapeHtml(t('practiceTitle'))}</p>
          <h1>${escapeHtml(pick(topic.title))}</h1>
          <p class="page-lead">${escapeHtml(t('practiceSubtitle'))}</p>
        </div>
        <div class="practice-head-meta">
          <span class="chip chip-muted">${icon('target', 14)} ${questions.length} ${escapeHtml(t('practice'))}</span>
          <span class="chip chip-muted">${icon('book', 14)} ${escapeHtml(pick(subject.title))}</span>
        </div>
      </header>
      <section class="practice-shell card" aria-live="polite">
        <div class="quiz-top" id="practiceTop"></div>
        <div id="practiceStage"></div>
      </section>
    </div>`;

  const stage = node.querySelector('#practiceStage');
  const top = node.querySelector('#practiceTop');

  function renderTop() {
    const current = Math.min(stateLocal.index + 1, questions.length);
    const percent = stateLocal.finished ? 100 : ((stateLocal.index + (stateLocal.checked ? 1 : 0.2)) / questions.length) * 100;
    top.innerHTML = `
      <div class="quiz-top-row">
        <span class="quiz-counter">${escapeHtml(t('testQuestionOf', { current, total: questions.length }))}</span>
        <span class="quiz-score">${icon('check', 15)} ${escapeHtml(t('practiceScore'))}: ${stateLocal.correctCount}</span>
      </div>
      ${progressBar(percent, theme)}`;
  }

  function wireStage() {
    stage.querySelectorAll('input[name="practice-option"]').forEach((input) => {
      input.addEventListener('change', () => {
        stateLocal.selected = Number(input.value);
        stage.querySelectorAll('.option').forEach((option) => {
          option.classList.toggle('is-selected', Number(option.dataset.index) === stateLocal.selected);
        });
        const checkButton = stage.querySelector('[data-action="check"]');
        if (checkButton) {
          checkButton.disabled = false;
          checkButton.removeAttribute('aria-disabled');
        }
      });
    });
    stage.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'check') checkAnswer();
        if (action === 'next') nextQuestion();
        if (action === 'restart') restart();
      });
    });
  }

  function checkAnswer() {
    if (stateLocal.selected === null || stateLocal.checked) return;
    const question = questions[stateLocal.index];
    stateLocal.checked = true;
    if (stateLocal.selected === question.correct) stateLocal.correctCount += 1;
    renderQuestion({ reveal: true });
  }

  function nextQuestion() {
    if (stateLocal.index < questions.length - 1) {
      stateLocal.index += 1;
      stateLocal.selected = null;
      stateLocal.checked = false;
      renderQuestion();
      node.querySelector('.practice-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      stateLocal.finished = true;
      renderSummary();
      node.querySelector('.practice-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function restart() {
    stateLocal.index = 0;
    stateLocal.selected = null;
    stateLocal.checked = false;
    stateLocal.correctCount = 0;
    stateLocal.finished = false;
    renderQuestion();
    toast(t('practiceTitle') + ' · ' + pick(topic.title), 'info', 2200);
  }

  function optionClass(index, question) {
    if (!stateLocal.checked) return Number(stateLocal.selected) === index ? 'is-selected' : '';
    if (index === question.correct) return 'is-correct';
    if (index === stateLocal.selected) return 'is-wrong';
    return 'is-dimmed';
  }

  function optionBadge(index, question) {
    if (!stateLocal.checked || index !== question.correct) return escapeHtml(LETTERS[index]);
    return icon('check', 16);
  }

  function renderQuestion({ reveal = false } = {}) {
    const question = questions[stateLocal.index];
    const selected = stateLocal.selected;
    renderTop();
    stage.innerHTML = `
      <div class="question-card">
        <p class="question-number">${escapeHtml(t('practice'))} · ${stateLocal.index + 1}/${questions.length}</p>
        <h2 class="question-text">${escapeHtml(pick(question.text))}</h2>
        <form class="options" novalidate>
          ${question.options
            .map((option, index) => {
              const cls = reveal ? optionClass(index, question) : selected !== null && Number(selected) === index ? 'is-selected' : '';
              return `<label class="option ${cls}" data-index="${index}">
                <input type="radio" name="practice-option" value="${index}" ${selected !== null && Number(selected) === index ? 'checked' : ''} ${stateLocal.checked ? 'disabled' : ''}>
                <span class="option-letter">${reveal ? optionBadge(index, question) : escapeHtml(LETTERS[index])}</span>
                <span class="option-text">${escapeHtml(pick(option))}</span>
                ${reveal && index === question.correct ? `<span class="option-flag">${escapeHtml(t('correct'))}</span>` : ''}
                ${reveal && index === stateLocal.selected && index !== question.correct ? `<span class="option-flag is-wrong">${escapeHtml(t('incorrect'))}</span>` : ''}
              </label>`;
            })
            .join('')}
        </form>
        <div id="practiceFeedback">${renderFeedback(question)}</div>
        <div class="quiz-footer">
          <span class="quiz-hint">${stateLocal.checked ? '' : escapeHtml(t('practiceChooseAnswer'))}</span>
          ${
            stateLocal.checked
              ? `<button class="btn btn-primary" type="button" data-action="next">${stateLocal.index === questions.length - 1 ? escapeHtml(t('practiceSeeResults')) : escapeHtml(t('practiceNext'))} ${icon('arrow-right', 18)}</button>`
              : `<button class="btn btn-primary" type="button" data-action="check" ${selected === null ? 'disabled' : ''}>${escapeHtml(t('practiceCheck'))}</button>`
          }
        </div>
      </div>`;
    const checkBtn = stage.querySelector('[data-action="check"]');
    const nextBtn = stage.querySelector('[data-action="next"]');
    if (checkBtn) {
      checkBtn.disabled = selected === null;
    }
    if (nextBtn) {
      nextBtn.dataset.action = 'next';
    }
    wireStage();
  }

  function renderFeedback(question) {
    if (!stateLocal.checked) return '';
    const isCorrect = stateLocal.selected === question.correct;
    return `<div class="feedback ${isCorrect ? 'is-correct' : 'is-wrong'}" role="status">
      <div class="feedback-head">
        <span class="feedback-icon">${icon(isCorrect ? 'check' : 'close', 18)}</span>
        <strong>${escapeHtml(isCorrect ? t('practiceCorrectTitle') : t('practiceWrongTitle'))}</strong>
      </div>
      ${!isCorrect ? `<p class="feedback-correct">${escapeHtml(t('correctAnswer'))}: <strong>${escapeHtml(pick(question.options[question.correct]))}</strong></p>` : ''}
      <div class="feedback-explanation">
        <span class="feedback-label">${escapeHtml(t('practiceExplanation'))}</span>
        <p>${escapeHtml(pick(question.explanation))}</p>
      </div>
    </div>`;
  }

  function renderSummary() {
    const percent = Math.round((stateLocal.correctCount / questions.length) * 100);
    const message = percent >= 80 ? t('practiceResultGreat') : percent >= 50 ? t('practiceResultGood') : t('practiceResultLow');
    renderTop();
    stage.innerHTML = `
      <div class="result-inline">
        <div class="result-inline-ring">${scoreRing(percent, { size: 150, label: t('practiceScore') })}</div>
        <div class="result-inline-body">
          <p class="eyebrow">${escapeHtml(t('practiceResultTitle'))}</p>
          <h2>${escapeHtml(t('resultsScoreOf', { score: stateLocal.correctCount, total: questions.length }))}</h2>
          <p>${escapeHtml(message)}</p>
          <div class="result-inline-actions">
            <a class="btn btn-primary" href="#/quiz/${encodeURIComponent(topic.id)}">${escapeHtml(t('practiceToQuiz'))} ${icon('arrow-right', 18)}</a>
            <button class="btn btn-secondary" type="button" data-action="restart">${icon('refresh', 17)} ${escapeHtml(t('practiceTryAgain'))}</button>
            <a class="btn btn-ghost" href="#/lesson/${encodeURIComponent(topic.id)}">${escapeHtml(t('practiceToLesson'))}</a>
          </div>
        </div>
      </div>`;
    wireStage();
  }

  renderQuestion();
  return node;
}
