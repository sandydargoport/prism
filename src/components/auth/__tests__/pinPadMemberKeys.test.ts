/**
 * Structural guard: PIN pads must not key their member list on `id` alone.
 *
 * `/api/family` returns two different shapes. Authenticated callers get real
 * UUIDs; unauthenticated ones get a display-only shape where `id` is
 * deliberately always the empty string and `loginIndex` is the login token
 * instead, so a PIN pad can draw the family without leaking user IDs to anyone
 * who can reach the endpoint.
 *
 * Every pad renders that public shape, which means keying a list on `id` gives
 * every member the SAME key. React then reuses DOM nodes between them and the
 * list renders one member's avatar against another's name. It looks like
 * duplicated people rather than a keying fault, which is why it survived in
 * three separate components at once — away mode, babysitter mode, and the
 * settings gate — while the original in QuickPinModal was correct all along.
 *
 * A behavioural test per component would not have caught the third copy, let
 * alone a fourth. This reads the source instead.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__' && entry !== 'node_modules') walk(full, out);
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** A component renders the pre-auth family list if it reads `loginIndex`. */
function usesPublicFamilyShape(text: string): boolean {
  return /loginIndex/.test(text);
}

/** `key={x.id}` with no fallback — the defect. */
const BARE_ID_KEY = /key=\{\s*(\w+)\.id\s*\}/g;

describe('PIN pad member list keys', () => {
  const files = walk(SRC).map((f) => ({
    file: relative(process.cwd(), f),
    text: readFileSync(f, 'utf8'),
  }));

  it('finds the components that render the pre-auth family list', () => {
    // Guards the guard: if this drops to zero the check below passes vacuously.
    expect(files.filter((f) => usesPublicFamilyShape(f.text)).length).toBeGreaterThan(0);
  });

  it('never keys a member list on `id` alone where ids can be blank', () => {
    const offenders: string[] = [];
    for (const { file, text } of files) {
      if (!usesPublicFamilyShape(text)) continue;
      for (const m of text.matchAll(BARE_ID_KEY)) {
        offenders.push(`${file}: key={${m[1]}.id}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
