import { resolveFitMode } from '../fitMode';

// Landscape design canvas for the default 1080p screen: 48 cols x 27 rows.
const LANDSCAPE_ROWS = 27;
// Portrait design canvas: 36 cols x 64 rows.
const PORTRAIT_ROWS = 64;

describe('resolveFitMode', () => {
  it('stretches a landscape layout that fits its canvas on a landscape screen', () => {
    expect(resolveFitMode({
      fitCols: 48, fitRows: 24, targetRows: LANDSCAPE_ROWS,
      designOrientation: 'landscape', screenWide: true,
    })).toBe('stretch');
  });

  it('does not letterbox a landscape layout that runs past its canvas on a landscape screen (#519)', () => {
    // 4 x 6 blocks of 12 units each: taller than wide, far past the 27-row
    // canvas. Letterboxing it shrinks the cells to their floor and the grid
    // overflows its box, clipping top and bottom. It has to scroll instead.
    expect(resolveFitMode({
      fitCols: 48, fitRows: 72, targetRows: LANDSCAPE_ROWS,
      designOrientation: 'landscape', screenWide: true,
    })).toBe('scroll');
  });

  it('still stretches a layout saved as portrait but laid out landscape', () => {
    expect(resolveFitMode({
      fitCols: 48, fitRows: 27, targetRows: PORTRAIT_ROWS,
      designOrientation: 'portrait', screenWide: true,
    })).toBe('stretch');
  });

  it('letterboxes a portrait layout on a landscape screen', () => {
    expect(resolveFitMode({
      fitCols: 36, fitRows: 64, targetRows: PORTRAIT_ROWS,
      designOrientation: 'portrait', screenWide: true,
    })).toBe('contain');
  });

  it('letterboxes a narrow landscape layout that fits its canvas', () => {
    expect(resolveFitMode({
      fitCols: 20, fitRows: 27, targetRows: LANDSCAPE_ROWS,
      designOrientation: 'landscape', screenWide: true,
    })).toBe('contain');
  });

  it('stretches a tall landscape-labelled layout on a portrait screen', () => {
    expect(resolveFitMode({
      fitCols: 48, fitRows: 72, targetRows: LANDSCAPE_ROWS,
      designOrientation: 'landscape', screenWide: false,
    })).toBe('stretch');
  });

  it('always contains in containMode (screensaver)', () => {
    expect(resolveFitMode({
      fitCols: 48, fitRows: 72, targetRows: LANDSCAPE_ROWS,
      designOrientation: 'landscape', screenWide: true, containMode: true,
    })).toBe('contain');
  });

  it('uses the legacy mode without a target canvas or when filling height', () => {
    expect(resolveFitMode({ fitCols: 48, fitRows: 24, screenWide: true })).toBe('legacy');
    expect(resolveFitMode({
      fitCols: 48, fitRows: 24, targetRows: LANDSCAPE_ROWS, screenWide: true, fillHeight: true,
    })).toBe('legacy');
  });
});
