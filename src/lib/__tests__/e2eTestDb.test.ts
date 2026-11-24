/**
 * The e2e database helpers reach only a database the run names (#1360). A
 * default container name would be the real install's on a host that runs one.
 */
import { testDbCommand, testDbFileCommand, testRedisFlushCommand } from '../../../e2e/helpers/testDb';

describe('e2e test database target', () => {
  it('refuses to run with no database named', () => {
    expect(() => testDbCommand('SELECT 1', {}, {})).toThrow(/no test database named/);
    expect(() => testDbFileCommand('/tmp/x.sql', {})).toThrow(/no test database named/);
  });

  it('refuses to flush Redis with none named', () => {
    expect(() => testRedisFlushCommand({})).toThrow(/no test Redis named/);
  });

  it('never falls back to the install container names', () => {
    for (const fn of [() => testDbCommand('SELECT 1', {}, {}), () => testRedisFlushCommand({})]) {
      let cmd = '';
      try { cmd = fn(); } catch { /* expected */ }
      expect(cmd).not.toMatch(/prism-db|prism-redis/);
    }
  });

  it('uses DATABASE_URL when set', () => {
    expect(testDbCommand('SELECT 1', { tuplesOnly: true }, { DATABASE_URL: 'postgresql://t@db/x' }))
      .toBe('psql "postgresql://t@db/x" -At -c "SELECT 1"');
    expect(testDbFileCommand('/tmp/a.sql', { DATABASE_URL: 'postgresql://t@db/x' }))
      .toBe('psql "postgresql://t@db/x" -f "/tmp/a.sql"');
  });

  it('uses the named container when set', () => {
    expect(testDbCommand('SELECT 1', {}, { E2E_DB_CONTAINER: 'test-db', E2E_DB_NAME: 'e2e' }))
      .toBe('docker exec test-db psql -U prism -d e2e -c "SELECT 1"');
    expect(testRedisFlushCommand({ E2E_REDIS_CONTAINER: 'test-redis' }))
      .toBe('docker exec test-redis redis-cli FLUSHDB');
    expect(testRedisFlushCommand({ REDIS_URL: 'redis://r:6379' })).toBe('redis-cli -u "redis://r:6379" FLUSHDB');
  });
});
