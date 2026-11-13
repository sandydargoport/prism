/**
 * What the Playwright global teardown may run (#1212). It sweeps rows titled
 * "E2E ..." left by specs, so it must only ever reach the test database: it
 * connects through DATABASE_URL, the same address the specs' own database
 * helpers use, and only when E2E_HAS_TEST_DB=1 says that address is a
 * throwaway database. It never names a container, so on a machine that also
 * runs Prism it cannot reach that instance's data.
 */

export const E2E_CLEANUP_SQL = `
  DELETE FROM chore_completions WHERE chore_id IN (SELECT id FROM chores WHERE title LIKE 'E2E %');
  DELETE FROM chores WHERE title LIKE 'E2E %';
  DELETE FROM tasks WHERE title LIKE 'E2E %';
  DELETE FROM events WHERE title LIKE 'E2E %';
  DELETE FROM shopping_items WHERE name LIKE 'E2E %';
  DELETE FROM shopping_lists WHERE name LIKE 'E2E %';
`;

export type TeardownPlan =
  | { run: false; reason: string }
  | { run: true; command: 'psql'; args: string[] };

/** Decide from the environment; nothing here touches a database. */
export function e2eTeardownPlan(env: Record<string, string | undefined>): TeardownPlan {
  if (env.E2E_HAS_TEST_DB !== '1') {
    return { run: false, reason: 'E2E_HAS_TEST_DB is not 1, so there is no test database to clean' };
  }
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    return { run: false, reason: 'DATABASE_URL is not set, so the test database is unknown' };
  }
  return { run: true, command: 'psql', args: [url, '-v', 'ON_ERROR_STOP=1', '-c', E2E_CLEANUP_SQL] };
}
