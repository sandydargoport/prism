/**
 * Busy days on the arc (#910): labels never overlap, and what does not fit
 * folds into "+N".
 */
import { LABELS, placeLabels, type Rect } from '../labels';

const intersect = (a: Rect, b: Rect) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

/** n events crowded into a stretch of the arc, labels about 150px wide. */
function crowd(n: number, from = 300, step = 40) {
  return Array.from({ length: n }, (_, i) => ({ id: `e${i}`, x: from + i * step, y: 400 - (i % 3) * 10, width: 150, height: 28 }));
}

describe('placeLabels', () => {
  it('places a quiet day straight above each bead', () => {
    const { placed, folded } = placeLabels([
      { id: 'a', x: 300, y: 400, width: 120, height: 28 },
      { id: 'b', x: 900, y: 380, width: 120, height: 28 },
    ], { width: 1800 });
    expect(folded).toEqual([]);
    for (const p of placed) expect(p.tier).toBe(0);
    expect(placed[0]!.left + placed[0]!.width / 2).toBeCloseTo(300, 5);
  });

  it('gives 12 crowded events labels that never overlap, and folds the rest into +N', () => {
    const items = crowd(12);
    const { placed, folded } = placeLabels(items, { width: 1800 });
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) expect(intersect(placed[i]!, placed[j]!)).toBe(false);
    }
    expect(placed.length + folded.length).toBe(12);
    expect(folded.length).toBeGreaterThan(0);
    expect(placed.length).toBeLessThanOrEqual(LABELS.max);
  });

  it('keeps every label inside the box', () => {
    const items = [{ id: 'edge', x: 20, y: 400, width: 160, height: 28 }, ...crowd(5, 1700, 20)];
    const { placed } = placeLabels(items, { width: 1800 });
    for (const p of placed) {
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.left + p.width).toBeLessThanOrEqual(1800);
    }
  });

  it('lifts a label a tier, with a leader, rather than drop it when there is room above', () => {
    // b's own row is taken on both sides: a on the left, the sunset label on the right.
    const items = [
      { id: 'a', x: 500, y: 400, width: 200, height: 28 },
      { id: 'b', x: 620, y: 400, width: 200, height: 28 },
    ];
    const sunsetLabel = { left: 612, top: 350, width: 400, height: 40 };
    const { placed, folded } = placeLabels(items, { width: 1800, obstacles: [sunsetLabel] });
    expect(folded).toEqual([]);
    expect(placed.find((p) => p.id === 'b')!.leader).toBe(true);
  });

  it('keeps clear of the sun and the sunset label', () => {
    const sun = { left: 440, top: 340, width: 120, height: 60 };
    const { placed } = placeLabels([{ id: 'a', x: 500, y: 400, width: 120, height: 28 }], { width: 1800, obstacles: [sun] });
    for (const p of placed) expect(intersect(p, sun)).toBe(false);
  });

  it('never shows more than the limit, however much room there is', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `w${i}`, x: 100 + i * 170, y: 400, width: 100, height: 28 }));
    const { placed, folded } = placeLabels(items, { width: 1800 });
    expect(placed.length).toBe(LABELS.max);
    expect(folded.length).toBe(10 - LABELS.max);
  });
});
