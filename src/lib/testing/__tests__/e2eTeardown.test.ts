/**
 * The Playwright teardown sweeps "E2E ..." rows, so it may only reach the test
 * database (#1212): never without E2E_HAS_TEST_DB=1 and DATABASE_URL, and
 * never through a container name, which on a machine running Prism is that
 * instance's own database.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { e2eTeardownPlan, E2E_CLEANUP_SQL } from '../e2eTeardown';

describe('e2eTeardownPlan', () => {
  it('runs nothing without the test-database flag, even with an address', () => {
    expect(e2eTeardownPlan({ DATABASE_URL: 'postgresql://prism@postgres:5432/prism' })).toMatchObject({ run: false });
  });

  it('runs nothing without an address, even with the flag', () => {
    expect(e2eTeardownPlan({ E2E_HAS_TEST_DB: '1' })).toMatchObject({ run: false });
    expect(e2eTeardownPlan({ E2E_HAS_TEST_DB: '1', DATABASE_URL: '  ' })).toMatchObject({ run: false });
  });

  it('with both, runs psql against that address and nothing else', () => {
    const plan = e2eTeardownPlan({ E2E_HAS_TEST_DB: '1', DATABASE_URL: 'postgresql://prism@postgres:5432/prism' });
    expect(plan).toEqual({
      run: true,
      command: 'psql',
      args: ['postgresql://prism@postgres:5432/prism', '-v', 'ON_ERROR_STOP=1', '-c', E2E_CLEANUP_SQL],
    });
  });

  it('never reaches a database through a container', () => {
    const plan = e2eTeardownPlan({ E2E_HAS_TEST_DB: '1', DATABASE_URL: 'postgresql://prism@postgres:5432/prism' });
    const all = plan.run ? [plan.command, ...plan.args].join(' ') : '';
    expect(all).not.toMatch(/docker|exec|prism-db/);
  });

  it('only deletes rows titled for E2E', () => {
    for (const stmt of E2E_CLEANUP_SQL.split(';').map((s) => s.trim()).filter(Boolean)) {
      expect(stmt).toMatch(/LIKE 'E2E %'/);
    }
  });
});

describe('the Playwright teardown', () => {
  // It is not under src, so jest cannot import it with its side effects; read
  // it instead. A container name or a shell back in it would reach whatever
  // database that container holds.
  const source = readFileSync(join(__dirname, '../../../../e2e/global-teardown.ts'), 'utf8');

  it('decides through e2eTeardownPlan and runs psql without a shell', () => {
    expect(source).toMatch(/e2eTeardownPlan\(process\.env\)/);
    expect(source).toMatch(/execFileSync\(plan\.command, plan\.args/);
  });

  it('names no container and asks for no shell', () => {
    expect(source).not.toMatch(/docker|prism-db|shell:/);
  });
});
