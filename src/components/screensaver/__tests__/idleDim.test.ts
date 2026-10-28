/**
 * Dim when idle (#691): how dark the idle screen is, and when.
 */
import { dimAt, dimLevel, inDimHours } from '../idleDim';

// Local time on the test's own clock, as the screen reads its own.
const at = (h: number, m = 0) => new Date(2026, 9, 28, h, m);

describe('dimLevel', () => {
  it('is off when nothing, or nothing it knows, is stored', () => {
    expect(dimLevel(null)).toBe(0);
    expect(dimLevel('1')).toBe(0);
    expect(dimLevel('half')).toBe(0);
    expect(dimLevel('0.5')).toBe(0.5);
  });
});

describe('inDimHours', () => {
  it('runs from the start hour up to, not including, the end hour across midnight', () => {
    expect(inDimHours('22-7', at(21, 59))).toBe(false);
    expect(inDimHours('22-7', at(22, 0))).toBe(true);
    expect(inDimHours('22-7', at(0, 30))).toBe(true);
    expect(inDimHours('22-7', at(6, 59))).toBe(true);
    expect(inDimHours('22-7', at(7, 0))).toBe(false);
    expect(inDimHours('22-7', at(12, 0))).toBe(false);
  });

  it('is all day when asked, and 10 pm to 7 am when nothing it knows is stored', () => {
    expect(inDimHours('always', at(12, 0))).toBe(true);
    expect(inDimHours(null, at(23, 0))).toBe(true);
    expect(inDimHours('9-17', at(12, 0))).toBe(false);
  });
});

describe('dimAt', () => {
  it('dims to the level inside the hours and not at all outside them', () => {
    expect(dimAt('0.7', '21-7', at(21, 30))).toBe(0.7);
    expect(dimAt('0.7', '21-7', at(8, 0))).toBe(0);
    expect(dimAt(null, 'always', at(8, 0))).toBe(0);
  });
});
