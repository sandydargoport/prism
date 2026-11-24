import { execSync } from 'node:child_process';

/** The variables these helpers read; a plain object in tests. */
type Env = Record<string, string | undefined>;

/**
 * Run SQL against the e2e test database (#1360).
 *
 * The database must be named by the run: `DATABASE_URL` (CI, or any host with
 * `psql`), or `E2E_DB_CONTAINER` (a postgres container to `docker exec` into,
 * with `E2E_DB_NAME`, default `prism`). There is no default container: on a
 * host that also runs a real install, a guessed name like `prism-db` is that
 * install's database, and a spec must never read or write it by accident.
 */
export function testDbCommand(
  sql: string,
  opts: { tuplesOnly?: boolean } = {},
  env: Env = process.env,
): string {
  const flags = opts.tuplesOnly ? '-At -c' : '-c';
  if (env.DATABASE_URL) return `psql "${env.DATABASE_URL}" ${flags} "${sql}"`;
  if (env.E2E_DB_CONTAINER) {
    return `docker exec ${env.E2E_DB_CONTAINER} psql -U prism -d ${env.E2E_DB_NAME || 'prism'} ${flags} "${sql}"`;
  }
  throw new Error(
    'e2e: no test database named. Set DATABASE_URL, or E2E_DB_CONTAINER to the test ' +
      'postgres container. There is no default, so a spec cannot reach a real install.',
  );
}

/** Run a statement and return its trimmed output. */
export function runTestDb(sql: string, opts: { tuplesOnly?: boolean } = {}): string {
  return execSync(testDbCommand(sql, opts), { encoding: 'utf-8' }).trim();
}

/**
 * The shell command that runs a SQL file against the test database, under the
 * same rule as `testDbCommand`: a database the run names, never a default.
 */
export function testDbFileCommand(file: string, env: Env = process.env): string {
  if (env.DATABASE_URL) return `psql "${env.DATABASE_URL}" -f "${file}"`;
  if (env.E2E_DB_CONTAINER) {
    return `docker exec -i ${env.E2E_DB_CONTAINER} psql -U prism -d ${env.E2E_DB_NAME || 'prism'} < "${file}"`;
  }
  return testDbCommand('', {}, env); // throws the same message
}

/**
 * The command that empties the test Redis: `REDIS_URL`, or the container named
 * by `E2E_REDIS_CONTAINER`. No default, for the same reason as the database:
 * a guessed `prism-redis` would sign out a real install.
 */
export function testRedisFlushCommand(env: Env = process.env): string {
  if (env.REDIS_URL) return `redis-cli -u "${env.REDIS_URL}" FLUSHDB`;
  if (env.E2E_REDIS_CONTAINER) return `docker exec ${env.E2E_REDIS_CONTAINER} redis-cli FLUSHDB`;
  throw new Error(
    'e2e: no test Redis named. Set REDIS_URL, or E2E_REDIS_CONTAINER to the test redis ' +
      'container. There is no default, so a spec cannot reach a real install.',
  );
}
