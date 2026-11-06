import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedContent } from './seed/index.js';
import { hashPassword, newId } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
export const DB_FILE = path.join(DATA_DIR, 'db.json');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let db = null;

export function seedUsers() {
  const now = new Date().toISOString();
  return [
    {
      id: 'u_teacher_demo',
      name: 'Айгуль Нурлановна',
      email: 'teacher@school8.kz',
      role: 'teacher',
      language: 'ru',
      password: hashPassword('teacher123'),
      createdAt: now,
    },
    {
      id: 'u_student_demo',
      name: 'Алия Демо',
      email: 'student@school8.kz',
      role: 'student',
      language: 'ru',
      password: hashPassword('student123'),
      createdAt: now,
    },
  ];
}

function initialDb() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    users: seedUsers(),
    sessions: {},
    attempts: [],
    completions: [],
    lastViewed: {},
    content: seedContent(),
  };
}

function normalizeDb(raw) {
  const base = initialDb();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    users: Array.isArray(raw.users) ? raw.users : base.users,
    sessions: raw.sessions && typeof raw.sessions === 'object' ? raw.sessions : {},
    attempts: Array.isArray(raw.attempts) ? raw.attempts : [],
    completions: Array.isArray(raw.completions) ? raw.completions : [],
    lastViewed: raw.lastViewed && typeof raw.lastViewed === 'object' ? raw.lastViewed : {},
    content: Array.isArray(raw.content) && raw.content.length ? raw.content : base.content,
  };
}

export function loadDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      db = normalizeDb(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
    } catch (err) {
      console.error('[db] Could not read data/db.json, starting from seed:', err.message);
      const backup = `${DB_FILE}.broken-${Date.now()}`;
      try {
        fs.renameSync(DB_FILE, backup);
      } catch { /* ignore */ }
      db = initialDb();
      saveDb();
      return db;
    }
  } else {
    db = initialDb();
    saveDb();
  }
  pruneSessions();
  return db;
}

export function getDb() {
  return loadDb();
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function saveDb() {
  if (!db) return;
  db.updatedAt = new Date().toISOString();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  const json = JSON.stringify(db, null, 2);
  fs.writeFileSync(tmp, json);

  // Windows + OneDrive/antivirus can briefly lock the target file, which makes
  // rename fail with EPERM. Retry, then fall back to an in-place write.
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.renameSync(tmp, DB_FILE);
      return;
    } catch (err) {
      lastError = err;
      if (err.code !== 'EPERM' && err.code !== 'EACCES' && err.code !== 'EBUSY') break;
      sleepSync(40 * (attempt + 1));
    }
  }

  try {
    fs.writeFileSync(DB_FILE, json);
    fs.rmSync(tmp, { force: true });
    console.warn('[db] Atomic rename failed, wrote data directly:', lastError?.code);
  } catch (err) {
    throw lastError || err;
  }
}

export function resetDb() {
  db = initialDb();
  saveDb();
  return db;
}

function pruneSessions() {
  if (!db) return;
  const now = Date.now();
  let changed = false;
  for (const [token, session] of Object.entries(db.sessions)) {
    if (!session || !session.expiresAt || session.expiresAt < now) {
      delete db.sessions[token];
      changed = true;
    }
  }
  if (changed) saveDb();
}

export function createSession(userId) {
  const data = getDb();
  const token = newId('s');
  const now = Date.now();
  data.sessions[token] = { userId, createdAt: now, expiresAt: now + SESSION_TTL_MS };
  saveDb();
  return token;
}

export function getSessionUser(token) {
  if (!token) return null;
  const data = getDb();
  const session = data.sessions[token];
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    delete data.sessions[token];
    saveDb();
    return null;
  }
  return data.users.find((u) => u.id === session.userId) || null;
}

export function destroySession(token) {
  if (!token) return;
  const data = getDb();
  if (data.sessions[token]) {
    delete data.sessions[token];
    saveDb();
  }
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    language: user.language || 'ru',
    createdAt: user.createdAt,
  };
}
