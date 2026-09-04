/**
 * The rotation rule fixes HOW MANY widgets are showing, never which ones
 * deserve to be — that is what lets the screensaver move without the grid
 * needing any notion of priority.
 */
import { showingCount, rotate } from '../screensaverRotation';

describe('showingCount', () => {
  it.each([
    [0, 0], [1, 1], [2, 2], [3, 2], [4, 2], [5, 2],
    [6, 2], [8, 3], [11, 5], [12, 5], [16, 7],
  ])('%i widgets -> %i showing', (total, expected) => {
    expect(showingCount(total)).toBe(expected);
  });

  it('never asks for more widgets than exist', () => {
    for (let n = 0; n < 40; n++) expect(showingCount(n)).toBeLessThanOrEqual(n);
  });

  it('is just under half once there are enough to choose from', () => {
    for (let n = 6; n < 40; n++) expect(showingCount(n)).toBeLessThan(n / 2 + 1);
  });
});

describe('rotate', () => {
  const all = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];   // -> 3 showing

  it('fills up to the target before it starts swapping', () => {
    let showing: string[] = [];
    showing = rotate(all, showing, () => 0);
    showing = rotate(all, showing, () => 0);
    showing = rotate(all, showing, () => 0);
    expect(showing).toHaveLength(showingCount(all.length));
  });

  it('holds the count steady once it is there', () => {
    let showing = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) showing = rotate(all, showing);
    expect(showing).toHaveLength(3);
  });

  it('swaps exactly one widget per turn', () => {
    const showing = ['a', 'b', 'c'];
    const next = rotate(all, showing);
    const kept = next.filter((id) => showing.includes(id));
    expect(kept).toHaveLength(2);
    expect(next).toHaveLength(3);
  });

  it('never shows the same widget twice', () => {
    let showing = ['a', 'b', 'c'];
    for (let i = 0; i < 200; i++) {
      showing = rotate(all, showing);
      expect(new Set(showing).size).toBe(showing.length);
    }
  });

  it('gives every widget a turn rather than cycling a favourite few', () => {
    let showing = ['a', 'b', 'c'];
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
