/**
 * The rotation rule fixes HOW MANY widgets are showing, never which ones
 * deserve to be — that is what lets the screensaver move without the grid
 * needing any notion of priority.
 */
import { showingCount, rotate } from '../screensaverRotation';

describe('showingCount', () => {
  it.each([
    [0, 0], [1, 1], [2, 2], [3, 2], [4, 3], [5, 4],
    [6, 4], [8, 6], [11, 8], [12, 8], [16, 11],
  ])('%i widgets -> %i showing', (total, expected) => {
    expect(showingCount(total)).toBe(expected);
  });

  it('never asks for more widgets than exist', () => {
    for (let n = 0; n < 40; n++) expect(showingCount(n)).toBeLessThanOrEqual(n);
  });

  it('leaves a third of the board free to rotate', () => {
    // always leaves something hidden, so there is always something to rotate in
    for (let n = 3; n < 40; n++) expect(showingCount(n)).toBeLessThan(n);
  });
});

describe('rotate', () => {
  const all = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const TARGET = showingCount(all.length);
  /** A settled selection of the right size, whatever the target happens to be. */
  const settled = () => all.slice(0, TARGET);

  it('fills up to the target before it starts swapping', () => {
    let showing: string[] = [];
    for (let i = 0; i < TARGET; i++) showing = rotate(all, showing, () => 0);
    expect(showing).toHaveLength(TARGET);
  });

  it('holds the count steady once it is there', () => {
    let showing = settled();
    for (let i = 0; i < 50; i++) showing = rotate(all, showing);
    expect(showing).toHaveLength(TARGET);
  });

  it('swaps exactly one widget per turn', () => {
    const showing = settled();
    const next = rotate(all, showing);
    const kept = next.filter((id) => showing.includes(id));
    expect(kept).toHaveLength(TARGET - 1);
    expect(next).toHaveLength(TARGET);
  });

  it('never shows the same widget twice', () => {
    let showing = settled();
    for (let i = 0; i < 200; i++) {
      showing = rotate(all, showing);
      expect(new Set(showing).size).toBe(showing.length);
    }
  });

  it('gives every widget a turn rather than cycling a favourite few', () => {
    let showing = settled();
    const seen = new Set(showing);
    for (let i = 0; i < 400; i++) { showing = rotate(all, showing); showing.forEach((id) => seen.add(id)); }
    expect(seen.size).toBe(all.length);
  });

  it('drops widgets that have left the layout', () => {
    const next = rotate(['a', 'b', 'c', 'd'], ['a', 'zz', 'b']);
    expect(next).not.toContain('zz');
  });

  it('shows everything when the layout is smaller than the target', () => {
    let showing: string[] = [];
    for (let i = 0; i < 5; i++) showing = rotate(['a', 'b'], showing);
    expect(showing.sort()).toEqual(['a', 'b']);
  });
});

describe('pouring across the board', () => {
  // three columns, two widgets in each — the shape a real layout takes
  const grid: Record<string, number> = {
    a: 0, d: 0,
    b: 16, e: 16,
    c: 32, f: 32,
  };
  const ids = Object.keys(grid);
  const colOf = (id: string) => grid[id]!;

  it('hands over across the board, not to the widget in its own column', () => {
    for (let i = 0; i < 60; i++) {
      const showing = ['a', 'b', 'c'];
      const next = rotate(ids, showing, Math.random, 3, 3, colOf);
      const left = showing.find((id) => !next.includes(id))!;
      const arrived = next.find((id) => !showing.includes(id))!;
      expect(colOf(arrived)).not.toBe(colOf(left));
    }
  });

  it('does not settle into the same pairing every time', () => {
    const seen = new Set<string>();
    let showing = ['a', 'b', 'c'];
    let last: string | undefined;
    for (let i = 0; i < 80; i++) {
      const next = rotate(ids, showing, Math.random, 3, 3, colOf, last);
      const left = showing.find((id) => !next.includes(id))!;
      const arrived = next.find((id) => !showing.includes(id))!;
      seen.add(`${left}->${arrived}`);
      last = arrived;
      showing = next;
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('never repeats the arrival it just made when it has a choice', () => {
    let showing = ['a', 'b', 'c'];
    let last: string | undefined;
    for (let i = 0; i < 60; i++) {
      const next = rotate(ids, showing, Math.random, 3, 3, colOf, last);
      const arrived = next.find((id) => !showing.includes(id))!;
      if (last) expect(arrived).not.toBe(last);
      last = arrived;
      showing = next;
    }
  });

  it('still swaps exactly one, and never duplicates', () => {
    let showing = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      const next = rotate(ids, showing, Math.random, 3, 3, colOf);
      expect(next).toHaveLength(3);
      expect(new Set(next).size).toBe(3);
      expect(next.filter((id) => showing.includes(id))).toHaveLength(2);
      showing = next;
    }
  });

  it('falls back gracefully when everything shares a column', () => {
    const flat = () => 0;
    const next = rotate(['x', 'y', 'z'], ['x', 'y'], Math.random, 2, 2, flat);
    expect(next).toHaveLength(2);
  });
});
