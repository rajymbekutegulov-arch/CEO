import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.js';
import { loadDb, DB_FILE } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 4173;
// Render (and most PaaS) require binding to 0.0.0.0, not 127.0.0.1.
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function securityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
    ...extra,
  };
}

function sendError(res, status, message) {
  const body = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>${status}</title>
  <style>body{font-family:system-ui,sans-serif;background:#f6f7fb;color:#101828;display:grid;place-items:center;min-height:100vh;margin:0}
  main{text-align:center;padding:32px}h1{font-size:48px;margin:0 0 8px}p{color:#5b6478}a{color:#4f46e5}</style>
  <main><h1>${status}</h1><p>${message}</p><p><a href="/">Вернуться на главную</a></p></main></html>`;
  res.writeHead(status, securityHeaders({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }));
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    sendError(res, 400, 'Некорректный адрес.');
    return;
  }
  if (relative.endsWith('/')) relative += 'index.html';
  const filePath = path.resolve(PUBLIC_DIR, `.${relative}`);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    sendError(res, 403, 'Доступ запрещён.');
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (relative === '/index.html') {
      sendError(res, 500, 'Папка public/index.html не найдена.');
      return;
    }
    sendError(res, 404, 'Страница не найдена.');
    return;
  }
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const headers = securityHeaders({
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'no-cache',
    'Last-Modified': stat.mtime.toUTCString(),
  });
  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    res.end();
    return;
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    sendError(res, 400, 'Некорректный запрос.');
    return;
  }
  res.on('finish', () => {
    if (!url.pathname.startsWith('/api/')) return;
    console.log(`[api] ${req.method} ${url.pathname} → ${res.statusCode} (${Date.now() - started} ms)`);
  });

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url, { cookies: parseCookies(req.headers.cookie) });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendError(res, 405, 'Метод не поддерживается.');
      return;
    }
    if (url.pathname === '/') {
      serveStatic(req, res, '/index.html');
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error('[server] Error:', err);
    if (!res.headersSent) sendError(res, 500, 'Что-то пошло не так.');
    else res.end();
  }
});

loadDb();
server.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  const url = `http://${displayHost}:${PORT}`;
  console.log('');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log('  │  ЕНТ · Школа №8 — платформа подготовки        │');
  console.log('  └──────────────────────────────────────────────┘');
  console.log(`  Сайт:            ${url}`);
  console.log(`  Демо-ученик:     student@school8.kz / student123`);
  console.log(`  Демо-учитель:    teacher@school8.kz / teacher123`);
  console.log(`  База данных:     ${DB_FILE}`);
  if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`  Render URL:      ${process.env.RENDER_EXTERNAL_URL}`);
  }
  console.log('  Остановка:       Ctrl+C');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nПорт ${PORT} уже занят. Запустите с другим портом: PowerShell — $env:PORT=4174; npm start\n`);
    process.exit(1);
  }
  throw err;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\nСервер остановлен.');
    server.close(() => process.exit(0));
  });
}
