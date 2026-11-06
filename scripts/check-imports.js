/**
 * Deployment sanity check: every relative import must end with an explicit
 * extension and point to an existing file with exactly matching case.
 * This catches the most common ERR_MODULE_NOT_FOUND causes on Linux/Render.
 *
 * Run: node scripts/check-imports.js
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'shots', '.deploy-check', '.edge-profile', '.edge-profile2']);
const ALLOWED_EXTENSIONS = new Set(['.js', '.mjs', '.json']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collectSpecifiers(source) {
  const cleaned = stripComments(source);
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of cleaned.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function resolveExact(fromDir, specifier) {
  const segments = specifier.split('/');
  let current = fromDir;
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      current = path.dirname(current);
      continue;
    }
    let entries;
    try {
      entries = fs.readdirSync(current);
    } catch {
      return { ok: false, reason: `каталог не найден: ${current}` };
    }
    if (!entries.includes(segment)) {
      const caseMatch = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
      return {
        ok: false,
        reason: caseMatch
          ? `регистр не совпадает: «${segment}» вместо «${caseMatch}»`
          : `файл не найден: ${path.join(current, segment)}`,
      };
    }
    current = path.join(current, segment);
  }
  try {
    if (!fs.statSync(current).isFile()) return { ok: false, reason: 'это не файл' };
  } catch {
    return { ok: false, reason: `файл не найден: ${current}` };
  }
  return { ok: true };
}

const files = walk(ROOT);
const errors = [];
let checkedImports = 0;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const specifiers = collectSpecifiers(source);
  for (const specifier of specifiers) {
    if (!specifier.startsWith('.')) continue;
    checkedImports += 1;
    const relativeFile = path.relative(ROOT, file);
    const extension = path.extname(specifier);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      errors.push(
        `${relativeFile}: «${specifier}» — нет явного расширения .js (в ESM это обязательно на Linux/Render)`,
      );
      continue;
    }
    const resolved = resolveExact(path.dirname(file), specifier);
    if (!resolved.ok) {
      errors.push(`${relativeFile}: «${specifier}» — ${resolved.reason}`);
    }
  }
}

console.log(`Проверка импортов: файлов ${files.length}, относительных импортов ${checkedImports}`);

if (errors.length) {
  console.error(`\nНайдено проблем: ${errors.length}`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  console.error('\nИсправьте пути: расширение .js обязательно, регистр должен совпадать с именем файла.');
  process.exit(1);
}

console.log('✓ Все относительные импорты корректны: расширение .js, файлы существуют, регистр совпадает.');
