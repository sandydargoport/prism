import fs from 'fs';
import os from 'os';
import path from 'path';
import { findRetired, markdownSegments, report, scan, tsxSegments } from '../../../scripts/ui-words/check';

/**
 * Retired UI words (#1337), zero tolerance (#1352): the check finds a retired
 * word in UI text, passes text without one, finds none in the repo, and one
 * planted retired word anywhere it reads fails it. There is no baseline.
 * This test is how CI runs it.
 */
const words = (file: string, source: string) =>
  findRetired(file, file.endsWith('.md') ? markdownSegments(source) : tsxSegments(source)).map((h) => h.word);

describe('retired UI words', () => {
  it('fails on a retired word in new UI text, and says what to write instead', () => {
    const hits = findRetired('src/New.tsx', tsxSegments('export const A = () => <label>Rest after</label>;'));
    expect(hits.map((h) => h.word)).toEqual(['Rest after']);
    expect(report(hits)).toContain('src/New.tsx:1: "Rest after" (use: "Idle after 2 min"');
  });

  it('passes UI text with no retired word', () => {
    const hits = findRetired('src/New.tsx', tsxSegments('export const A = () => <label>Idle after 2 min</label>;'));
    expect(hits).toEqual([]);
    expect(report(hits)).toBe('');
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

  it('finds no retired word in the repo', () => {
    expect(report(scan())).toBe('');
  });

  describe('zero tolerance: one planted retired word fails it', () => {
    let root: string;
    const write = (file: string, text: string) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    };
    beforeEach(() => {
      // A clean copy of the places the check reads.
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-words-'));
      write('src/app/Page.tsx', 'export const P = () => <p>Idle after 2 min</p>;');
      write('src/i18n/messages/en.json', '{\n  "idle": "Idle after"\n}\n');
      write('docs/HELP.md', 'Open More > Edit layout > Screen > When idle.\n');
      write('docs/features/DISPLAY-MODES.md', 'A photo frame, the night sky.\n');
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('passes the clean copy', () => {
      expect(scan(root)).toEqual([]);
    });

    it.each([
      ['src/app/Page.tsx', 'export const P = () => <p>Screensaver</p>;', 'screensaver'],
      ['src/i18n/messages/en.json', '{\n  "idle": "Resting"\n}\n', 'Resting'],
      ['docs/HELP.md', 'Open More > Edit layout > Through the day.\n', 'Through the day'],
      ['docs/features/DISPLAY-MODES.md', 'Pick the **Base dashboard**.\n', 'Base dashboard'],
    ])('a retired word in %s fails it', (file, text, word) => {
      write(file, text);
      const hits = scan(root);
      expect(hits.map((h) => [h.file, h.word])).toEqual([[file, word]]);
      expect(report(hits)).toMatch(/^1 retired UI word/);
    });
  });
});
