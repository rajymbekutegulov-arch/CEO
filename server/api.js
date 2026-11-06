import {
  getDb,
  saveDb,
  publicUser,
  createSession,
  destroySession,
  getSessionUser,
} from './db.js';
import { hashPassword, verifyPassword, newId, slugify } from './auth.js';
import {
  HttpError,
  publicContent,
  teacherContent,
  findSubject,
  findTopic,
  sortByOrder,
  getQuestionSet,
  publicQuestion,
  publicExamQuestions,
  normalizeExam,
  normalizeQuestion,
  normalizeTopic,
  normalizeContent,
  normalizeAnswers,
  localize,
} from './content.js';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const MAX_BODY = 1024 * 1024;

/* ----------------------------- small helpers ---------------------------- */

function json(res, status, data, headers = {}) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function sessionCookie(token) {
  return `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
}

function clearCookie() {
  return 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Слишком большой запрос.', 'payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new HttpError(400, 'Некорректный JSON в запросе.', 'invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function requireUser(ctx) {
  if (!ctx.user) throw new HttpError(401, 'Нужно войти в аккаунт.', 'unauthorized');
  return ctx.user;
}

function requireTeacher(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'teacher') throw new HttpError(403, 'Доступ разрешён только учителю.', 'forbidden');
  return user;
}

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) {
    throw new HttpError(400, 'Укажите корректный адрес электронной почты.', 'invalid_email', 'email');
  }
  return email;
}

function normalizeName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 60) {
    throw new HttpError(400, 'Имя должно содержать от 2 до 60 символов.', 'invalid_name', 'name');
  }
  return name;
}

function normalizePassword(value) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 6 || password.length > 100) {
    throw new HttpError(400, 'Пароль должен содержать от 6 до 100 символов.', 'invalid_password', 'password');
  }
  return password;
}

function normalizeLanguage(value, fallback = 'ru') {
  return value === 'kz' || value === 'ru' ? value : fallback;
}

/* ------------------------------ rate limit ------------------------------ */

const loginLog = new Map();

function checkLoginRate(ip) {
  const now = Date.now();
  const recent = (loginLog.get(ip) || []).filter((t) => now - t < 5 * 60 * 1000);
  if (recent.length >= 12) {
    throw new HttpError(429, 'Слишком много попыток входа. Попробуйте через 5 минут.', 'rate_limited');
  }
  recent.push(now);
  loginLog.set(ip, recent);
}

/* ------------------------------- progress ------------------------------- */

function findSubjectById(content, id) {
  return content.find((s) => s.id === id) || null;
}

function computeProgress(user) {
  const db = getDb();
  const content = sortByOrder(db.content);
  const userAttempts = db.attempts
    .filter((a) => a.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const userCompletions = db.completions.filter((c) => c.userId === user.id);

  const subjects = content.map((subject) => {
    const topics = sortByOrder(subject.topics).map((topic) => {
      const quizAttempts = userAttempts.filter((a) => a.type === 'quiz' && a.topicId === topic.id);
      const best = quizAttempts.length ? Math.max(...quizAttempts.map((a) => a.percent)) : null;
      const completed = userCompletions.some((c) => c.topicId === topic.id);
      return {
        id: topic.id,
        title: topic.title,
        order: topic.order,
        completed,
        bestPercent: best,
        quizAttempts: quizAttempts.length,
        passScore: topic.quiz.passScore,
      };
    });
    const completedCount = topics.filter((t) => t.completed).length;
    const examAttempts = userAttempts.filter((a) => a.type === 'exam' && a.subjectId === subject.id);
    const examBest = examAttempts.length ? Math.max(...examAttempts.map((a) => a.percent)) : null;
    const lastQuiz = userAttempts.find((a) => a.subjectId === subject.id && a.type === 'quiz');
    return {
      id: subject.id,
      title: subject.title,
      topics,
      topicsTotal: topics.length,
      topicsCompleted: completedCount,
      percent: topics.length ? Math.round((completedCount / topics.length) * 100) : 0,
      examBest,
      examAttempts: examAttempts.length,
      lastActivity: lastQuiz ? lastQuiz.createdAt : null,
    };
  });

  const totalTopics = subjects.reduce((n, s) => n + s.topicsTotal, 0);
  const completedTopics = subjects.reduce((n, s) => n + s.topicsCompleted, 0);
  const quizScores = userAttempts.filter((a) => a.type === 'quiz').map((a) => a.percent);
  const recentAttempts = userAttempts.slice(0, 10).map((a) => ({
    id: a.id,
    type: a.type,
    subjectId: a.subjectId,
    topicId: a.topicId,
    subjectTitle: findSubjectById(content, a.subjectId)?.title || a.subjectTitle || null,
    topicTitle: a.topicId ? findTopic(content, a.topicId)?.topic.title || a.topicTitle || null : null,
    score: a.score,
    total: a.total,
    percent: a.percent,
    passed: a.passed,
    createdAt: a.createdAt,
  }));

  const lastViewed = db.lastViewed[user.id] || null;
  let resume = null;
  if (lastViewed) {
    const subject = findSubjectById(content, lastViewed.subjectId);
    const topic = subject?.topics.find((t) => t.id === lastViewed.topicId);
    if (subject && topic) {
      resume = {
        subjectId: subject.id,
        subjectTitle: subject.title,
        topicId: topic.id,
        topicTitle: topic.title,
        updatedAt: lastViewed.updatedAt,
      };
    }
  }

  const reviewTopics = [];
  for (const subject of subjects) {
    for (const topic of subject.topics) {
      if (topic.bestPercent !== null && topic.bestPercent < topic.passScore) {
        reviewTopics.push({
          subjectId: subject.id,
          subjectTitle: subject.title,
          topicId: topic.id,
          topicTitle: topic.title,
          bestPercent: topic.bestPercent,
          passScore: topic.passScore,
        });
      }
    }
  }

  return {
    subjects,
    resume,
    reviewTopics,
    totals: {
      topicsTotal: totalTopics,
      topicsCompleted: completedTopics,
      percent: totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0,
      attempts: userAttempts.length,
      quizzes: userAttempts.filter((a) => a.type === 'quiz').length,
      exams: userAttempts.filter((a) => a.type === 'exam').length,
      averageQuiz: quizScores.length
        ? Math.round(quizScores.reduce((s, v) => s + v, 0) / quizScores.length)
        : null,
    },
    recentAttempts,
  };
}

/* --------------------------- attempt handling --------------------------- */

function gradeAttempt({ set, answers, user }) {
  const total = set.questions.length;
  if (!total) throw new HttpError(400, 'В этом тесте пока нет вопросов.', 'empty_test');
  const items = set.questions.map((question) => {
    const chosen = answers.has(question.id) ? answers.get(question.id) : null;
    const isCorrect = chosen === question.correct;
    return {
      questionId: question.id,
      text: question.text,
      options: question.options,
      chosen,
      correct: question.correct,
      isCorrect,
      explanation: question.explanation,
    };
  });
  const score = items.filter((i) => i.isCorrect).length;
  const percent = Math.round((score / total) * 100);
  const passed = set.type === 'quiz' ? percent >= (set.meta?.passScore ?? 70) : null;
  const now = new Date().toISOString();
  const attempt = {
    id: newId('a'),
    userId: user.id,
    type: set.type,
    subjectId: set.subject.id,
    topicId: set.topic ? set.topic.id : null,
    subjectTitle: set.subject.title,
    topicTitle: set.topic ? set.topic.title : set.subject.exam.title,
    score,
    total,
    percent,
    passed,
    answers: Object.fromEntries(answers),
    createdAt: now,
  };
  return { attempt, items };
}

function attemptReview(attempt) {
  const db = getDb();
  let set;
  try {
    set = getQuestionSet(db.content, attempt);
  } catch {
    return { items: [], unavailable: true };
  }
  const answers = normalizeAnswers(attempt.answers || {});
  const items = set.questions.map((question) => {
    const chosen = answers.has(question.id) ? answers.get(question.id) : null;
    return {
      questionId: question.id,
      text: question.text,
      options: question.options,
      chosen,
      correct: question.correct,
      isCorrect: chosen === question.correct,
      explanation: question.explanation,
    };
  });
  return { items, unavailable: false };
}

/* ------------------------------- routers -------------------------------- */

const routes = [];

function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

/* health */
route('GET', /^\/api\/health$/, () => ({
  data: { ok: true, service: 'ent-school8', time: new Date().toISOString() },
}));

/* auth */
route('POST', /^\/api\/auth\/register$/, async (ctx) => {
  const db = getDb();
  const name = normalizeName(ctx.body?.name);
  const email = normalizeEmail(ctx.body?.email);
  const password = normalizePassword(ctx.body?.password);
  const language = normalizeLanguage(ctx.body?.language);
  if (db.users.some((u) => u.email === email)) {
    throw new HttpError(409, 'Аккаунт с такой почтой уже существует.', 'email_taken', 'email');
  }
  const user = {
    id: newId('u'),
    name,
    email,
    role: 'student',
    language,
    password: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  saveDb();
  const token = createSession(user.id);
  return { status: 201, data: { user: publicUser(user) }, headers: { 'Set-Cookie': sessionCookie(token) } };
});

route('POST', /^\/api\/auth\/login$/, async (ctx) => {
  const email = normalizeEmail(ctx.body?.email);
  const password = typeof ctx.body?.password === 'string' ? ctx.body.password : '';
  checkLoginRate(ctx.ip);
  const db = getDb();
  const user = db.users.find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.password)) {
    throw new HttpError(401, 'Неверная почта или пароль.', 'invalid_credentials');
  }
  loginLog.delete(ctx.ip);
  const token = createSession(user.id);
  return { data: { user: publicUser(user) }, headers: { 'Set-Cookie': sessionCookie(token) } };
});

route('POST', /^\/api\/auth\/logout$/, (ctx) => {
  if (ctx.cookies.sid) destroySession(ctx.cookies.sid);
  return { data: { ok: true }, headers: { 'Set-Cookie': clearCookie() } };
});

route('GET', /^\/api\/auth\/me$/, (ctx) => ({
  data: { user: publicUser(ctx.user) },
}));

route('PATCH', /^\/api\/me$/, async (ctx) => {
  const user = requireUser(ctx);
  const db = getDb();
  const record = db.users.find((u) => u.id === user.id);
  if (!record) throw new HttpError(404, 'Пользователь не найден.', 'not_found');
  if (ctx.body?.name !== undefined) record.name = normalizeName(ctx.body.name);
  if (ctx.body?.language !== undefined) record.language = normalizeLanguage(ctx.body.language, record.language);
  saveDb();
  return { data: { user: publicUser(record) } };
});

route('POST', /^\/api\/me\/last-viewed$/, async (ctx) => {
  const user = requireUser(ctx);
  const db = getDb();
  const subject = findSubjectById(db.content, ctx.body?.subjectId);
  const topic = subject?.topics.find((t) => t.id === ctx.body?.topicId);
  if (!subject || !topic) throw new HttpError(404, 'Тема не найдена.', 'not_found');
  db.lastViewed[user.id] = {
    subjectId: subject.id,
    topicId: topic.id,
    updatedAt: new Date().toISOString(),
  };
  saveDb();
  return { data: { ok: true } };
});

route('GET', /^\/api\/me\/progress$/, (ctx) => {
  const user = requireUser(ctx);
  return { data: computeProgress(user) };
});

route('GET', /^\/api\/me\/attempts$/, (ctx) => {
  const user = requireUser(ctx);
  const db = getDb();
  const attempts = db.attempts
    .filter((a) => a.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { data: { attempts } };
});

/* content */
route('GET', /^\/api\/content$/, () => {
  const db = getDb();
  return { data: { subjects: publicContent(db.content) } };
});

route('GET', /^\/api\/topics\/([^/]+)$/, (ctx) => {
  const db = getDb();
  const found = findTopic(db.content, decodeURIComponent(ctx.params[0]));
  if (!found) throw new HttpError(404, 'Тема не найдена.', 'not_found');
  const { subject, topic } = found;
  const topics = sortByOrder(subject.topics);
  const index = topics.findIndex((t) => t.id === topic.id);
  const prev = index > 0 ? topics[index - 1] : null;
  const next = index < topics.length - 1 ? topics[index + 1] : null;
  return {
    data: {
      subject: { id: subject.id, title: subject.title },
      topic: {
        id: topic.id,
        order: index + 1,
        title: topic.title,
        summary: topic.summary,
        duration: topic.duration,
        lesson: topic.lesson,
        practiceCount: topic.practice.length,
        quiz: {
          title: topic.quiz.title,
          passScore: topic.quiz.passScore,
          questionCount: topic.quiz.questions.length,
        },
      },
      prev: prev ? { id: prev.id, title: prev.title } : null,
      next: next ? { id: next.id, title: next.title } : null,
    },
  };
});

route('GET', /^\/api\/practice\/([^/]+)$/, (ctx) => {
  const db = getDb();
  const set = getQuestionSet(db.content, {
    type: 'practice',
    topicId: decodeURIComponent(ctx.params[0]),
  });
  return {
    data: {
      subject: { id: set.subject.id, title: set.subject.title },
      topic: { id: set.topic.id, title: set.topic.title },
      questions: set.questions,
    },
  };
});

route('GET', /^\/api\/quiz\/([^/]+)$/, (ctx) => {
  const db = getDb();
  const found = findTopic(db.content, decodeURIComponent(ctx.params[0]));
  if (!found) throw new HttpError(404, 'Тема не найдена.', 'not_found');
  const { subject, topic } = found;
  return {
    data: {
      type: 'quiz',
      subject: { id: subject.id, title: subject.title },
      topic: { id: topic.id, title: topic.title },
      quiz: {
        title: topic.quiz.title,
        passScore: topic.quiz.passScore,
        questions: topic.quiz.questions.map(publicQuestion),
      },
    },
  };
});

route('GET', /^\/api\/exam\/([^/]+)$/, (ctx) => {
  const db = getDb();
  const subject = findSubjectById(db.content, decodeURIComponent(ctx.params[0]));
  if (!subject) throw new HttpError(404, 'Предмет не найден.', 'not_found');
  return {
    data: {
      type: 'exam',
      subject: { id: subject.id, title: subject.title },
      exam: {
        title: subject.exam.title,
        description: subject.exam.description,
        durationMin: subject.exam.durationMin,
        questions: publicExamQuestions(subject.exam),
      },
    },
  };
});

route('POST', /^\/api\/attempts$/, async (ctx) => {
  const user = requireUser(ctx);
  const db = getDb();
  const type = ctx.body?.type;
  if (!['quiz', 'exam'].includes(type)) {
    throw new HttpError(400, 'Некорректный тип теста.', 'invalid_input');
  }
  const set = getQuestionSet(db.content, {
    type,
    subjectId: ctx.body?.subjectId,
    topicId: ctx.body?.topicId,
  });
  const answers = normalizeAnswers(ctx.body?.answers);
  const { attempt, items } = gradeAttempt({ set, answers, user });
  db.attempts.push(attempt);
  if (type === 'quiz' && attempt.passed) {
    const exists = db.completions.some((c) => c.userId === user.id && c.topicId === attempt.topicId);
    if (!exists) {
      db.completions.push({
        id: newId('c'),
        userId: user.id,
        subjectId: attempt.subjectId,
        topicId: attempt.topicId,
        createdAt: attempt.createdAt,
      });
    }
  }
  db.lastViewed[user.id] = {
    subjectId: attempt.subjectId,
    topicId: attempt.topicId,
    updatedAt: attempt.createdAt,
  };
  saveDb();
  return {
    status: 201,
    data: {
      attempt,
      items,
      passed: attempt.passed,
      passScore: set.type === 'quiz' ? set.meta.passScore : null,
    },
  };
});

route('GET', /^\/api\/attempts\/([^/]+)$/, (ctx) => {
  const user = requireUser(ctx);
  const db = getDb();
  const attempt = db.attempts.find((a) => a.id === decodeURIComponent(ctx.params[0]));
  if (!attempt) throw new HttpError(404, 'Результат не найден.', 'not_found');
  if (attempt.userId !== user.id && user.role !== 'teacher') {
    throw new HttpError(403, 'Нет доступа к этому результату.', 'forbidden');
  }
  const review = attemptReview(attempt);
  return { data: { attempt, ...review } };
});

/* teacher */
route('GET', /^\/api\/teacher\/content$/, (ctx) => {
  requireTeacher(ctx);
  return { data: { subjects: teacherContent(getDb().content) } };
});

route('PATCH', /^\/api\/teacher\/subjects\/([^/]+)$/, async (ctx) => {
  requireTeacher(ctx);
  const db = getDb();
  const subject = findSubjectById(db.content, decodeURIComponent(ctx.params[0]));
  if (!subject) throw new HttpError(404, 'Предмет не найден.', 'not_found');
  subject.title = localize(ctx.body?.title ?? subject.title, 'название предмета', { max: 160 });
  subject.tagline = localize(ctx.body?.tagline ?? subject.tagline, 'подзаголовок', { max: 200 });
  subject.description = localize(ctx.body?.description ?? subject.description, 'описание', { max: 1200 });
  if (typeof ctx.body?.name === 'string' && ctx.body.name.trim()) {
    subject.name = ctx.body.name.trim().slice(0, 60);
  }
  saveDb();
  return { data: { subject } };
});

route('POST', /^\/api\/teacher\/subjects$/, async (ctx) => {
  requireTeacher(ctx);
  const db = getDb();
  const title = localize(ctx.body?.title, 'название предмета', { max: 160 });
  const tagline = localize(ctx.body?.tagline, 'подзаголовок', { max: 200 });
  const description = localize(ctx.body?.description, 'описание', { max: 1200 });
  const baseId = slugify(title.ru, 'subject');
  let id = baseId;
  while (db.content.some((s) => s.id === id)) id = `${baseId}-${Math.random().toString(36).slice(2, 5)}`;
  const subject = {
    id,
    name: id,
    order: db.content.length + 1,
    title,
    tagline,
    description,
    topics: [],
    exam: normalizeExam({}, id),
  };
  db.content.push(subject);
  saveDb();
  return { status: 201, data: { subject } };
});

route('DELETE', /^\/api\/teacher\/subjects\/([^/]+)$/, async (ctx) => {
  requireTeacher(ctx);
  const db = getDb();
  if (db.content.length <= 1) {
    throw new HttpError(400, 'Нельзя удалить единственный предмет.', 'invalid_input');
  }
  const id = decodeURIComponent(ctx.params[0]);
  const index = db.content.findIndex((s) => s.id === id);
  if (index === -1) throw new HttpError(404, 'Предмет не найден.', 'not_found');
  db.content.splice(index, 1);
  db.content.forEach((s, i) => { s.order = i + 1; });
  db.attempts = db.attempts.filter((a) => a.subjectId !== id);
  db.completions = db.completions.filter((c) => c.subjectId !== id);
  for (const [userId, last] of Object.entries(db.lastViewed)) {
    if (last.subjectId === id) delete db.lastViewed[userId];
  }
  saveDb();
  return { data: { ok: true } };
});

route('POST', /^\/api\/teacher\/subjects\/([^/]+)\/topics$/, async (ctx) => {
  requireTeacher(ctx);
  const db = getDb();
  const subject = findSubjectById(db.content, decodeURIComponent(ctx.params[0]));
  if (!subject) throw new HttpError(404, 'Предмет не найден.', 'not_found');
  if (subject.topics.length >= 40) throw new HttpError(400, 'Достигнут лимит тем.', 'invalid_input');
  const base = `${subject.id}-${slugify(ctx.body?.title?.ru || 'topic', 'topic')}`.slice(0, 60);
  let id = base;
  while (findTopic(db.content, id)) id = `${base}-${Math.random().toString(36).slice(2, 5)}`;
  const topic = normalizeTopic(ctx.body, { subjectId: subject.id, index: subject.topics.length, existingId: id });
  subject.topics.push(topic);
  saveDb();
  return { status: 201, data: { topic } };
});

route('PATCH', /^\/api\/teacher\/topics\/([^/]+)$/, async (ctx) => {
  requireTeacher(ctx);
  const db = getDb();
  const found = findTopic(db.content, decodeURIComponent(ctx.params[0]));
  if (!found) throw new HttpError(404, 'Тема не найдена.', 'not_found');
  const { subject, topic } = found;
  const index = subject.topics.findIndex((t) => t.id === topic.id);
  const updated = normalizeTopic(ctx.body, { subjectId: subject.id, index, existingId: topic.id });
  subject.topics[index] = updated;
  saveDb();
  return { data: { topic: updated } };
});

route('DELETE', /^\/api\/teacher\/topics\/([^/]+)$/, async (ctx) => {
  requireTeacher(ctx);
  const db = getDb();
  const found = findTopic(db.content, decodeURIComponent(ctx.params[0]));
  if (!found) throw new HttpError(404, 'Тема не найдена.', 'not_found');
  const { subject, topic } = found;
  subject.topics = subject.topics.filter((t) => t.id !== topic.id);
  subject.topics.forEach((t, i) => { t.order = i + 1; });
  db.attempts = db.attempts.filter((a) => a.topicId !== topic.id);
  db.completions = db.completions.filter((c) => c.topicId !== topic.id);
  for (const [userId, last] of Object.entries(db.lastViewed)) {
    if (last.topicId === topic.id) delete db.lastViewed[userId];
  }
  saveDb();
  return { data: { ok: true } };
});

route('PATCH', /^\/api\/teacher\/subjects\/([^/]+)\/exam$/, async (ctx) => {
  requireTeacher(ctx);
  const db = getDb();
  const subject = findSubjectById(db.content, decodeURIComponent(ctx.params[0]));
  if (!subject) throw new HttpError(404, 'Предмет не найден.', 'not_found');
  subject.exam = normalizeExam(ctx.body, subject.id);
  saveDb();
  return { data: { exam: subject.exam } };
});

route('GET', /^\/api\/teacher\/export$/, (ctx) => {
  requireTeacher(ctx);
  const subjects = teacherContent(getDb().content);
  return {
    data: { subjects },
    headers: { 'Content-Disposition': 'attachment; filename="ent-school8-content.json"' },
  };
});

route('POST', /^\/api\/teacher\/import$/, async (ctx) => {
  requireTeacher(ctx);
  const db = getDb();
  const raw = ctx.body && ctx.body.content !== undefined ? ctx.body.content : ctx.body;
  const subjects = normalizeContent(raw);
  db.content = subjects;
  const topicIds = new Set(subjects.flatMap((s) => s.topics.map((t) => t.id)));
  const subjectIds = new Set(subjects.map((s) => s.id));
  db.attempts = db.attempts.filter((a) => subjectIds.has(a.subjectId) && (!a.topicId || topicIds.has(a.topicId)));
  db.completions = db.completions.filter((c) => subjectIds.has(c.subjectId) && topicIds.has(c.topicId));
  for (const [userId, last] of Object.entries(db.lastViewed)) {
    if (!subjectIds.has(last.subjectId) || !topicIds.has(last.topicId)) delete db.lastViewed[userId];
  }
  saveDb();
  return { data: { subjects: teacherContent(subjects) } };
});

/* -------------------------------- dispatch ------------------------------ */

function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = pathname.match(r.pattern);
    if (m) return { handler: r.handler, params: m.slice(1) };
  }
  return null;
}

export async function handleApi(req, res, url, ctxBase) {
  const pathname = url.pathname;
  const match = matchRoute(req.method, pathname);
  if (!match) {
    json(res, 404, { error: { code: 'not_found', message: 'Запрос не найден.' } });
    return;
  }
  const ctx = {
    ...ctxBase,
    req,
    res,
    url,
    query: url.searchParams,
    params: match.params,
    body: null,
    user: getSessionUser(ctxBase.cookies.sid),
    ip: req.socket.remoteAddress || 'local',
  };
  try {
    if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
      ctx.body = await readJson(req);
    }
    const result = await match.handler(ctx);
    const headers = { ...(result.headers || {}) };
    json(res, result.status || 200, result.data, headers);
  } catch (err) {
    if (err instanceof HttpError) {
      json(res, err.status, {
        error: { code: err.code, message: err.message, field: err.field || null },
      });
      return;
    }
    console.error('[api] Unhandled error:', err);
    json(res, 500, {
      error: { code: 'server_error', message: 'Внутренняя ошибка сервера. Попробуйте позже.' },
    });
  }
}
