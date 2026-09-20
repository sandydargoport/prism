/**
 * Structural guard: family members are ordered one way, in one place.
 *
 * `/api/family` gives the unauthenticated PIN pad an ordinal `loginIndex`
 * rather than a UUID, and `/api/auth/login` and `/api/auth/verify-pin` turn
 * that ordinal back into a member by running the same query again. The three
 * agree only as long as the ordering is total. `sortOrder` and `createdAt`
 * both repeat across members written in one statement, and SQL may return
 * tied rows in any order, so the pad could show one member, post their index,
 * and have the server resolve it to a different one.
 *
 * A behavioural test cannot see this: it needs two runs of the same query to
 * disagree, which is exactly what a planner is free to do and usually does
 * not. So this reads the source, the way the PIN pad key guard does.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { PgDialect } from 'drizzle-orm/pg-core';
import { memberOrder } from '../memberOrder';

const SRC = join(process.cwd(), 'src');
const dialect = new PgDialect();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__' && entry !== 'node_modules') walk(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** An `.orderBy(...)` call, with whatever it was handed. */
const ORDER_BY = /\.orderBy\(([\s\S]*?)\)\s*[;.\n]/g;

describe('family member ordering', () => {
  it('breaks ties on the primary key', () => {
    const rendered = memberOrder.map((clause) => dialect.sqlToQuery(clause).sql);
    expect(rendered).toHaveLength(3);
    expect(rendered[0]).toMatch(/sort_order.*asc/i);
    expect(rendered[1]).toMatch(/created_at.*asc/i);
    // The last one is the point: `id` is the primary key, so there is no tie
    // left for the database to resolve however it likes.
    expect(rendered[2]).toMatch(/"id".*asc/i);
  });

  const files = walk(SRC)
    .filter((f) => !f.endsWith(join('lib', 'db', 'memberOrder.ts')))
    .map((f) => ({ file: relative(process.cwd(), f), text: readFileSync(f, 'utf8') }));

  it('finds the queries that order users', () => {
    // Guards the guard: if this drops to zero the check below passes vacuously
    // because nothing orders members at all any more.
    const ordering = files.filter((f) => /memberOrder/.test(f.text));
    expect(ordering.length).toBeGreaterThan(0);
  });

  it('never spells the ordering out at a call site', () => {
    const offenders: string[] = [];
    for (const { file, text } of files) {
      for (const match of text.matchAll(ORDER_BY)) {
        const args = match[1] ?? '';
        // `${users.sortOrder}` inside a sql template is a different query
        // ordering something other than the member list, which has its own
        // tiebreak; the defect is handing the columns to orderBy directly.
        if (/(?<!\$\{)users\.sortOrder/.test(args)) {
          offenders.push(`${file}: .orderBy(${args.trim()})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
