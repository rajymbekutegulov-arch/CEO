import { t, pick } from '../i18n.js';
import { state } from '../store.js';
import { escapeHtml, icon, subjectTheme, subjectIcon, go } from '../utils.js';
import { subjectCard, progressBar, emptyState, chip } from '../components.js';

function totalQuestions() {
  let total = 0;
  for (const subject of state.content || []) {
    for (const topic of subject.topics) {
      total += topic.practiceCount + topic.quiz.questionCount;
    }
    total += subject.exam.questionCount;
  }
  return total;
}

function subjectRows() {
  return (state.content || [])
    .slice(0, 3)
    .map((subject, index) => {
      const theme = subjectTheme(subject.id, index);
      return `<a class="route-subject theme-${theme}" href="#/subject/${encodeURIComponent(subject.id)}">
        <span class="route-subject-icon">${icon(subjectIcon(subject.id), 18)}</span>
        <span class="route-subject-name">${escapeHtml(pick(subject.title))}</span>
        <span class="route-subject-count">${subject.topicCount}</span>
        ${icon('chevron', 16, 'route-chevron')}
      </a>`;
    })
    .join('');
}

function resumeBanner(progress) {
  if (!progress?.resume) return '';
  return `<section class="container">
    <div class="resume-banner">
      <div class="resume-icon">${icon('play', 20)}</div>
      <div class="resume-copy">
        <p class="resume-label">${escapeHtml(t('profileContinue'))}</p>
        <p class="resume-title">${escapeHtml(pick(progress.resume.topicTitle))}</p>
        <p class="resume-sub">${escapeHtml(pick(progress.resume.subjectTitle))}</p>
      </div>
      <div class="resume-actions">
        <a class="btn btn-primary" href="#/lesson/${encodeURIComponent(progress.resume.topicId)}">${escapeHtml(t('continue'))} ${icon('arrow-right', 18)}</a>
      </div>
    </div>
  </section>`;
}

function progressPanel() {
  const user = state.user;
  if (!user) {
    return `<div class="hero-panel">
      <div class="hero-panel-top">
        <span class="mini-badge">${icon('sparkles', 14)} ${escapeHtml(t('appTagline'))}</span>
        <span class="hero-panel-tag">RU · KZ</span>
      </div>
      <p class="hero-panel-title">${escapeHtml(t('homeCtaTitle'))}</p>
      <div class="route-subjects">${subjectRows()}</div>
      <div class="hero-panel-footer">
        <span>${icon('clock', 15)} ${escapeHtml(t('lessonReadingTime', { minutes: 12 }))}</span>
        <a href="#/subjects" class="text-link">${escapeHtml(t('goSubjects'))} ${icon('arrow-right', 15)}</a>
      </div>
    </div>`;
  }
  const progress = state.progress;
  if (!progress) {
    return `<div class="hero-panel">
      <div class="hero-panel-top"><span class="mini-badge">${icon('user', 14)} ${escapeHtml(user.name)}</span></div>
      <p class="hero-panel-title">${escapeHtml(t('homeProgressTitle'))}</p>
      <div class="route-subjects">${subjectRows()}</div>
      <div class="hero-panel-footer"><a href="#/profile" class="text-link">${escapeHtml(t('profile'))} ${icon('arrow-right', 15)}</a></div>
    </div>`;
  }
  return `<div class="hero-panel">
    <div class="hero-panel-top">
      <span class="mini-badge">${icon('chart', 14)} ${escapeHtml(t('homeProgressTitle'))}</span>
      <span class="hero-panel-tag">${progress.totals.percent}%</span>
    </div>
    <div class="hero-panel-progress">
      <div class="hero-progress-label"><span>${escapeHtml(t('profileOverall'))}</span><strong>${progress.totals.percent}%</strong></div>
      ${progressBar(progress.totals.percent)}
      <p class="hero-progress-note">${escapeHtml(t('subjectProgress', { done: progress.totals.topicsCompleted, total: progress.totals.topicsTotal }))}</p>
    </div>
    <div class="route-subjects">
      ${(progress.subjects || []).slice(0, 3).map((sp, index) => {
        const subject = (state.content || []).find((s) => s.id === sp.id);
        return `<a class="route-subject theme-${subjectTheme(sp.id, index)}" href="#/subject/${encodeURIComponent(sp.id)}">
          <span class="route-subject-icon">${icon(subjectIcon(sp.id), 18)}</span>
          <span class="route-subject-name">${escapeHtml(pick(sp.title))}</span>
          <span class="route-subject-percent">${sp.percent}%</span>
          ${icon('chevron', 16, 'route-chevron')}
        </a>`;
      }).join('')}
    </div>
    <div class="hero-panel-footer">
      <span>${icon('check', 15)} ${escapeHtml(t('profileCompletedTopics'))}: ${progress.totals.topicsCompleted}</span>
      <a href="#/profile" class="text-link">${escapeHtml(t('profile'))} ${icon('arrow-right', 15)}</a>
    </div>
  </div>`;
}

export function homePage() {
  const subjects = state.content || [];
  const questionTotal = totalQuestions();
  const topicsTotal = subjects.reduce((n, s) => n + s.topicCount, 0);
  const progressSubjects = state.progress?.subjects || null;

  const node = document.createElement('div');
  node.className = 'page home-page';
  node.innerHTML = `
    <section class="hero">
      <div class="hero-glow hero-glow-a" aria-hidden="true"></div>
      <div class="hero-glow hero-glow-b" aria-hidden="true"></div>
      <div class="container hero-inner">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-dot"></span>${escapeHtml(t('homeEyebrow'))}</p>
          <h1 class="hero-title">${escapeHtml(t('homeTitleA'))}<br><span class="grad-text">${escapeHtml(t('homeTitleAccent'))}</span></h1>
          <p class="hero-sub">${escapeHtml(t('homeSubtitle'))}</p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="#/subjects">${escapeHtml(t('ctaStart'))} ${icon('arrow-right', 19)}</a>
            <button class="btn btn-secondary btn-lg" type="button" data-scroll="how">${escapeHtml(t('ctaHow'))}</button>
          </div>
          <div class="hero-meta">
            ${chip(`${subjects.length} ${t('statSubjects')}`, 'brand')}
            ${chip(`${topicsTotal} ${t('statTopics')}`, 'muted')}
            ${chip('RU / KZ', 'muted')}
          </div>
        </div>
        <div class="hero-visual">
          <div class="hero-visual-backdrop" aria-hidden="true"></div>
          ${progressPanel()}
        </div>
      </div>
    </section>

    ${resumeBanner(state.progress)}

    <section class="stats-band">
      <div class="container stats-grid">
        <div class="stat"><strong>${subjects.length}</strong><span>${escapeHtml(t('statSubjects'))}</span></div>
        <div class="stat"><strong>${topicsTotal}</strong><span>${escapeHtml(t('statTopics'))}</span></div>
        <div class="stat"><strong>${questionTotal}+</strong><span>${escapeHtml(t('statQuestions'))}</span></div>
        <div class="stat"><strong>2</strong><span>${escapeHtml(t('statLanguages'))}</span></div>
      </div>
    </section>

    <section class="section container" id="homeSubjects">
      <div class="section-head">
        <div>
          <p class="eyebrow">${escapeHtml(t('navSubjects'))}</p>
          <h2>${escapeHtml(t('homeSubjectsTitle'))}</h2>
          <p class="section-lead">${escapeHtml(t('homeSubjectsText'))}</p>
        </div>
        <a class="btn btn-ghost" href="#/subjects">${escapeHtml(t('viewAll'))} ${icon('arrow-right', 17)}</a>
      </div>
      ${
        subjects.length
          ? `<div class="subject-grid">
              ${subjects.map((subject, i) => subjectCard(subject, i, { progress: progressSubjects?.find((p) => p.id === subject.id) || null })).join('')}
            </div>`
          : emptyState({ iconName: 'book', title: t('subjectsEmpty'), text: t('subjectsEmptyText') })
      }
    </section>

    <section class="section container" id="how">
      <div class="section-head is-centered">
        <div>
          <p class="eyebrow">${escapeHtml(t('ctaHow'))}</p>
          <h2>${escapeHtml(t('howTitle'))}</h2>
          <p class="section-lead">${escapeHtml(t('howText'))}</p>
        </div>
      </div>
      <ol class="steps">
        <li class="step">
          <span class="step-num">01</span>
          <div class="step-icon">${icon('map', 22)}</div>
          <h3>${escapeHtml(t('step1Title'))}</h3>
          <p>${escapeHtml(t('step1Text'))}</p>
        </li>
        <li class="step">
          <span class="step-num">02</span>
          <div class="step-icon">${icon('book', 22)}</div>
          <h3>${escapeHtml(t('step2Title'))}</h3>
          <p>${escapeHtml(t('step2Text'))}</p>
        </li>
        <li class="step">
          <span class="step-num">03</span>
          <div class="step-icon">${icon('target', 22)}</div>
          <h3>${escapeHtml(t('step3Title'))}</h3>
          <p>${escapeHtml(t('step3Text'))}</p>
        </li>
        <li class="step">
          <span class="step-num">04</span>
          <div class="step-icon">${icon('trophy', 22)}</div>
          <h3>${escapeHtml(t('step4Title'))}</h3>
          <p>${escapeHtml(t('step4Text'))}</p>
        </li>
      </ol>
    </section>

    <section class="section container">
      <div class="feature-grid">
        <article class="feature-card">
          <span class="feature-icon">${icon('globe', 22)}</span>
          <h3>${escapeHtml(t('bilingualTitle'))}</h3>
          <p>${escapeHtml(t('bilingualText'))}</p>
        </article>
        <article class="feature-card">
          <span class="feature-icon">${icon('target', 22)}</span>
          <h3>${escapeHtml(t('freeTitle'))}</h3>
          <p>${escapeHtml(t('freeText'))}</p>
        </article>
        <article class="feature-card">
          <span class="feature-icon">${icon('shield', 22)}</span>
          <h3>${escapeHtml(t('profileRecent'))}</h3>
          <p>${escapeHtml(t('resultsSaved'))}</p>
        </article>
      </div>
    </section>

    <section class="section container">
      <div class="cta-panel">
        <div class="cta-copy">
          <p class="eyebrow is-light">${escapeHtml(t('homeEyebrow'))}</p>
          <h2>${escapeHtml(t('homeCtaTitle'))}</h2>
          <p>${escapeHtml(t('homeCtaText'))}</p>
        </div>
        <div class="cta-actions">
          <a class="btn btn-light btn-lg" href="#/subjects">${escapeHtml(t('homeCtaButton'))} ${icon('arrow-right', 19)}</a>
          ${state.user ? '' : `<a class="btn btn-outline-light btn-lg" href="#/register">${escapeHtml(t('navRegister'))}</a>`}
        </div>
      </div>
    </section>
  `;

  node.querySelectorAll('[data-scroll]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.scroll);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  return node;
}
