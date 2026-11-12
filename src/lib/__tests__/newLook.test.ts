/**
 * Today is the one built-in dashboard (#1151): a new install starts on it, and
 * the retired Calendar ready-made dashboard is no longer created.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isBuiltInView, newLookLayouts } from '../newLook';
import { TODAY_TEMPLATE } from '../constants/layoutTemplates';

describe('a new install', () => {
  it('starts on Glance (#1187), the default, and nothing else', () => {
    expect(newLookLayouts().map((l) => [l.name, l.view, l.isDefault])).toEqual([['Glance', 'today', true]]);
  });
});

describe('the built-in dashboard', () => {
  it('is Today only', () => {
    expect(isBuiltInView('today')).toBe(true);
    expect(isBuiltInView('calendar')).toBe(false);
    expect(isBuiltInView('grid')).toBe(false);
    expect(isBuiltInView(null)).toBe(false);
  });
});

// #1187: the built-in dashboard is Glance. "Today" read as the date in a
// sentence ("Today shows today's events"), so nothing a person reads calls the
// dashboard that any more. The date ("Later today", the calendar's Today
// button) is not the dashboard and stays.
describe('the built-in dashboard is called Glance (#1187)', () => {
  const ROOT = path.resolve(__dirname, '../../..');
  const OLD = /Start on Today|starts? on Today|Today is built in|Today, the built-in|built-in \*\*Today\*\*|Today front page|Today's (ink|Widgets|parts)|>Today<\/(h2|span)>|name: 'Today'|\('Today', 'today'\)/;

  it('names the template Glance', () => {
    expect(TODAY_TEMPLATE.name).toBe('Glance');
  });

  it('leaves the old name out of the app and the docs', () => {
    const files = (dir: string, ext: RegExp): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' || e.name === 'archive' ? [] : files(p, ext);
      return ext.test(e.name) ? [p] : [];
    });
    const changelog = fs.readFileSync(path.join(ROOT, 'docs/CHANGELOG.md'), 'utf8');
    const unreleased = changelog.slice(0, changelog.indexOf('\n## ', changelog.indexOf('## Unreleased') + 5));
    const hits = [
      ...files(path.join(ROOT, 'src'), /\.(ts|tsx|json)$/),
      ...files(path.join(ROOT, 'docs'), /\.md$/).filter((f) => !f.endsWith('CHANGELOG.md')),
    ].flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l] as const))
      .filter(([, , l]) => OLD.test(l))
      .map(([f, n, l]) => `${path.relative(ROOT, f)}:${n}: ${l.trim().slice(0, 80)}`);
    if (OLD.test(unreleased)) hits.push(`docs/CHANGELOG.md (Unreleased): ${unreleased.match(OLD)![0]}`);
    expect(hits).toEqual([]);
  });
});
