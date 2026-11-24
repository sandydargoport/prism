import {
  compare, countHits, findRetired, markdownSegments, readBaseline, report, scan, tsxSegments,
} from '../../../scripts/ui-words/check';

/**
 * Retired UI words (#1337): the check finds a retired word in UI text and
 * fails, passes text without one, and the repo's count matches the committed
 * baseline (scripts/ui-words-baseline.json). This test is how CI runs it.
 */
const words = (file: string, source: string) =>
  findRetired(file, file.endsWith('.md') ? markdownSegments(source) : tsxSegments(source)).map((h) => h.word);

describe('retired UI words', () => {
  it('fails on a retired word in new UI text', () => {
    const hits = findRetired('src/New.tsx', tsxSegments('export const A = () => <label>Rest after</label>;'));
    const changes = compare({}, countHits(hits));
    expect(changes.increases).toEqual([{ file: 'src/New.tsx', word: 'Rest after', baseline: 0, now: 1 }]);
    expect(report(changes, hits)).toContain('src/New.tsx:1: Rest after');
  });

  it('passes UI text with no retired word', () => {
    const hits = findRetired('src/New.tsx', tsxSegments('export const A = () => <label>Idle after 2 min</label>;'));
    expect(compare({}, countHits(hits))).toEqual({ increases: [], decreases: [] });
  });

  it('reads labels in string literals and attributes a user sees', () => {
    expect(words('a.tsx', `const o = [{ value: 'dashboard', label: 'Dim this dashboard' }];
      const b = <Field label="Base dashboard" aria-label="How dark at night" />;
      const c = cond ? 'Resting' : \`Screensaver for \${name}\`;`))
      .toEqual(['Dim this dashboard', 'Base dashboard', 'How dark', 'Resting', 'screensaver']);
  });

  it('skips code: comments, keys, mode values, class names, imports and storage keys', () => {
    expect(words('a.tsx', `// The resting screen, see Screensaver
      /** Rest after, How dark */
      import { Screensaver } from '@/components/screensaver/Screensaver';
      const k = 'prism-screensaver-enabled';
      localStorage.getItem('Screensaver on');
      if (mode === 'resting' || state === 'Resting state') {}
      const x = { 'Rest after': 1 };
      type M = 'Idle screen' | 'calm';
      const el = <div className="screensaver resting" data-state="Resting now" />;`)).toEqual([]);
  });

  it('leaves plain English alone and catches the state names', () => {
    expect(words('a.md', 'If you still see it, reload. Events vanish partway through the day. One calm list.')).toEqual([]);
    expect(words('a.md', 'Tap **See it** in Through the day. A calm dashboard goes calm. See it at a screen size.'))
      .toEqual(['calm', 'calm', 'See it', 'Through the day']);
  });

  it('skips code and link targets in the docs', () => {
    expect(words('a.md', 'Set `prism-screensaver-on`, see [Layouts](DASHBOARD.md#screensaver-layout).\n```\nRest after\n```')).toEqual([]);
  });

  it('matches the baseline: lower it when you remove a word, never raise it', () => {
    const hits = scan();
    const changes = compare(readBaseline(), countHits(hits));
    expect(report(changes, hits)).toBe('');
  });
});
