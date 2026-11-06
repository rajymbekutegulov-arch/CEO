/**
 * Resets the local database to the starter state (demo users + seed curriculum).
 * The current database is backed up first. Run with: npm run reset-db
 */
import fs from 'node:fs';
import { DB_FILE, resetDb } from '../server/db.js';

if (fs.existsSync(DB_FILE)) {
  const backup = `${DB_FILE}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(DB_FILE, backup);
  console.log(`Резервная копия: ${backup}`);
}
resetDb();
console.log(`База данных сброшена: ${DB_FILE}`);
console.log('Демо-доступ: student@school8.kz / student123 · teacher@school8.kz / teacher123');
