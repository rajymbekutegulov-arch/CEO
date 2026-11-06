import { t, pick } from '../i18n.js';
import { state } from '../store.js';
import { api } from '../api.js';
import {
  escapeHtml,
  icon,
  subjectTheme,
  subjectIcon,
  initials,
  go,
} from '../utils.js';
import {
  toast,
  confirmDialog,
  emptyState,
  loadingState,
  pageHead,
} from '../components.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

function clone(value) {
  return structuredClone(value);
}

function blankQuestion() {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: { ru: '', kz: '' },
    options: Array.from({ length: 4 }, () => ({ ru: '', kz: '' })),
    correct: 0,
    explanation: { ru: '', kz: '' },
  };
}

function blankTopic() {
  return {
    id: '',
    title: { ru: '', kz: '' },
    summary: { ru: '', kz: '' },
    duration: 12,
    lesson: { ru: '', kz: '' },
    practice: [],
    quiz: {
      title: { ru: 'Тематический тест', kz: 'Тақырыптық тест' },
      passScore: 70,
      questions: [],
    },
  };
}

function blankSubjectForm() {
  return {
    id: '',
    title: { ru: '', kz: '' },
    tagline: { ru: '', kz: '' },
    description: { ru: '', kz: '' },
  };
}

function missingLocalized(value) {
  return !value || !String(value.ru || '').trim() || !String(value.kz || '').trim();
}

function questionsValid(list) {
  for (const q of list) {
    if (missingLocalized(q.text) || missingLocalized(q.explanation)) return false;
    if (!q.options.length || q.options.some(missingLocalized)) return false;
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) return false;
  }
  return true;
}

function topicValid(topic) {
  return (
    !missingLocalized(topic.title) &&
    !missingLocalized(topic.summary) &&
    !missingLocalized(topic.lesson) &&
    Number.isFinite(Number(topic.duration)) &&
    !missingLocalized(topic.quiz.title) &&
    questionsValid(topic.practice) &&
    questionsValid(topic.quiz.questions)
  );
}

function examValid(exam) {
  return (
    !missingLocalized(exam.title) &&
    !missingLocalized(exam.description) &&
    Number.isFinite(Number(exam.durationMin)) &&
    questionsValid(exam.questions)
  );
}

export async function teacherPage() {
  const node = document.createElement('div');
  node.className = 'page teacher-page';

  if (!state.user || state.user.role !== 'teacher') {
    node.innerHTML = `<div class="container section">
      <div class="auth-prompt card">
        <div class="auth-prompt-icon">${icon('lock', 26)}</div>
        <h1>${escapeHtml(t('teacherDeniedTitle'))}</h1>
        <p>${escapeHtml(t('teacherDeniedText'))}</p>
        <div class="auth-prompt-actions">
          <a class="btn btn-primary" href="#/profile">${escapeHtml(t('backToProfile'))}</a>
          <a class="btn btn-secondary" href="#/subjects">${escapeHtml(t('goSubjects'))}</a>
        </div>
      </div>
    </div>`;
    return node;
  }

  let subjects = [];
  try {
    const data = await api.teacherContent();
    subjects = data.subjects;
  } catch (err) {
    node.innerHTML = `<div class="container section">
      ${emptyState({
        iconName: 'alert',
        title: t('errorTitle'),
        text: err.code === 'network' ? t('offlineHint') : t('errorText'),
        action: `<button class="btn btn-primary" type="button" data-retry>${escapeHtml(t('retry'))}</button>`,
      })}
    </div>`;
    node.querySelector('[data-retry]')?.addEventListener('click', () => go('/teacher'));
    return node;
  }

  const ui = {
    tab: 'overview',
    subjectId: subjects[0]?.id || null,
    mode: 'list',
    editLang: state.lang === 'kz' ? 'kz' : 'ru',
    saving: false,
    error: '',
    topicDraft: null,
    topicIsNew: false,
    subjectForm: null,
    examDraft: null,
    examSubjectId: null,
  };

  node.innerHTML = `
    <div class="container section">
      ${pageHead({
        eyebrow: t('teacher'),
        title: t('teacherTitle'),
        text: t('teacherSubtitle'),
      })}
      <div class="teacher-layout">
        <aside class="teacher-side">
          <div class="teacher-user">
            <span class="avatar theme-${initials(state.user.name)}">${escapeHtml(initials(state.user.name))}</span>
            <div><strong>${escapeHtml(state.user.name)}</strong><span>${escapeHtml(t('teacher'))}</span></div>
          </div>
          <nav class="teacher-tabs" aria-label="${escapeHtml(t('teacherTitle'))}">
            ${[
              ['overview', 'chart', t('tabOverview')],
              ['content', 'book', t('tabContent')],
              ['exam', 'trophy', t('tabExam')],
              ['transfer', 'download', t('tabTransfer')],
            ]
              .map(
                ([key, ico, label]) => `<button class="teacher-tab" type="button" data-tab="${key}" aria-current="${ui.tab === key ? 'page' : 'false'}">
                  ${icon(ico, 18)} <span>${escapeHtml(label)}</span>
                </button>`,
              )
              .join('')}
          </nav>
          <div class="teacher-side-footer">
            <a class="btn btn-ghost btn-sm btn-block" href="#/profile">${icon('arrow-left', 16)} ${escapeHtml(t('backToProfile'))}</a>
            <p class="teacher-side-note">${icon('shield', 14)} ${escapeHtml(t('teacherBackendNote'))}</p>
          </div>
        </aside>
        <main class="teacher-main" id="teacherMain"></main>
      </div>
    </div>`;

  const main = node.querySelector('#teacherMain');

  function subject() {
    return subjects.find((s) => s.id === ui.subjectId) || subjects[0] || null;
  }

  function render() {
    node.querySelectorAll('.teacher-tab').forEach((btn) => {
      btn.setAttribute('aria-current', btn.dataset.tab === ui.tab ? 'page' : 'false');
    });
    main.innerHTML = `
      ${ui.error ? `<div class="form-error is-block" role="alert">${icon('alert', 16)} ${escapeHtml(ui.error)}</div>` : ''}
      ${ui.tab === 'overview' ? renderOverview() : ''}
      ${ui.tab === 'content' ? renderContent() : ''}
      ${ui.tab === 'exam' ? renderExam() : ''}
      ${ui.tab === 'transfer' ? renderTransfer() : ''}
    `;
  }

  function overviewStats() {
    let topics = 0;
    let questions = 0;
    for (const s of subjects) {
      topics += s.topics.length;
      for (const topic of s.topics) {
        questions += topic.practice.length + topic.quiz.questions.length;
      }
      questions += s.exam.questions.length;
    }
    return { topics, questions };
  }

  function renderOverview() {
    const stats = overviewStats();
    return `
      <div class="teacher-panel-head">
        <div>
          <h2>${escapeHtml(t('teacherOverviewTitle'))}</h2>
          <p>${escapeHtml(t('teacherOverviewText'))}</p>
        </div>
      </div>
      <div class="teacher-stats">
        <div class="teacher-stat"><span class="teacher-stat-icon">${icon('book', 20)}</span><strong>${subjects.length}</strong><span>${escapeHtml(t('teacherStatSubjects'))}</span></div>
        <div class="teacher-stat"><span class="teacher-stat-icon">${icon('map', 20)}</span><strong>${stats.topics}</strong><span>${escapeHtml(t('teacherStatTopics'))}</span></div>
        <div class="teacher-stat"><span class="teacher-stat-icon">${icon('target', 20)}</span><strong>${stats.questions}</strong><span>${escapeHtml(t('teacherStatQuestions'))}</span></div>
        <div class="teacher-stat"><span class="teacher-stat-icon">${icon('trophy', 20)}</span><strong>${subjects.length}</strong><span>${escapeHtml(t('teacherStatExams'))}</span></div>
      </div>
      <div class="teacher-cards">
        ${subjects
          .map(
            (s, index) => `<article class="teacher-subject-card card theme-${subjectTheme(s.id, index)}">
              <div class="teacher-subject-head">
                <span class="subject-icon">${icon(subjectIcon(s.id), 22)}</span>
                <div>
                  <h3>${escapeHtml(pick(s.title))}</h3>
                  <p>${escapeHtml(pick(s.tagline))}</p>
                </div>
              </div>
              <div class="teacher-subject-meta">
                <span>${icon('book', 15)} ${s.topics.length} ${escapeHtml(t('topics'))}</span>
                <span>${icon('target', 15)} ${s.exam.questions.length} ${escapeHtml(t('teacherStatQuestions'))}</span>
              </div>
              <div class="teacher-subject-actions">
                <button class="btn btn-secondary btn-sm" type="button" data-action="open-content" data-subject-id="${escapeHtml(s.id)}">${icon('edit', 15)} ${escapeHtml(t('teacherEditTopic'))}</button>
                <a class="btn btn-ghost btn-sm" href="#/subject/${encodeURIComponent(s.id)}" target="_blank" rel="noopener">${escapeHtml(t('teacherPreview'))}</a>
              </div>
            </article>`,
          )
          .join('')}
      </div>
      <div class="teacher-note card">
        <div class="teacher-note-icon">${icon('info', 20)}</div>
        <div>
          <h3>${escapeHtml(t('teacherStorageTitle'))}</h3>
          <p>${escapeHtml(t('teacherStorageText'))}</p>
        </div>
      </div>`;
  }

  function subjectChips() {
    return `<div class="teacher-subject-chips" role="group" aria-label="${escapeHtml(t('teacherSelectSubject'))}">
      ${subjects
        .map(
          (s, index) => `<button class="teacher-chip ${s.id === ui.subjectId ? 'is-active' : ''} theme-${subjectTheme(s.id, index)}" type="button" data-subject-id="${escapeHtml(s.id)}">
            ${icon(subjectIcon(s.id), 16)} ${escapeHtml(pick(s.title))}
          </button>`,
        )
        .join('')}
      <button class="teacher-chip is-add" type="button" data-action="add-subject">${icon('plus', 16)} ${escapeHtml(t('teacherAddSubject'))}</button>
    </div>`;
  }

  function subjectFormPanel() {
    const form = ui.subjectForm;
    const lang = ui.editLang;
    return `
      <div class="editor-toolbar">
        <button class="btn btn-ghost btn-sm" type="button" data-action="close-subject-form">${icon('arrow-left', 16)} ${escapeHtml(t('backToList'))}</button>
        <div class="editor-toolbar-right">
          ${editorLangSwitch()}
          <button class="btn btn-primary btn-sm" type="button" data-action="save-subject" ${ui.saving ? 'disabled' : ''}>${icon('save', 16)} ${escapeHtml(ui.saving ? t('saving') : t('save'))}</button>
        </div>
      </div>
      <div class="teacher-panel card">
        <h2>${escapeHtml(form.id ? t('teacherSubjectSettings') : t('teacherCreateSubject'))}</h2>
        <p class="panel-lead">${escapeHtml(form.id ? t('teacherSubjectSettings') : t('teacherCreateSubjectText'))}</p>
        <div class="editor-grid">
          <label class="field is-full">
            <span class="field-label">${escapeHtml(t('teacherSubjectTitle'))} · ${lang.toUpperCase()}</span>
            <input class="input" type="text" maxlength="160" data-field="subjectTitle" value="${escapeHtml(form.title[lang])}" placeholder="${escapeHtml(t('teacherSubjectPlaceholder'))}">
          </label>
          <label class="field is-full">
            <span class="field-label">${escapeHtml(t('teacherSubjectTagline'))} · ${lang.toUpperCase()}</span>
            <input class="input" type="text" maxlength="200" data-field="subjectTagline" value="${escapeHtml(form.tagline[lang])}" placeholder="${escapeHtml(t('teacherTaglinePlaceholder'))}">
          </label>
          <label class="field is-full">
            <span class="field-label">${escapeHtml(t('teacherSubjectDescription'))} · ${lang.toUpperCase()}</span>
            <textarea class="input textarea" rows="3" maxlength="1200" data-field="subjectDescription" placeholder="${escapeHtml(t('teacherDescriptionPlaceholder'))}">${escapeHtml(form.description[lang])}</textarea>
          </label>
        </div>
        <p class="editor-hint">${icon('info', 15)} ${escapeHtml(t('teacherEditorLanguage'))}: RU / KZ</p>
      </div>`;
  }

  function editorLangSwitch() {
    return `<div class="lang-switch editor-lang" role="group" aria-label="${escapeHtml(t('teacherEditorLanguage'))}">
      <button type="button" class="lang-btn ${ui.editLang === 'ru' ? 'is-active' : ''}" data-edit-lang="ru" aria-pressed="${ui.editLang === 'ru'}">RU</button>
      <button type="button" class="lang-btn ${ui.editLang === 'kz' ? 'is-active' : ''}" data-edit-lang="kz" aria-pressed="${ui.editLang === 'kz'}">KZ</button>
    </div>`;
  }

  function renderContent() {
    const s = subject();
    if (ui.mode === 'subject-form') return subjectFormPanel();
    if (!s) {
      return `${emptyState({
        iconName: 'book',
        title: t('teacherNoSubjects'),
        text: t('teacherNoSubjectsText'),
        action: `<button class="btn btn-primary" type="button" data-action="add-subject">${icon('plus', 17)} ${escapeHtml(t('teacherAddSubject'))}</button>`,
      })}`;
    }
    if (ui.mode === 'topic' && ui.topicDraft) return topicEditor(s);
    return `
      <div class="teacher-panel-head">
        <div>
          <h2>${escapeHtml(t('teacherContentTitle'))}</h2>
          <p>${escapeHtml(t('teacherContentText'))}</p>
        </div>
        <a class="btn btn-secondary btn-sm" href="#/subject/${encodeURIComponent(s.id)}" target="_blank" rel="noopener">${icon('external-link', 16)} ${escapeHtml(t('teacherPreview'))}</a>
      </div>
      ${subjectChips()}
      <div class="teacher-panel card">
        <div class="panel-head-row">
          <div class="teacher-subject-title">
            <span class="subject-icon">${icon(subjectIcon(s.id), 24)}</span>
            <div>
              <h2>${escapeHtml(pick(s.title))}</h2>
              <p>${escapeHtml(pick(s.tagline))}</p>
            </div>
          </div>
          <div class="panel-head-actions">
            <button class="btn btn-secondary btn-sm" type="button" data-action="edit-subject">${icon('edit', 15)} ${escapeHtml(t('teacherSubjectSettings'))}</button>
            <button class="btn btn-danger-ghost btn-sm" type="button" data-action="delete-subject">${icon('trash', 15)} ${escapeHtml(t('delete'))}</button>
          </div>
        </div>
        ${
          s.topics.length
            ? `<div class="teacher-topic-table">
                ${s.topics
                  .map(
                    (topic, i) => `<div class="teacher-topic-row">
                      <span class="teacher-topic-index">${String(i + 1).padStart(2, '0')}</span>
                      <div class="teacher-topic-main">
                        <strong>${escapeHtml(pick(topic.title))}</strong>
                        <span>${topic.duration} ${escapeHtml(t('minShort'))} · ${topic.practice.length} ${escapeHtml(t('practice'))} · ${topic.quiz.questions.length} ${escapeHtml(t('questions'))}</span>
                      </div>
                      <div class="teacher-topic-actions">
                        <button class="btn btn-secondary btn-sm" type="button" data-action="edit-topic" data-topic-id="${escapeHtml(topic.id)}">${icon('edit', 15)} ${escapeHtml(t('edit'))}</button>
                        <button class="icon-btn icon-btn-danger" type="button" data-action="delete-topic" data-topic-id="${escapeHtml(topic.id)}" aria-label="${escapeHtml(t('teacherDeleteTopic'))}" title="${escapeHtml(t('teacherDeleteTopic'))}">${icon('trash', 16)}</button>
                      </div>
                    </div>`,
                  )
                  .join('')}
              </div>`
            : `<div class="teacher-empty">
                <div class="state-icon">${icon('book', 26)}</div>
                <h3>${escapeHtml(t('teacherNoTopicsTitle'))}</h3>
                <p>${escapeHtml(t('teacherNoTopicsText'))}</p>
              </div>`
        }
        <button class="btn btn-primary" type="button" data-action="add-topic">${icon('plus', 17)} ${escapeHtml(t('teacherAddTopic'))}</button>
      </div>`;
  }

  function questionEditor(q, list, qi) {
    const lang = ui.editLang;
    return `<div class="q-editor">
      <div class="q-editor-head">
        <strong>${escapeHtml(t('teacherQuestionNumber', { number: qi + 1 }))}</strong>
        <button class="icon-btn icon-btn-danger" type="button" data-action="remove-question" data-list="${list}" data-qi="${qi}" aria-label="${escapeHtml(t('teacherRemoveQuestion'))}" title="${escapeHtml(t('teacherRemoveQuestion'))}">${icon('trash', 16)}</button>
      </div>
      <label class="field">
        <span class="field-label">${escapeHtml(t('teacherQuestionText'))} · ${lang.toUpperCase()}</span>
        <textarea class="input textarea" rows="2" maxlength="1200" data-q="text" data-list="${list}" data-qi="${qi}" placeholder="${escapeHtml(t('teacherQuestionPlaceholder'))}">${escapeHtml(q.text[lang] || '')}</textarea>
      </label>
      <div class="field">
        <span class="field-label">${escapeHtml(t('teacherCorrectLabel'))} · ${lang.toUpperCase()}</span>
        <div class="q-options">
          ${q.options
            .map(
              (option, oi) => `<div class="q-option-row">
                <input type="radio" name="correct-${list}-${qi}" value="${oi}" data-correct data-list="${list}" data-qi="${qi}" ${q.correct === oi ? 'checked' : ''} aria-label="${escapeHtml(t('teacherOption', { letter: LETTERS[oi] }))}">
                <span class="q-option-letter">${escapeHtml(LETTERS[oi])}</span>
                <input class="input" type="text" maxlength="400" value="${escapeHtml(option[lang] || '')}" data-q="option" data-list="${list}" data-qi="${qi}" data-oi="${oi}" placeholder="${escapeHtml(t('teacherOption', { letter: LETTERS[oi] }))}">
                ${
                  q.options.length > MIN_OPTIONS
                    ? `<button class="icon-btn" type="button" data-action="remove-option" data-list="${list}" data-qi="${qi}" data-oi="${oi}" aria-label="${escapeHtml(t('teacherRemoveOption'))}" title="${escapeHtml(t('teacherRemoveOption'))}">${icon('close', 16)}</button>`
                    : ''
                }
              </div>`,
            )
            .join('')}
        </div>
        ${
          q.options.length < MAX_OPTIONS
            ? `<button class="btn btn-ghost btn-sm" type="button" data-action="add-option" data-list="${list}" data-qi="${qi}">${icon('plus', 15)} ${escapeHtml(t('teacherAddOption'))}</button>`
            : ''
        }
      </div>
      <label class="field">
        <span class="field-label">${escapeHtml(t('teacherExplanation'))} · ${lang.toUpperCase()}</span>
        <textarea class="input textarea" rows="2" maxlength="2000" data-q="explanation" data-list="${list}" data-qi="${qi}" placeholder="${escapeHtml(t('teacherExplanationPlaceholder'))}">${escapeHtml(q.explanation[lang] || '')}</textarea>
      </label>
    </div>`;
  }

  function questionBlock(list, questions, heading, label) {
    return `<section class="editor-section">
      <div class="editor-section-head">
        <div><h3>${escapeHtml(heading)}</h3><p>${escapeHtml(label)}</p></div>
        <span class="chip chip-muted">${questions.length} ${escapeHtml(t('questions'))}</span>
      </div>
      ${
        questions.length
          ? `<div class="q-list">${questions.map((q, qi) => questionEditor(q, list, qi)).join('')}</div>`
          : `<p class="editor-empty">${escapeHtml(t('teacherEmptyQuestions'))}</p>`
      }
      <button class="btn btn-secondary btn-sm" type="button" data-action="add-question" data-list="${list}">${icon('plus', 16)} ${escapeHtml(t('teacherAddQuestion'))}</button>
    </section>`;
  }

  function topicEditor(s) {
    const topic = ui.topicDraft;
    const lang = ui.editLang;
    return `
      <div class="editor-toolbar">
        <button class="btn btn-ghost btn-sm" type="button" data-action="back-list">${icon('arrow-left', 16)} ${escapeHtml(t('teacherBackToList'))}</button>
        <div class="editor-toolbar-right">
          ${editorLangSwitch()}
          <button class="btn btn-primary btn-sm" type="button" data-action="save-topic" ${ui.saving ? 'disabled' : ''}>${icon('save', 16)} ${escapeHtml(ui.saving ? t('saving') : t('teacherSaveTopic'))}</button>
        </div>
      </div>
      <div class="teacher-panel card">
        <p class="eyebrow">${escapeHtml(pick(s.title))}</p>
        <h2>${escapeHtml(ui.topicIsNew ? t('teacherNewTopic') : t('teacherTopicEditor'))}</h2>
        <div class="editor-grid">
          <label class="field is-full">
            <span class="field-label">${escapeHtml(t('teacherFieldTitle'))} · ${lang.toUpperCase()}</span>
            <input class="input" type="text" maxlength="160" data-field="topicTitle" value="${escapeHtml(topic.title[lang] || '')}" placeholder="${escapeHtml(t('teacherFieldTitle'))}">
          </label>
          <label class="field is-full">
            <span class="field-label">${escapeHtml(t('teacherFieldSummary'))} · ${lang.toUpperCase()}</span>
            <input class="input" type="text" maxlength="500" data-field="topicSummary" value="${escapeHtml(topic.summary[lang] || '')}" placeholder="${escapeHtml(t('teacherSummaryPlaceholder'))}">
          </label>
          <label class="field">
            <span class="field-label">${escapeHtml(t('teacherFieldDuration'))}</span>
            <input class="input" type="number" min="1" max="180" data-field="topicDuration" value="${Number(topic.duration) || 12}">
          </label>
          <label class="field is-full">
            <span class="field-label">${escapeHtml(t('teacherFieldLesson'))} · ${lang.toUpperCase()}</span>
            <textarea class="input textarea lesson-input" rows="14" maxlength="30000" data-field="topicLesson" placeholder="${escapeHtml(t('teacherLessonPlaceholder'))}">${escapeHtml(topic.lesson[lang] || '')}</textarea>
            <span class="field-hint">## ${escapeHtml(t('teacherFieldTitle'))} · **bold** · - list · > tip</span>
          </label>
        </div>
      </div>

      <div class="teacher-panel card">
        ${questionBlock('practice', topic.practice, t('teacherPracticeTitle'), t('teacherPracticeText'))}
      </div>

      <div class="teacher-panel card">
        <div class="editor-section-head">
          <div><h3>${escapeHtml(t('teacherQuizTitle'))}</h3><p>${escapeHtml(t('teacherQuizText'))}</p></div>
        </div>
        <div class="editor-grid">
          <label class="field">
            <span class="field-label">${escapeHtml(t('teacherFieldQuizTitle'))} · ${lang.toUpperCase()}</span>
            <input class="input" type="text" maxlength="160" data-field="quizTitle" value="${escapeHtml(topic.quiz.title[lang] || '')}">
          </label>
          <label class="field">
            <span class="field-label">${escapeHtml(t('teacherFieldPassScore'))}</span>
            <input class="input" type="number" min="0" max="100" data-field="passScore" value="${Number(topic.quiz.passScore) || 70}">
          </label>
        </div>
        <div class="q-list-wrap">
          ${questionBlock('quiz', topic.quiz.questions, t('teacherQuizTitle'), t('teacherQuizText'))}
        </div>
      </div>

      <div class="editor-footer">
        <button class="btn btn-ghost" type="button" data-action="back-list">${escapeHtml(t('cancel'))}</button>
        <button class="btn btn-primary btn-lg" type="button" data-action="save-topic" ${ui.saving ? 'disabled' : ''}>${icon('save', 18)} ${escapeHtml(ui.saving ? t('saving') : t('teacherSaveTopic'))}</button>
      </div>`;
  }

  function renderExam() {
    const s = subject();
    if (!s) {
      return emptyState({ iconName: 'book', title: t('teacherNoSubjects'), text: t('teacherNoSubjectsText') });
    }
    if (!ui.examDraft || ui.examSubjectId !== s.id) {
      ui.examDraft = clone(s.exam);
      ui.examSubjectId = s.id;
    }
    const exam = ui.examDraft;
    const lang = ui.editLang;
    return `
      <div class="teacher-panel-head">
        <div>
          <h2>${escapeHtml(t('teacherExamTitle'))}</h2>
          <p>${escapeHtml(t('teacherExamText'))}</p>
        </div>
        <div class="editor-toolbar-right">
          ${editorLangSwitch()}
          <button class="btn btn-primary btn-sm" type="button" data-action="save-exam" ${ui.saving ? 'disabled' : ''}>${icon('save', 16)} ${escapeHtml(ui.saving ? t('saving') : t('teacherSaveExam'))}</button>
        </div>
      </div>
      ${subjectChips()}
      <div class="teacher-panel card">
        <div class="editor-grid">
          <label class="field is-full">
            <span class="field-label">${escapeHtml(t('teacherExamTitle'))} · ${lang.toUpperCase()}</span>
            <input class="input" type="text" maxlength="160" data-field="examTitle" value="${escapeHtml(exam.title[lang] || '')}">
          </label>
          <label class="field is-full">
            <span class="field-label">${escapeHtml(t('teacherExamDescription'))} · ${lang.toUpperCase()}</span>
            <textarea class="input textarea" rows="2" maxlength="1200" data-field="examDescription">${escapeHtml(exam.description[lang] || '')}</textarea>
          </label>
          <label class="field">
            <span class="field-label">${escapeHtml(t('teacherExamDuration'))}</span>
            <input class="input" type="number" min="1" max="240" data-field="examDuration" value="${Number(exam.durationMin) || 30}">
          </label>
        </div>
        ${questionBlock('exam', exam.questions, t('teacherStatQuestions'), t('teacherExamText'))}
      </div>`;
  }

  function renderTransfer() {
    return `
      <div class="teacher-panel-head">
        <div>
          <h2>${escapeHtml(t('teacherTransferTitle'))}</h2>
          <p>${escapeHtml(t('teacherTransferText'))}</p>
        </div>
      </div>
      <div class="transfer-grid">
        <div class="teacher-panel card">
          <div class="teacher-note-icon">${icon('download', 22)}</div>
          <h3>${escapeHtml(t('teacherExportTitle'))}</h3>
          <p>${escapeHtml(t('teacherExportText'))}</p>
          <a class="btn btn-secondary" href="/api/teacher/export" download="ent-school8-content.json">${icon('download', 17)} ${escapeHtml(t('teacherExportButton'))}</a>
        </div>
        <div class="teacher-panel card">
          <div class="teacher-note-icon">${icon('upload', 22)}</div>
          <h3>${escapeHtml(t('teacherImportTitle'))}</h3>
          <p>${escapeHtml(t('teacherImportText'))}</p>
          <label class="field">
            <span class="field-label">${escapeHtml(t('teacherImportFile'))}</span>
            <input class="input" type="file" accept="application/json,.json" data-import-file>
          </label>
          <p class="editor-hint">${icon('alert', 15)} ${escapeHtml(t('teacherImportConfirm'))}</p>
        </div>
      </div>
      <div class="teacher-note card">
        <div class="teacher-note-icon">${icon('info', 20)}</div>
        <div>
          <h3>${escapeHtml(t('teacherStorageTitle'))}</h3>
          <p>${escapeHtml(t('teacherStorageText'))}</p>
        </div>
      </div>`;
  }

  /* -------------------------- input synchronization ------------------------ */

  function questionsOf(list) {
    if (list === 'exam') return ui.examDraft?.questions || null;
    if (!ui.topicDraft) return null;
    return list === 'practice' ? ui.topicDraft.practice : ui.topicDraft.quiz.questions;
  }

  function onInput(event) {
    const el = event.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    const lang = ui.editLang;
    if (el.dataset.q) {
      const list = el.dataset.list;
      const qi = Number(el.dataset.qi);
      const questions = questionsOf(list);
      if (!questions || !questions[qi]) return;
      const q = questions[qi];
      if (el.dataset.q === 'option') {
        const oi = Number(el.dataset.oi);
        if (q.options[oi]) q.options[oi][lang] = el.value;
      } else if (el.dataset.q === 'text') {
        q.text[lang] = el.value;
      } else if (el.dataset.q === 'explanation') {
        q.explanation[lang] = el.value;
      }
      return;
    }
    const field = el.dataset.field;
    if (!field) return;
    if (ui.mode === 'subject-form' && ui.subjectForm) {
      if (field === 'subjectTitle') ui.subjectForm.title[lang] = el.value;
      if (field === 'subjectTagline') ui.subjectForm.tagline[lang] = el.value;
      if (field === 'subjectDescription') ui.subjectForm.description[lang] = el.value;
      return;
    }
    if (ui.tab === 'exam' && ui.examDraft) {
      if (field === 'examTitle') ui.examDraft.title[lang] = el.value;
      if (field === 'examDescription') ui.examDraft.description[lang] = el.value;
      if (field === 'examDuration') ui.examDraft.durationMin = Number(el.value);
      return;
    }
    if (!ui.topicDraft) return;
    if (field === 'topicTitle') ui.topicDraft.title[lang] = el.value;
    if (field === 'topicSummary') ui.topicDraft.summary[lang] = el.value;
    if (field === 'topicLesson') ui.topicDraft.lesson[lang] = el.value;
    if (field === 'topicDuration') ui.topicDraft.duration = Number(el.value);
    if (field === 'quizTitle') ui.topicDraft.quiz.title[lang] = el.value;
    if (field === 'passScore') ui.topicDraft.quiz.passScore = Number(el.value);
  }

  function onChange(event) {
    const el = event.target;
    if (el.matches('input[data-correct]')) {
      const questions = questionsOf(el.dataset.list);
      const qi = Number(el.dataset.qi);
      if (questions && questions[qi]) questions[qi].correct = Number(el.value);
    }
  }

  /* --------------------------------- helpers ------------------------------ */

  async function reload({ mode = 'list', subjectId = ui.subjectId } = {}) {
    const data = await api.teacherContent();
    subjects = data.subjects;
    state.content = null;
    ui.saving = false;
    ui.subjectId = subjectId && subjects.some((s) => s.id === subjectId) ? subjectId : subjects[0]?.id || null;
    ui.topicDraft = null;
    ui.subjectForm = null;
    ui.error = '';
    ui.mode = mode;
    ui.examDraft = null;
    ui.examSubjectId = null;
    render();
  }

  function setError(message) {
    ui.error = message;
    ui.saving = false;
    render();
    toast(message, 'error', 6000);
  }

  function validateDraftQuestions() {
    if (!ui.topicDraft) return false;
    return topicValid(ui.topicDraft);
  }

  function addQuestion(list) {
    const questions = questionsOf(list);
    if (!questions) return;
    questions.push(blankQuestion());
    renderKeepScroll();
  }

  function renderKeepScroll() {
    const y = window.scrollY;
    render();
    window.scrollTo({ top: y });
  }

  async function handleAction(action, btn) {
    const subjectId = btn.dataset.subjectId;
    if (action === 'open-content') {
      ui.tab = 'content';
      ui.subjectId = subjectId;
      ui.mode = 'list';
      ui.topicDraft = null;
      ui.error = '';
      render();
      return;
    }
    if (action === 'add-subject') {
      ui.tab = 'content';
      ui.mode = 'subject-form';
      ui.subjectForm = blankSubjectForm();
      ui.error = '';
      render();
      return;
    }
    if (action === 'close-subject-form' || action === 'back-list') {
      ui.mode = 'list';
      ui.topicDraft = null;
      ui.subjectForm = null;
      ui.error = '';
      render();
      return;
    }
    if (action === 'edit-subject') {
      const s = subject();
      if (!s) return;
      ui.mode = 'subject-form';
      ui.subjectForm = {
        id: s.id,
        title: clone(s.title),
        tagline: clone(s.tagline),
        description: clone(s.description),
      };
      render();
      return;
    }
    if (action === 'add-topic') {
      ui.mode = 'topic';
      ui.topicDraft = blankTopic();
      ui.topicIsNew = true;
      ui.error = '';
      render();
      return;
    }
    if (action === 'edit-topic') {
      const s = subject();
      const topic = s?.topics.find((tp) => tp.id === btn.dataset.topicId);
      if (!topic) return;
      ui.mode = 'topic';
      ui.topicDraft = clone(topic);
      ui.topicIsNew = false;
      ui.error = '';
      render();
      return;
    }
    if (action === 'delete-topic') {
      const topic = subject()?.topics.find((tp) => tp.id === btn.dataset.topicId);
      if (!topic) return;
      const ok = await confirmDialog({
        title: t('teacherDeleteTopic'),
        text: t('teacherDeleteTopicConfirm', { name: pick(topic.title) }),
        confirmLabel: t('delete'),
        danger: true,
      });
      if (!ok) return;
      try {
        await api.teacherDeleteTopic(topic.id);
        toast(t('teacherTopicDeleted'), 'success');
        await reload();
      } catch (err) {
        setError(err.message || t('teacherSaveError'));
      }
      return;
    }
    if (action === 'delete-subject') {
      const s = subject();
      if (!s) return;
      const ok = await confirmDialog({
        title: t('teacherDeleteSubject'),
        text: t('teacherDeleteSubjectConfirm', { name: pick(s.title) }),
        confirmLabel: t('delete'),
        danger: true,
      });
      if (!ok) return;
      try {
        await api.teacherDeleteSubject(s.id);
        toast(t('teacherSubjectDeleted'), 'success');
        await reload({ subjectId: null });
      } catch (err) {
        setError(err.message || t('teacherSaveError'));
      }
      return;
    }
    if (action === 'save-subject') {
      if (!ui.subjectForm) return;
      const form = ui.subjectForm;
      if (missingLocalized(form.title) || missingLocalized(form.tagline) || missingLocalized(form.description)) {
        setError(t('teacherValidationText'));
        return;
      }
      ui.saving = true;
      render();
      try {
        if (form.id) {
          await api.teacherUpdateSubject(form.id, {
            title: form.title,
            tagline: form.tagline,
            description: form.description,
          });
          toast(t('teacherSubjectSaved'), 'success');
          await reload({ subjectId: form.id });
        } else {
          const result = await api.teacherCreateSubject({
            title: form.title,
            tagline: form.tagline,
            description: form.description,
          });
          toast(t('teacherSubjectCreated'), 'success');
          await reload({ subjectId: result.subject.id });
        }
      } catch (err) {
        setError(err.message || t('teacherSaveError'));
      }
      return;
    }
    if (action === 'add-question') {
      addQuestion(btn.dataset.list);
      return;
    }
    if (action === 'remove-question') {
      const questions = questionsOf(btn.dataset.list);
      const qi = Number(btn.dataset.qi);
      if (!questions?.[qi]) return;
      const ok = await confirmDialog({
        title: t('teacherRemoveQuestion'),
        text: t('teacherDeleteQuestionConfirm'),
        confirmLabel: t('delete'),
        danger: true,
      });
      if (!ok) return;
      questions.splice(qi, 1);
      renderKeepScroll();
      return;
    }
    if (action === 'add-option') {
      const questions = questionsOf(btn.dataset.list);
      const q = questions?.[Number(btn.dataset.qi)];
      if (!q || q.options.length >= MAX_OPTIONS) return;
      q.options.push({ ru: '', kz: '' });
      renderKeepScroll();
      return;
    }
    if (action === 'remove-option') {
      const questions = questionsOf(btn.dataset.list);
      const q = questions?.[Number(btn.dataset.qi)];
      const oi = Number(btn.dataset.oi);
      if (!q || q.options.length <= MIN_OPTIONS || oi < 0 || oi >= q.options.length) return;
      q.options.splice(oi, 1);
      if (q.correct >= q.options.length) q.correct = q.options.length - 1;
      else if (q.correct > oi) q.correct -= 1;
      renderKeepScroll();
      return;
    }
    if (action === 'save-topic') {
      if (!ui.topicDraft) return;
      ui.topicDraft.duration = Number(ui.topicDraft.duration) || 12;
      ui.topicDraft.quiz.passScore = Number(ui.topicDraft.quiz.passScore) || 0;
      if (!validateDraftQuestions()) {
        setError(t('teacherValidationText'));
        return;
      }
      ui.saving = true;
      render();
      try {
        if (ui.topicIsNew) {
          await api.teacherCreateTopic(ui.subjectId, ui.topicDraft);
          toast(t('teacherTopicCreated'), 'success');
        } else {
          await api.teacherUpdateTopic(ui.topicDraft.id, ui.topicDraft);
          toast(t('teacherTopicSaved'), 'success');
        }
        await reload({ mode: 'list' });
      } catch (err) {
        setError(err.message || t('teacherSaveError'));
      }
      return;
    }
    if (action === 'save-exam') {
      if (!ui.examDraft) return;
      ui.examDraft.durationMin = Number(ui.examDraft.durationMin) || 30;
      if (!examValid(ui.examDraft)) {
        setError(t('teacherValidationText'));
        return;
      }
      ui.saving = true;
      render();
      try {
        const saved = await api.teacherUpdateExam(ui.examSubjectId, ui.examDraft);
        const target = subjects.find((s) => s.id === ui.examSubjectId);
        if (target) target.exam = saved.exam;
        state.content = null;
        toast(t('teacherExamSaved'), 'success');
        ui.examDraft = null;
        ui.saving = false;
        render();
      } catch (err) {
        setError(err.message || t('teacherSaveError'));
      }
      return;
    }
  }

  node.addEventListener('click', (event) => {
    const langBtn = event.target.closest('[data-edit-lang]');
    if (langBtn) {
      ui.editLang = langBtn.dataset.editLang;
      const y = window.scrollY;
      render();
      window.scrollTo({ top: y });
      return;
    }
    const tabBtn = event.target.closest('[data-tab]');
    if (tabBtn) {
      ui.tab = tabBtn.dataset.tab;
      ui.mode = 'list';
      ui.topicDraft = null;
      ui.subjectForm = null;
      ui.examDraft = null;
      ui.examSubjectId = null;
      ui.error = '';
      render();
      return;
    }
    const subjectBtn = event.target.closest('.teacher-chip[data-subject-id]');
    if (subjectBtn) {
      ui.subjectId = subjectBtn.dataset.subjectId;
      ui.mode = 'list';
      ui.topicDraft = null;
      ui.subjectForm = null;
      ui.examDraft = null;
      ui.examSubjectId = null;
      ui.error = '';
      render();
      return;
    }
    const actionBtn = event.target.closest('[data-action]');
    if (actionBtn && actionBtn.dataset.action) {
      handleAction(actionBtn.dataset.action, actionBtn).catch((err) => {
        console.error(err);
        setError(err.message || t('teacherSaveError'));
      });
    }
  });

  main.addEventListener('input', onInput);
  main.addEventListener('change', async (event) => {
    onChange(event);
    const input = event.target;
    if (input.matches('[data-import-file]')) {
      const file = input.files?.[0];
      if (!file) return;
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        setError(t('teacherImportError'));
        input.value = '';
        return;
      }
      const ok = await confirmDialog({
        title: t('teacherImportTitle'),
        text: t('teacherImportConfirm'),
        confirmLabel: t('teacherImportButton'),
        danger: true,
      });
      if (!ok) {
        input.value = '';
        return;
      }
      ui.saving = true;
      try {
        await api.teacherImport(parsed);
        toast(t('teacherImportSuccess'), 'success');
        await reload({ mode: 'list' });
      } catch (err) {
        setError(err.message || t('teacherImportError'));
      } finally {
        input.value = '';
      }
    }
  });

  render();
  return node;
}
