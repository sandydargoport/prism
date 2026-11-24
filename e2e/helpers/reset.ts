import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { testDbFileCommand, testRedisFlushCommand } from './testDb';

/**
 * Run SQL against the e2e test database: DATABASE_URL, or the container named
 * by E2E_DB_CONTAINER. There is no default container (#1360), see `testDb.ts`.
 */
export function runSQL(sql: string) {
  const tmpFile = join(tmpdir(), `prism-e2e-${Date.now()}.sql`);
  writeFileSync(tmpFile, sql, 'utf-8');
  try {
    execSync(testDbFileCommand(tmpFile), { stdio: 'pipe' });
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Flush Redis to clear sessions and caches.
 */
function flushRedis() {
  execSync(testRedisFlushCommand(), { stdio: 'pipe' });
}

/**
 * Reset tasks to seed state (uncomplete all except known-completed ones).
 */
export function resetTasks() {
  runSQL(`
    UPDATE tasks SET completed = false, completed_at = NULL, completed_by = NULL
      WHERE completed = true;
  `);
}

/**
 * Reset all shopping items to unchecked.
 */
export function resetShoppingItems() {
  runSQL(`UPDATE shopping_items SET checked = false;`);
}

/**
 * Clear recent chore completions (last day).
 */
export function resetChoreCompletions() {
  runSQL(`DELETE FROM chore_completions WHERE completed_at > now() - interval '1 day';`);
}

/**
 * Disable away mode and babysitter mode.
 */
export function resetModes() {
  runSQL(`DELETE FROM settings WHERE key IN ('awayMode', 'babysitterMode');`);
}

/**
 * Full reset: flush Redis + reset all test-relevant data.
 */
export function resetAll() {
  flushRedis();
  resetTasks();
  resetShoppingItems();
  resetChoreCompletions();
  resetModes();
}
