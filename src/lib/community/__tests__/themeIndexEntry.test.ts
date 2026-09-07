/**
 * The row that decides what a gallery card says.
 *
 * The number worth pinning is `contrastWarnings`. It is the one piece of
 * judgement the card offers someone deciding whether to install a theme, and
 * the README promises it is about the eight text pairs — "text has to be
 * readable". Counting edge pairs there would put a warning on Snow Day, a
 * built-in whose whole design is having no borders at all, and a warning that
 * fires on a deliberate style is a warning people learn to ignore.
 */
import { buildThemeIndexEntry } from '../validateTheme';
import type { ContrastIssue } from '@/lib/themes/contrast';

const text = (ratio: number): ContrastIssue =>
  ({ pair: 'muted-foreground on muted', ratio, level: 'warning', kind: 'text' });
const edge = (ratio: number): ContrastIssue =>
  ({ pair: 'border against background', ratio, level: 'warning', kind: 'edge' });

const theme = {
  id: 'harvest-dusk',
  name: 'Harvest Dusk',
  description: 'Warm golds going to brown.',
  author: 'Someone',
  tags: ['warm', 'autumn'],
};

describe('buildThemeIndexEntry', () => {
  it('counts text-contrast warnings', () => {
    const entry = buildThemeIndexEntry(theme, [text(3.4), text(4.1)], '2026-09-05');
    expect(entry.contrastWarnings).toBe(2);
  });

  it('does not count subtle borders against a theme', () => {
    // Snow Day ships with borderWidth 0 on purpose.
    const entry = buildThemeIndexEntry(theme, [edge(1.1), edge(1.2)], '2026-09-05');
    expect(entry.contrastWarnings).toBe(0);
  });

  it('counts only the text half of a mixed set', () => {
    const entry = buildThemeIndexEntry(theme, [text(3.9), edge(1.28), edge(1.3)], '2026-09-05');
    expect(entry.contrastWarnings).toBe(1);
  });

  it('derives the filename from the id, not the name', () => {
    // The name is submitter-controlled text and may contain anything the name
    // pattern allows, including dots and quotes. The id is already slug-guarded.
    const entry = buildThemeIndexEntry({ ...theme, name: "O'Brien's v1.2" }, [], '2026-09-05');
    expect(entry.file).toBe('harvest-dusk.json');
    expect(entry.id).toBe('harvest-dusk');
  });

  it('carries name, description, author, tags and date through unchanged', () => {
    const entry = buildThemeIndexEntry(theme, [], '2026-01-31');
    expect(entry).toEqual({
      id: 'harvest-dusk',
      file: 'harvest-dusk.json',
      name: 'Harvest Dusk',
      description: 'Warm golds going to brown.',
      author: 'Someone',
      tags: ['warm', 'autumn'],
      createdAt: '2026-01-31',
      contrastWarnings: 0,
    });
  });
});
