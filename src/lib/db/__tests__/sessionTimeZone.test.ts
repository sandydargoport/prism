/**
 * Every database session runs in UTC.
 *
 * The timestamp columns carry no zone and Drizzle reads them back as UTC, but a
 * column default of now() (76 of them) is written in the session's zone. On a
 * Postgres server set to local time, a message posted a moment ago was stored
 * as local clock time and read back hours old. Pinning TimeZone per connection
 * fixes it regardless of how the server is configured.
 *
 * The scripts build their own connections, so they are checked by source.
 */
import fs from 'fs';
import path from 'path';

jest.mock('postgres', () => jest.fn(() => ({})));
jest.mock('drizzle-orm/postgres-js', () => ({ drizzle: jest.fn(() => ({ select: jest.fn() })) }));

const repoRoot = path.join(__dirname, '..', '..', '..', '..');

describe('database session time zone', () => {
  it('the app client opens every connection in UTC', async () => {
    process.env.DATABASE_URL = 'postgres://prism:example@db.invalid:5432/prism';
    const postgres = (await import('postgres')).default as unknown as jest.Mock;
    const { db, DB_SESSION_PARAMS } = await import('../client');

    expect(DB_SESSION_PARAMS).toEqual({ TimeZone: 'UTC' });
    void db.select; // first property access opens the client

    expect(postgres).toHaveBeenCalledTimes(1);
    expect(postgres.mock.calls[0][1]).toMatchObject({ connection: { TimeZone: 'UTC' } });
  });

  it.each([
    'scripts/migrate.js',
    'scripts/reset-pin.js',
  ])('%s opens its connection in UTC', (file) => {
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    expect(source).toMatch(/connection:\s*\{\s*TimeZone:\s*'UTC'\s*\}/);
  });

  it('the seed uses the shared session parameters', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/lib/db/seed.ts'), 'utf8');
    expect(source).toMatch(/postgres\(connectionString,\s*\{\s*connection:\s*DB_SESSION_PARAMS\s*\}\)/);
  });
});
