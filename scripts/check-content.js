/**
 * Validates the starter curriculum: structure, localization and question integrity.
 * Run with: npm run check
 */
import { seedContent } from '../server/seed/index.js';
import { normalizeContent } from '../server/content.js';

const subjects = seedContent();
const errors = [];
const ids = new Set();
let topicCount = 0;
let questionCount = 0;

function checkLocalized(value, where) {
  if (!value || typeof value !== 'object') {
    errors.push(`${where}: отсутствует объект локализации`);
    return;
  }
  for (const lang of ['ru', 'kz']) {
    if (typeof value[lang] !== 'string' || !value[lang].trim()) {
      errors.push(`${where}: пустое поле ${lang}`);
    }
  }
}

function checkQuestion(question, where) {
  questionCount += 1;
  if (ids.has(question.id)) errors.push(`${where}: повторяющийся id ${question.id}`);
  ids.add(question.id);
  checkLocalized(question.text, `${where}.text`);
  checkLocalized(question.explanation, `${where}.explanation`);
  if (!Array.isArray(question.options) || question.options.length < 2) {
    errors.push(`${where}: меньше двух вариантов ответа`);
    return;
  }
  question.options.forEach((option, index) => checkLocalized(option, `${where}.options[${index}]`));
  if (!Number.isInteger(question.correct) || question.correct < 0 || question.correct >= question.options.length) {
    errors.push(`${where}: некорректный correct (${question.correct})`);
  }
  const unique = new Set(question.options.map((o) => o.ru.trim().toLowerCase()));
  if (unique.size !== question.options.length) errors.push(`${where}: одинаковые варианты ответа`);
}

for (const subject of subjects) {
  checkLocalized(subject.title, `${subject.id}.title`);
  checkLocalized(subject.tagline, `${subject.id}.tagline`);
  checkLocalized(subject.description, `${subject.id}.description`);
  if (!Array.isArray(subject.topics) || subject.topics.length === 0) {
    errors.push(`${subject.id}: нет тем`);
  }
  subject.topics.forEach((topic, topicIndex) => {
    topicCount += 1;
    const where = `${subject.id}/${topic.id}`;
    checkLocalized(topic.title, `${where}.title`);
    checkLocalized(topic.summary, `${where}.summary`);
    checkLocalized(topic.lesson, `${where}.lesson`);
    if (topic.order !== topicIndex + 1) errors.push(`${where}: порядок ${topic.order}, ожидался ${topicIndex + 1}`);
    if (!Number.isFinite(Number(topic.duration)) || topic.duration <= 0) errors.push(`${where}: некорректная длительность`);
    if (!topic.quiz) errors.push(`${where}: нет теста`);
    else {
      checkLocalized(topic.quiz.title, `${where}.quiz.title`);
      if (!Array.isArray(topic.quiz.questions) || topic.quiz.questions.length === 0) {
        errors.push(`${where}: пустой тест`);
      }
      (topic.quiz.questions || []).forEach((q, i) => checkQuestion(q, `${where}/quiz[${i}]`));
    }
    if (!Array.isArray(topic.practice)) errors.push(`${where}: нет практики`);
    (topic.practice || []).forEach((q, i) => checkQuestion(q, `${where}/practice[${i}]`));
    for (const lang of ['ru', 'kz']) {
      const words = topic.lesson[lang].trim().split(/\s+/).length;
      if (words < 150) errors.push(`${where}.lesson.${lang}: слишком короткое объяснение (${words} слов)`);
      if (topic.lesson[lang].includes('`')) errors.push(`${where}.lesson.${lang}: обратные кавычки в markdown`);
    }
  });
  if (!subject.exam) {
    errors.push(`${subject.id}: нет пробного экзамена`);
  } else {
    checkLocalized(subject.exam.title, `${subject.id}.exam.title`);
    checkLocalized(subject.exam.description, `${subject.id}.exam.description`);
    if (!Number.isFinite(Number(subject.exam.durationMin))) errors.push(`${subject.id}.exam: нет durationMin`);
    if (!Array.isArray(subject.exam.questions) || subject.exam.questions.length === 0) {
      errors.push(`${subject.id}.exam: нет вопросов`);
    }
    (subject.exam.questions || []).forEach((q, i) => checkQuestion(q, `${subject.id}/exam[${i}]`));
  }
}

try {
  normalizeContent(subjects);
} catch (err) {
  errors.push(`normalizeContent: ${err.message}`);
}

console.log(`Предметов: ${subjects.length}`);
console.log(`Тем: ${topicCount}`);
console.log(`Вопросов: ${questionCount}`);
for (const subject of subjects) {
  console.log(
    `  · ${subject.title.ru}: ${subject.topics.length} тем, ${subject.exam.questions.length} вопросов в пробном варианте`,
  );
}

if (errors.length) {
  console.error(`\nНайдено проблем: ${errors.length}`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log('\n✓ Контент прошёл проверку.');
