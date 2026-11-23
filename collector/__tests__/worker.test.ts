/**
 * The install counter's feedback votes (#1311), run against real SQLite with
 * the collector's own schema.sql, so the upsert and the totals are the SQL
 * that ships: one row per install per question, a second vote replaces the
 * first, and /stats adds them up per question.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import worker from '../worker.js';

/** Just enough of D1 (prepare, bind, run, first, all) over SQLite for the Worker's queries. */
function fakeD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      let params: SQLInputValue[] = [];
      const stmt = {
        bind(...p: SQLInputValue[]) { params = p; return stmt; },
        async run() { db.prepare(sql).run(...params); return { success: true }; },
        async first(col?: string) {
          const row = db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
          return row ? (col ? row[col] : row) : null;
        },
        async all() { return { results: db.prepare(sql).all(...params) }; },
      };
      return stmt;
    },
  };
}

const TOKEN = 'stats-token-for-tests';
const INSTALL_A = '00000000-0000-4000-8000-00000000000a';
const INSTALL_B = '00000000-0000-4000-8000-00000000000b';
const INSTALL_C = '00000000-0000-4000-8000-00000000000c';
const Q = '2026-11-navigation';

let db: DatabaseSync;
let env: { DB: ReturnType<typeof fakeD1>; STATS_TOKEN: string };

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  env = { DB: fakeD1(db), STATS_TOKEN: TOKEN };
});

const vote = (body: unknown, at = '/vote') =>
  worker.fetch(new Request(`https://collector.example.com${at}`, { method: 'POST', body: JSON.stringify(body) }), env);
const stats = async () => {
  const res = await worker.fetch(new Request(`https://collector.example.com/stats?token=${TOKEN}`), env);
  return (await res.json()) as { votes: Record<string, { total: number; answers: Record<string, number> }> };
};
const rows = () => db.prepare('SELECT id, referendum, answer FROM votes ORDER BY id, referendum').all().map((r) => ({ ...r }));

describe('POST /vote', () => {
  it('stores one row per install per question, and a second vote replaces the first', async () => {
    const first = await vote({ schema: 1, id: INSTALL_A, referendum: Q, answer: 'sidebar' });
    expect(first.status).toBe(200);
    expect(rows()).toEqual([{ id: INSTALL_A, referendum: Q, answer: 'sidebar' }]);

    await vote({ schema: 1, id: INSTALL_A, referendum: Q, answer: 'bottom-bar' });
    expect(rows()).toEqual([{ id: INSTALL_A, referendum: Q, answer: 'bottom-bar' }]);
  });

  it('keeps the same install apart across questions, and takes /v1/vote too', async () => {
    await vote({ schema: 1, id: INSTALL_A, referendum: Q, answer: 'sidebar' });
    await vote({ schema: 1, id: INSTALL_A, referendum: '2027-01-example', answer: 'yes' }, '/v1/vote');
    expect(rows()).toEqual([
      { id: INSTALL_A, referendum: Q, answer: 'sidebar' },
      { id: INSTALL_A, referendum: '2027-01-example', answer: 'yes' },
    ]);
  });

  it('refuses a vote with no install id, or a question or answer that is not a slug', async () => {
    for (const body of [
      { schema: 1, referendum: Q, answer: 'sidebar' },
      { schema: 1, id: INSTALL_A, referendum: Q },
      { schema: 1, id: INSTALL_A, referendum: Q, answer: 'Bring back <the sidebar>' },
      { schema: 1, id: INSTALL_A, referendum: 'DROP TABLE votes', answer: 'sidebar' },
    ]) {
      expect((await vote(body)).status).toBe(400);
    }
    expect(rows()).toEqual([]);
  });

  it('stores only the install id, the question, the answer and when: no address column', () => {
    const columns = db.prepare('PRAGMA table_info(votes)').all().map((c) => (c as { name: string }).name);
    expect(columns).toEqual(['id', 'referendum', 'answer', 'updated_at']);
  });
});

describe('GET /stats', () => {
  it('reports per-question totals, counting each install once at its latest answer', async () => {
    await vote({ schema: 1, id: INSTALL_A, referendum: Q, answer: 'bottom-bar' });
    await vote({ schema: 1, id: INSTALL_B, referendum: Q, answer: 'sidebar' });
    await vote({ schema: 1, id: INSTALL_C, referendum: Q, answer: 'bottom-bar' });
    await vote({ schema: 1, id: INSTALL_C, referendum: Q, answer: 'sidebar' }); // changed its mind
    await vote({ schema: 1, id: INSTALL_A, referendum: '2027-01-example', answer: 'yes' });

    expect((await stats()).votes).toEqual({
      [Q]: { total: 3, answers: { sidebar: 2, 'bottom-bar': 1 } },
      '2027-01-example': { total: 1, answers: { yes: 1 } },
    });
  });

  it('is empty with no votes, and still answers before the votes table exists', async () => {
    expect((await stats()).votes).toEqual({});
    db.exec('DROP TABLE votes');
    const res = await worker.fetch(new Request(`https://collector.example.com/stats?token=${TOKEN}`), env);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { votes: unknown }).votes).toEqual({});
  });

  it('still needs the token', async () => {
    const res = await worker.fetch(new Request('https://collector.example.com/stats?token=wrong'), env);
    expect(res.status).toBe(401);
  });
});
