/**
 * Which side a sheet opens on, from where the wall was touched (#908).
 */
import { sheetSide } from '../dialog';

describe('sheetSide', () => {
  it('opens on the left or right for a touch in that third', () => {
    expect(sheetSide(100, 1920)).toBe('left');
    expect(sheetSide(1800, 1920)).toBe('right');
  });
  it('opens from the bottom for a touch in the middle, or when nothing was touched', () => {
    expect(sheetSide(960, 1920)).toBe('bottom');
    expect(sheetSide(null, 1920)).toBe('bottom');
    expect(sheetSide(500, 0)).toBe('bottom');
  });
});
