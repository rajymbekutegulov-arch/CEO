/**
 * Content model helpers: lookup, normalization and validation.
 * All teacher input goes through the normalize* functions before it is stored.
 */

export class HttpError extends Error {
  constructor(status, message, code = 'error', field = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

const LIMITS = {
  title: 160,
  tagline: 200,
  description: 1200,
  summary: 500,
  lesson: 30000,
  question: 1200,
  option: 400,
  explanation: 2000,
  quizTitle: 160,
};

export function localize(value, field, { max = 4000, required = true } = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const ru = typeof raw.ru === 'string' ? raw.ru.trim() : '';
  const kz = typeof raw.kz === 'string' ? raw.kz.trim() : '';
  if (required && (!ru || !kz)) {
    throw new HttpError(400, `Заполните поле «${field}» на русском и казахском языках.`, 'invalid_input', field);
  }
  if (ru.length > max || kz.length > max) {
    throw new HttpError(400, `Поле «${field}» слишком длинное.`, 'invalid_input', field);
  }
  return { ru, kz };
}

function intInRange(value, min, max, fallback, field) {
  if (value === '' || value === null || value === undefined) return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new HttpError(400, `Поле «${field}» должно быть числом от ${min} до ${max}.`, 'invalid_input', field);
  }
  return Math.round(num);
}

function str(value, field, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, `Заполните поле «${field}».`, 'invalid_input', field);
  if (text.length > max) throw new HttpError(400, `Поле «${field}» слишком длинное.`, 'invalid_input', field);
  return text;
}

export function normalizeQuestion(raw, { idPrefix = 'q', index = 0 } = {}) {
  if (!raw || typeof raw !== 'object') {
    throw new HttpError(400, 'Некорректный вопрос.', 'invalid_input');
  }
  const text = localize(raw.text, 'текст вопроса', { max: LIMITS.question });
  const explanation = localize(raw.explanation, 'пояснение к ответу', { max: LIMITS.explanation });
  const optionsRaw = Array.isArray(raw.options) ? raw.options : [];
  if (optionsRaw.length < 2 || optionsRaw.length > 6) {
    throw new HttpError(400, 'У вопроса должно быть от 2 до 6 вариантов ответа.', 'invalid_input');
  }
  const options = optionsRaw.map((opt, i) => localize(opt, `вариант ответа ${i + 1}`, { max: LIMITS.option }));
  const correct = Number(raw.correct);
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    throw new HttpError(400, 'Укажите правильный вариант ответа.', 'invalid_input');
  }
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 80) : `${idPrefix}-${index + 1}`;
  return { id, text, options, correct, explanation };
}

export function normalizeQuestions(list, prefix, { max = 60 } = {}) {
  const arr = Array.isArray(list) ? list : [];
  if (arr.length > max) throw new HttpError(400, `Слишком много вопросов (максимум ${max}).`, 'invalid_input');
  const out = arr.map((q, i) => normalizeQuestion(q, { idPrefix: prefix, index: i }));
  const seen = new Set();
  for (const q of out) {
    if (seen.has(q.id)) q.id = `${q.id}-${Math.random().toString(36).slice(2, 6)}`;
    seen.add(q.id);
  }
  return out;
}

export function normalizeTopic(raw, { subjectId, index = 0, existingId } = {}) {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Некорректная тема.', 'invalid_input');
  const title = localize(raw.title, 'название темы', { max: LIMITS.title });
  const summary = localize(raw.summary, 'краткое описание темы', { max: LIMITS.summary });
  const lesson = localize(raw.lesson, 'объяснение темы', { max: LIMITS.lesson });
  const duration = intInRange(raw.duration, 1, 180, 12, 'время изучения');
  const id = existingId || (typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 80) : `${subjectId}-t${index + 1}`);
  const quizRaw = raw.quiz && typeof raw.quiz === 'object' ? raw.quiz : {};
  const quiz = {
    title: localize(quizRaw.title || { ru: 'Тематический тест', kz: 'Тақырыптық тест' }, 'название теста', { max: LIMITS.quizTitle }),
    passScore: intInRange(quizRaw.passScore, 0, 100, 70, 'проходной балл'),
    questions: normalizeQuestions(quizRaw.questions, `${id}-q`),
  };
  const practice = normalizeQuestions(raw.practice, `${id}-p`);
  return { id, order: index + 1, title, summary, duration, lesson, practice, quiz };
}

export function normalizeExam(raw, subjectId) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    title: localize(src.title || { ru: 'Пробный вариант ЕНТ', kz: 'ҰБТ сынақ нұсқасы' }, 'название пробного теста', {
      max: LIMITS.title,
    }),
    description: localize(
      src.description || {
        ru: 'Проверьте себя на заданиях из всех тем предмета.',
        kz: 'Пәннің барлық тақырыптарынан тапсырмалар орындап, өзіңізді тексеріңіз.',
      },
      'описание пробного теста',
      { max: LIMITS.description },
    ),
    durationMin: intInRange(src.durationMin, 1, 240, 30, 'длительность теста'),
    questions: normalizeQuestions(src.questions, `${subjectId}-ex`),
  };
}

export function normalizeSubject(raw, { index = 0 } = {}) {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Некорректный предмет.', 'invalid_input');
  const title = localize(raw.title, 'название предмета', { max: LIMITS.title });
  const tagline = localize(raw.tagline, 'подзаголовок предмета', { max: LIMITS.tagline });
  const description = localize(raw.description, 'описание предмета', { max: LIMITS.description });
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 60) : '';
  const id = typeof raw.id === 'string' && raw.id.trim()
    ? raw.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60)
    : `subject-${index + 1}`;
  if (!id) throw new HttpError(400, 'Некорректный идентификатор предмета.', 'invalid_input');
  const topicsRaw = Array.isArray(raw.topics) ? raw.topics : [];
  if (topicsRaw.length > 40) throw new HttpError(400, 'Слишком много тем (максимум 40).', 'invalid_input');
  const topics = topicsRaw.map((t, i) => normalizeTopic(t, { subjectId: id, index: i }));
  return {
    id,
    name: name || id,
    order: index + 1,
    title,
    tagline,
    description,
    topics,
    exam: normalizeExam(raw.exam, id),
  };
}

export function normalizeContent(raw) {
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.subjects) ? raw.subjects : null;
  if (!list || list.length === 0) {
    throw new HttpError(400, 'Файл не содержит предметов.', 'invalid_input');
  }
  if (list.length > 12) throw new HttpError(400, 'Слишком много предметов (максимум 12).', 'invalid_input');
  const subjects = list.map((s, i) => normalizeSubject(s, { index: i }));
  const ids = new Set();
  for (const s of subjects) {
    if (ids.has(s.id)) s.id = `${s.id}-${Math.random().toString(36).slice(2, 6)}`;
    ids.add(s.id);
  }
  return subjects;
}

/* ------------------------------- lookups -------------------------------- */

export function sortByOrder(list) {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function findSubject(subjects, subjectId) {
  return subjects.find((s) => s.id === subjectId) || null;
}

export function findTopic(subjects, topicId) {
  for (const subject of subjects) {
    const topic = subject.topics.find((t) => t.id === topicId);
    if (topic) return { subject, topic };
  }
  return null;
}

/* ------------------------------- views ---------------------------------- */

export function publicQuestion(question) {
  return {
    id: question.id,
    text: question.text,
    options: question.options,
  };
}

export function publicExamQuestions(exam) {
  return exam.questions.map(publicQuestion);
}

/** Content available to students: no correct answers, no explanations. */
export function publicContent(subjects) {
  return sortByOrder(subjects).map((subject, idx) => ({
    id: subject.id,
    name: subject.name || subject.id,
    order: idx + 1,
    title: subject.title,
    tagline: subject.tagline,
    description: subject.description,
    topicCount: subject.topics.length,
    topics: sortByOrder(subject.topics).map((topic, i) => ({
      id: topic.id,
      order: i + 1,
      title: topic.title,
      summary: topic.summary,
      duration: topic.duration,
      practiceCount: topic.practice.length,
      quiz: {
        title: topic.quiz.title,
        passScore: topic.quiz.passScore,
        questionCount: topic.quiz.questions.length,
      },
    })),
    exam: {
      title: subject.exam.title,
      description: subject.exam.description,
      durationMin: subject.exam.durationMin,
      questionCount: subject.exam.questions.length,
    },
  }));
}

/** Full content for the teacher panel (includes answers and explanations). */
export function teacherContent(subjects) {
  return structuredClone(sortByOrder(subjects));
}

export function getQuestionSet(subjects, { type, subjectId, topicId }) {
  let subject = findSubject(subjects, subjectId);
  if (!subject && type !== 'exam' && topicId) {
    subject = findTopic(subjects, topicId)?.subject || null;
  }
  if (!subject) throw new HttpError(404, 'Предмет не найден.', 'not_found');
  if (type === 'exam') {
    return { type, subject, topic: null, questions: subject.exam.questions, meta: subject.exam };
  }
  const topic = subject.topics.find((t) => t.id === topicId);
  if (!topic) throw new HttpError(404, 'Тема не найдена.', 'not_found');
  if (type === 'quiz') {
    return { type, subject, topic, questions: topic.quiz.questions, meta: topic.quiz };
  }
  if (type === 'practice') {
    return { type, subject, topic, questions: topic.practice, meta: null };
  }
  throw new HttpError(400, 'Неизвестный тип теста.', 'invalid_input');
}

/** Normalize an answers payload into a Map<questionId, choiceIndex>. */
export function normalizeAnswers(raw) {
  const map = new Map();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const idx = Number(item.choice);
      if (Number.isInteger(idx) && idx >= 0) map.set(String(item.questionId), idx);
    }
  } else if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      const idx = Number(value);
      if (Number.isInteger(idx) && idx >= 0) map.set(String(key), idx);
    }
  }
  return map;
}
