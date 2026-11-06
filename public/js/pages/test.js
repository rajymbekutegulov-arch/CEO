import { t, pick } from '../i18n.js';
import { state, refreshProgress } from '../store.js';
import { api } from '../api.js';
import {
  escapeHtml,
  icon,
  subjectTheme,
  formatClock,
  go,
} from '../utils.js';
import { progressBar, emptyState, authPrompt, toast, confirmDialog } from '../components.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export async function testPage({ params, type }) {
  const isExam = type === 'exam';
  const data = isExam ? await api.exam(params.id) : await api.quiz(params.id);
  const subject = data.subject;
  const topic = isExam ? null : data.topic;
  const questions = isExam ? data.exam.questions : data.quiz.questions;
  const title = isExam ? data.exam.title : data.quiz.title;
  const passScore = isExam ? null : data.quiz.passScore;
  const durationMin = isExam ? data.exam.durationMin : null;
  const theme = subjectTheme(subject.id, 0);
  const backHref = isExam
    ? `#/subject/${encodeURIComponent(subject.id)}`
    : `#/lesson/${encodeURIComponent(topic.id)}`;
  const selfHref = isExam ? `#/exam/${encodeURIComponent(subject.id)}` : `#/quiz/${encodeURIComponent(topic.id)}`;

  const node = document.createElement('div');
  node.className = `page test-page theme-${theme}`;

  node.innerHTML = `
    <div class="container">
      <nav class="breadcrumbs" aria-label="breadcrumb">
        <a href="#/subjects">${escapeHtml(t('navSubjects'))}</a>
        ${icon('chevron', 14)}
        <a href="#/subject/${encodeURIComponent(subject.id)}">${escapeHtml(pick(subject.title))}</a>
        ${!isExam ? `${icon('chevron', 14)}<a href="#/lesson/${encodeURIComponent(topic.id)}">${escapeHtml(pick(topic.title))}</a>` : ''}
        ${icon('chevron', 14)}
        <span aria-current="page">${escapeHtml(pick(title))}</span>
      </nav>
      <div id="testRoot"></div>
    </div>`;

  const root = node.querySelector('#testRoot');

  if (!state.user) {
    root.innerHTML = authPrompt(selfHref, { title: t('testLoginTitle'), text: t('testLoginText') });
    return node;
  }

  if (!questions.length) {
    root.innerHTML = `<div class="section">${emptyState({
      iconName: 'target',
      title: t('testEmpty'),
      text: t('testEmptyText'),
      action: `<a class="btn btn-primary" href="${backHref}">${escapeHtml(t('testBackTopic'))}</a>`,
    })}</div>`;
    return node;
  }

  const total = questions.length;
  const s = {
    started: false,
    index: 0,
    answers: {},
    submitting: false,
    finished: false,
    remaining: durationMin ? durationMin * 60 : 0,
    elapsed: 0,
  };
  let timerId = null;

  function intro() {
    root.innerHTML = `
      <div class="test-intro">
        <section class="test-intro-card card">
          <div class="test-intro-icon">${icon(isExam ? 'trophy' : 'target', 30)}</div>
          <p class="eyebrow">${escapeHtml(isExam ? t('resultsTypeExam') : t('resultsTypeQuiz'))}</p>
          <h1>${escapeHtml(pick(title))}</h1>
          <p class="test-intro-sub">${escapeHtml(isExam ? pick(data.exam.description) : t('testIntroText'))}</p>
          <div class="meta-row">
            <span class="meta-item">${icon('check', 16)} ${total} ${escapeHtml(t('questions'))}</span>
            <span class="meta-item">${icon('clock', 16)} ${isExam ? `${durationMin} ${escapeHtml(t('minutes'))}` : escapeHtml(t('testRuleTimeNone'))}</span>
            ${passScore !== null ? `<span class="meta-item">${icon('target', 16)} ${escapeHtml(t('resultsPassScore', { pass: passScore }))}</span>` : ''}
          </div>
          <div class="test-rules">
            <h2>${escapeHtml(t('testRulesTitle'))}</h2>
            <ul>
              <li>${icon('check', 16)} <span>${escapeHtml(t('testRuleCount', { count: total }))}</span></li>
              <li>${icon('clock', 16)} <span>${escapeHtml(isExam ? t('testRuleTime', { minutes: durationMin }) : t('testRuleTimeNone'))}</span></li>
              ${passScore !== null ? `<li>${icon('target', 16)} <span>${escapeHtml(t('testRulePass', { pass: passScore }))}</span></li>` : ''}
              ${isExam ? `<li>${icon('book', 16)} <span>${escapeHtml(t('testRuleExam'))}</span></li>` : ''}
              <li>${icon('refresh', 16)} <span>${escapeHtml(t('testRuleRetry'))}</span></li>
            </ul>
          </div>
          <div class="test-intro-actions">
            <button class="btn btn-primary btn-lg" type="button" data-start>${escapeHtml(isExam ? t('testStartExam') : t('testStart'))} ${icon('arrow-right', 19)}</button>
            <a class="btn btn-secondary btn-lg" href="${backHref}">${escapeHtml(t('testBackTopic'))}</a>
          </div>
          <p class="test-intro-note">${icon('shield', 15)} ${escapeHtml(t('testSavedHint'))}</p>
        </section>
        <aside class="test-intro-aside">
          <div class="aside-card">
            <h2 class="aside-title">${escapeHtml(pick(subject.title))}</h2>
            <p class="aside-note">${escapeHtml(t(isExam ? 'subjectExamText' : 'practiceSubtitle'))}</p>
            <div class="test-facts">
              <div><strong>${total}</strong><span>${escapeHtml(t('questions'))}</span></div>
              <div><strong>${isExam ? durationMin : '∞'}</strong><span>${escapeHtml(t('minutes'))}</span></div>
              <div><strong>${passScore !== null ? `${passScore}%` : t('exam')}</strong><span>${escapeHtml(passScore !== null ? t('testRulePass', { pass: passScore }).split('—')[0] : t('resultsTypeExam'))}</span></div>
            </div>
          </div>
        </aside>
      </div>`;
    root.querySelector('[data-start]').addEventListener('click', start);
  }

  function start() {
    s.started = true;
    s.index = 0;
    root.innerHTML = `
      <div class="test-shell">
        <div class="quiz-top test-top" id="testTop"></div>
        <div id="testQuestion"></div>
      </div>`;
    renderTop();
    renderQuestion();
    if (isExam) {
      timerId = window.setInterval(() => {
        s.remaining -= 1;
        updateTimer();
        if (s.remaining <= 0) {
          clearInterval(timerId);
          timerId = null;
          toast(t('testAutoSubmit'), 'info');
          submit(true);
        }
      }, 1000);
    } else {
      timerId = window.setInterval(() => {
        s.elapsed += 1;
        updateTimer();
      }, 1000);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateTimer() {
    const el = root.querySelector('#testTimer');
    if (!el) return;
    const time = isExam ? Math.max(0, s.remaining) : s.elapsed;
    el.innerHTML = `<span class="timer-label">${escapeHtml(isExam ? t('testTimeLeft') : t('testElapsed'))}</span>
      <span class="timer-value">${icon('clock', 16)} ${formatClock(time)}</span>`;
    el.classList.toggle('is-warning', isExam && s.remaining <= 60);
  }

  function answeredCount() {
    return Object.keys(s.answers).length;
  }

  function renderTop() {
    const top = root.querySelector('#testTop');
    if (!top) return;
    const answered = answeredCount();
    top.innerHTML = `
      <div class="quiz-top-row">
        <span class="quiz-counter">${escapeHtml(t('testQuestionOf', { current: s.index + 1, total }))}</span>
        <div class="test-top-actions">
          <div class="quiz-timer" id="testTimer" aria-live="off"></div>
          <button class="btn btn-secondary btn-sm" type="button" data-submit ${s.submitting ? 'disabled' : ''}>${escapeHtml(s.submitting ? t('testSubmitting') : t('testSubmit'))}</button>
        </div>
      </div>
      ${progressBar((answered / total) * 100, theme)}
      <div class="quiz-top-row is-secondary">
        <span class="quiz-answered">${escapeHtml(t('testAnswered', { answered, total }))}</span>
        <div class="dots" role="group" aria-label="${escapeHtml(t('testQuestionMap'))}">
          ${questions
            .map(
              (q, i) =>
                `<button class="dot ${i === s.index ? 'is-current' : ''} ${s.answers[q.id] !== undefined ? 'is-answered' : ''}" type="button" data-jump="${i}" aria-label="${escapeHtml(t('testQuestionOf', { current: i + 1, total }))}" ${i === s.index ? 'aria-current="true"' : ''}>${i + 1}</button>`,
            )
            .join('')}
        </div>
      </div>`;
    wireTop();
    updateTimer();
  }

  function wireTop() {
    const top = root.querySelector('#testTop');
    top.querySelector('[data-submit]')?.addEventListener('click', () => submit(false));
    top.querySelectorAll('[data-jump]').forEach((btn) => {
      btn.addEventListener('click', () => {
        s.index = Number(btn.dataset.jump);
        renderTop();
        renderQuestion();
      });
    });
  }

  function renderQuestion() {
    const question = questions[s.index];
    const selected = s.answers[question.id];
    const area = root.querySelector('#testQuestion');
    area.innerHTML = `
      <div class="question-card card">
        <p class="question-number">${escapeHtml(t('question'))} ${s.index + 1} / ${total}</p>
        <h2 class="question-text">${escapeHtml(pick(question.text))}</h2>
        <form class="options" novalidate>
          ${question.options
            .map(
              (option, index) => `<label class="option ${selected === index ? 'is-selected' : ''}" data-index="${index}">
                <input type="radio" name="test-option" value="${index}" ${selected === index ? 'checked' : ''}>
                <span class="option-letter">${escapeHtml(LETTERS[index])}</span>
                <span class="option-text">${escapeHtml(pick(option))}</span>
              </label>`,
            )
            .join('')}
        </form>
        <div class="quiz-footer">
          <button class="btn btn-ghost" type="button" data-prev ${s.index === 0 ? 'disabled' : ''}>${icon('arrow-left', 18)} ${escapeHtml(t('testPrev'))}</button>
          <div class="quiz-footer-right">
            ${
              s.index === total - 1
                ? `<button class="btn btn-primary" type="button" data-finish>${escapeHtml(t('testSubmit'))} ${icon('check', 18)}</button>`
                : `<button class="btn btn-primary" type="button" data-next>${escapeHtml(t('testNext'))} ${icon('arrow-right', 18)}</button>`
            }
          </div>
        </div>
      </div>`;
    wireQuestion();
  }

  function wireQuestion() {
    const area = root.querySelector('#testQuestion');
    area.querySelectorAll('input[name="test-option"]').forEach((input) => {
      input.addEventListener('change', () => {
        const question = questions[s.index];
        s.answers[question.id] = Number(input.value);
        area.querySelectorAll('.option').forEach((option) => {
          option.classList.toggle('is-selected', Number(option.dataset.index) === s.answers[question.id]);
        });
        renderTop();
      });
    });
    area.querySelector('[data-prev]')?.addEventListener('click', () => {
      if (s.index > 0) {
        s.index -= 1;
        renderTop();
        renderQuestion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    area.querySelector('[data-next]')?.addEventListener('click', () => {
      if (s.index < total - 1) {
        s.index += 1;
        renderTop();
        renderQuestion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    area.querySelector('[data-finish]')?.addEventListener('click', () => submit(false));
  }

  async function submit(force) {
    if (s.submitting || s.finished) return;
    const unanswered = total - answeredCount();
    if (!force && unanswered > 0) {
      const ok = await confirmDialog({
        title: t('testSubmitConfirmTitle'),
        text: t('testSubmitConfirmUnanswered', { count: unanswered }),
        confirmLabel: t('testSubmit'),
        danger: true,
      });
      if (!ok) return;
    } else if (!force) {
      const ok = await confirmDialog({
        title: t('testSubmitConfirmTitle'),
        text: t('testSubmitConfirmText'),
        confirmLabel: t('testSubmit'),
      });
      if (!ok) return;
    }
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    s.submitting = true;
    renderTop();
    const payload = {
      type: isExam ? 'exam' : 'quiz',
      subjectId: subject.id,
      answers: s.answers,
    };
    if (!isExam) payload.topicId = topic.id;
    try {
      const result = await api.submitAttempt(payload);
      s.finished = true;
      refreshProgress().catch(() => {});
      go(`/results/${encodeURIComponent(result.attempt.id)}`);
    } catch (err) {
      s.submitting = false;
      renderTop();
      toast(err.code === 'network' ? t('errorNetwork') : t('testErrorSubmit'), 'error', 6000);
      if (isExam) {
        timerId = window.setInterval(() => {
          s.remaining -= 1;
          updateTimer();
          if (s.remaining <= 0) {
            clearInterval(timerId);
            timerId = null;
            submit(true);
          }
        }, 1000);
      }
    }
  }

  function onBeforeUnload(event) {
    if (!s.started || s.finished) return;
    event.preventDefault();
    event.returnValue = '';
  }
  window.addEventListener('beforeunload', onBeforeUnload);

  intro();

  return {
    node,
    cleanup() {
      if (timerId) clearInterval(timerId);
      window.removeEventListener('beforeunload', onBeforeUnload);
    },
  };
}
