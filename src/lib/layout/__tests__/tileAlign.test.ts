import { tileAlign } from '../tileAlign';

const COLS = 48, ROWS = 27;
const tile = (x: number, y: number, w = 12, h = 6) => ({ x, y, w, h });

describe('tileAlign (#988)', () => {
  it('a tile in a screen corner hugs that corner both ways', () => {
    expect(tileAlign(tile(0, 0), COLS, ROWS)).toEqual({ x: 'left', y: 'top' });
    expect(tileAlign(tile(36, 0), COLS, ROWS)).toEqual({ x: 'right', y: 'top' });
    expect(tileAlign(tile(0, 21), COLS, ROWS)).toEqual({ x: 'left', y: 'bottom' });
    expect(tileAlign(tile(36, 21), COLS, ROWS)).toEqual({ x: 'right', y: 'bottom' });
  });

  it('anywhere else it is centred both ways, edges alone included', () => {
    expect(tileAlign(tile(18, 10), COLS, ROWS)).toEqual({ x: 'center', y: 'middle' });
    expect(tileAlign(tile(0, 10), COLS, ROWS)).toEqual({ x: 'center', y: 'middle' });
    expect(tileAlign(tile(18, 0), COLS, ROWS)).toEqual({ x: 'center', y: 'middle' });
  });

  it('a wide tile in a corner (more than a third of the width) stays centred', () => {
    expect(tileAlign(tile(24, 0, 24, 8), COLS, ROWS)).toEqual({ x: 'center', y: 'middle' });
    expect(tileAlign(tile(0, 0, 17, 8), COLS, ROWS)).toEqual({ x: 'center', y: 'middle' });
    expect(tileAlign(tile(0, 0, 16, 8), COLS, ROWS)).toEqual({ x: 'left', y: 'top' });
  });

  it('the setting overrides either axis, and auto leaves it', () => {
    expect(tileAlign(tile(0, 0), COLS, ROWS, { x: 'right', y: 'bottom' })).toEqual({ x: 'right', y: 'bottom' });
    expect(tileAlign(tile(18, 10), COLS, ROWS, { x: 'left' })).toEqual({ x: 'left', y: 'middle' });
    expect(tileAlign(tile(0, 0), COLS, ROWS, { x: 'auto', y: 'middle' })).toEqual({ x: 'left', y: 'middle' });
  });
});
