/**
 * Structural guard: Google scope URLs live in exactly one file.
 *
 * Prism requests scopes from several places that must agree — two browser
 * sign-in flows, the Gmail flow, the setup screen telling a manual/Playground
 * user what to paste, and the validator reading the resulting token back. When
 * each held its own copy, #312 changed the validator alone and left the setup
 * screen advertising something it would now reject. No file was wrong on its
 * own, so nothing caught it.
 *
 * A behavioural test cannot catch that class of bug, because the copies are
 * only inconsistent with each other. This one reads the source instead.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(process.cwd(), 'src');
const HOME = join('src', 'lib', 'integrations', 'googleScopes.ts');

/** Any Google OAuth scope URL, e.g. https://www.googleapis.com/auth/tasks */
const SCOPE_URL = /googleapis\.com\/auth\/[\w.]+/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Tests may name scopes literally: pinning the exact URL a token must
      // carry is the point of those assertions, not a duplicate definition.
      if (entry !== '__tests__') walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('Google scope definitions', () => {
  const offenders = walk(SRC)
    .map((f) => ({ file: relative(process.cwd(), f), text: readFileSync(f, 'utf8') }))
    .filter(({ file }) => file !== HOME)
    .map(({ file, text }) => ({ file, hits: [...new Set(text.match(SCOPE_URL) ?? [])] }))
    .filter(({ hits }) => hits.length > 0);

  it('appear only in googleScopes.ts', () => {
    // If this fails: import the scope from googleScopes.ts instead of writing
    // the URL again. Add it there first if it is genuinely new.
    expect(offenders.map((o) => `${o.file}: ${o.hits.join(', ')}`)).toEqual([]);
  });

  it('are actually defined there, so the guard cannot pass by being empty', () => {
    const home = readFileSync(join(process.cwd(), HOME), 'utf8');
    expect([...new Set(home.match(SCOPE_URL) ?? [])].length).toBeGreaterThanOrEqual(6);
  });
});
