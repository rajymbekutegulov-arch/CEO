/**
 * End-to-end API smoke test against a running server.
 * Usage: npm start (in another terminal), then: npm run smoke
 */
const BASE = process.env.TEST_URL || 'http://127.0.0.1:4173';

let passed = 0;
let failed = 0;

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

function sessionCookies(response) {
  const list = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  return list.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function request(path, { method = 'GET', body, cookies } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, data, cookies: sessionCookies(response) };
}

async function main() {
  console.log(`Smoke test: ${BASE}\n`);

  console.log('Публичные данные');
  const health = await request('/api/health');
  check('health отвечает ok', health.response.ok && health.data.ok === true);

  const content = await request('/api/content');
  check('3 предмета', content.data.subjects?.length === 3);
  const topicsTotal = content.data.subjects.reduce((sum, s) => sum + s.topics.length, 0);
  check('13 тем', topicsTotal === 13, `получено ${topicsTotal}`);
  check(
    'в публичном контенте нет правильных ответов',
    !JSON.stringify(content.data).includes('"correct"'),
  );

  const topic = await request('/api/topics/geo-1');
  check('урок доступен', topic.response.ok && topic.data.topic.lesson.ru.length > 500);
  check('есть следующая тема', topic.data.next?.id === 'geo-2');

  const practice = await request('/api/practice/math-1');
  check('практика содержит ответы для проверки', practice.data.questions.every((q) => Number.isInteger(q.correct)));

  const quiz = await request('/api/quiz/math-1');
  check('тест не раскрывает ответы', quiz.data.quiz.questions.every((q) => q.correct === undefined));

  console.log('\nУченик');
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'student@school8.kz', password: 'student123' },
  });
  check('вход ученика', login.response.ok && login.data.user.role === 'student');
  const studentCookies = login.cookies;

  const teacherLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'teacher@school8.kz', password: 'teacher123' },
  });
  check('вход учителя', teacherLogin.response.ok && teacherLogin.data.user.role === 'teacher');
  const teacherCookies = teacherLogin.cookies;

  const teacherContent = await request('/api/teacher/content', { cookies: teacherCookies });
  const mathSubject = teacherContent.data.subjects.find((s) => s.id === 'math');
  const mathTopic = mathSubject.topics.find((t) => t.id === 'math-1');
  const answers = {};
  for (const q of mathTopic.quiz.questions) answers[q.id] = q.correct;

  const attempt = await request('/api/attempts', {
    method: 'POST',
    cookies: studentCookies,
    body: { type: 'quiz', subjectId: 'math', topicId: 'math-1', answers },
  });
  check('тест отправлен и оценён', attempt.response.status === 201 && attempt.data.attempt.percent === 100);
  check('тема отмечена пройденной', attempt.data.attempt.passed === true);

  const review = await request(`/api/attempts/${attempt.data.attempt.id}`, { cookies: studentCookies });
  check('результат доступен ученику', review.response.ok && review.data.items.length === 5);
  check('в разборе есть объяснения', review.data.items.every((i) => i.explanation.ru.length > 0));

  const progress = await request('/api/me/progress', { cookies: studentCookies });
  check(
    'прогресс учитывает пройденную тему',
    progress.data.subjects.find((s) => s.id === 'math').topicsCompleted === 1,
  );
  check('продолжение обучения сохранено', progress.data.resume?.topicId === 'math-1');

  const studentTeacher = await request('/api/teacher/content', { cookies: studentCookies });
  check('ученику закрыт учительский API', studentTeacher.response.status === 403);

  const unknown = await request('/api/attempts/does-not-exist', { cookies: studentCookies });
  check('неизвестный результат — 404', unknown.response.status === 404);

  console.log('\nУчитель');
  const geo = teacherContent.data.subjects.find((s) => s.id === 'geography');
  const subjectPatch = await request('/api/teacher/subjects/geography', {
    method: 'PATCH',
    cookies: teacherCookies,
    body: {
      title: geo.title,
      tagline: geo.tagline,
      description: geo.description,
      name: geo.name,
    },
  });
  check(
    'редактирование предмета сохраняет казахский текст',
    subjectPatch.response.ok && subjectPatch.data.subject.title.kz === geo.title.kz,
    subjectPatch.data?.subject?.title?.kz,
  );

  const geoTopic = geo.topics[0];
  const topicPatch = await request('/api/teacher/topics/geo-1', {
    method: 'PATCH',
    cookies: teacherCookies,
    body: geoTopic,
  });
  check(
    'редактирование темы сохраняет оба языка',
    topicPatch.response.ok &&
      topicPatch.data.topic.title.ru === geoTopic.title.ru &&
      topicPatch.data.topic.title.kz === geoTopic.title.kz,
  );

  const examPatch = await request('/api/teacher/subjects/geography/exam', {
    method: 'PATCH',
    cookies: teacherCookies,
    body: geo.exam,
  });
  check('пробный вариант сохраняется', examPatch.response.ok && examPatch.data.exam.questions.length === 10);

  const invalid = await request('/api/teacher/topics/geo-1', {
    method: 'PATCH',
    cookies: teacherCookies,
    body: { ...geoTopic, title: { ru: 'Только русский', kz: '' } },
  });
  check('валидация отклоняет неполный перевод', invalid.response.status === 400);

  const exportResponse = await fetch(`${BASE}/api/teacher/export`, { headers: { Cookie: teacherCookies } });
  check('экспорт отдаёт JSON-файл', exportResponse.status === 200);

  const unique = `smoke-${Date.now()}@school8.kz`;
  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Смоук Тест', email: unique, password: 'secret1', language: 'kz' },
  });
  check('регистрация нового ученика', registration.response.status === 201 && registration.data.user.language === 'kz');
  const duplicate = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Дубликат', email: unique, password: 'secret1' },
  });
  check('повторная почта отклоняется', duplicate.response.status === 409);

  const page = await fetch(BASE);
  const html = await page.text();
  check('главная страница отдаётся', page.status === 200 && html.includes('ЕНТ'));
  check('CSP включён', (page.headers.get('content-security-policy') || '').includes("default-src 'self'"));

  console.log(`\nИтог: ${passed} успешно, ${failed} ошибок`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\nSmoke test упал:', err);
  process.exit(1);
});
