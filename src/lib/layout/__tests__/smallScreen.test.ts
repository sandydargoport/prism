/**
 * #803: on a small screen a "Hide first" widget drops out and the rows and
 * columns only it used close up, so the rest grow into the room.
 */
import { isSmallScreen, layoutForSmallScreen } from '../smallScreen';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

const w = (i: string, x: number, y: number, ww: number, h: number, extra: Partial<WidgetConfig> = {}) =>
  ({ i, x, y, w: ww, h, ...extra }) as WidgetConfig;
const pos = (l: WidgetConfig[]) => Object.fromEntries(l.filter((x) => x.visible !== false).map((x) => [x.i, [x.x, x.y, x.w, x.h]]));

describe('isSmallScreen', () => {
  it('is small below about three quarters of a full wall, either way up', () => {
    expect(isSmallScreen(1280, 720)).toBe(true);
    expect(isSmallScreen(1366, 768)).toBe(true);
    expect(isSmallScreen(1600, 900)).toBe(false);
    expect(isSmallScreen(1920, 1080)).toBe(false);
    expect(isSmallScreen(1920, 1200)).toBe(false);
    expect(isSmallScreen(720, 1280)).toBe(true);
    expect(isSmallScreen(1080, 1920)).toBe(false);
    expect(isSmallScreen(0, 0)).toBe(false); // not measured yet
  });
});

describe('layoutForSmallScreen', () => {
  it('drops a bottom strip and leaves the rest where they are, so they grow down into it', () => {
    const out = layoutForSmallScreen([
      w('calendar', 0, 0, 8, 8), w('weather', 8, 0, 4, 4), w('chores', 8, 4, 4, 4),
      w('quote', 0, 8, 12, 2, { hideOnSmallScreen: true }),
    ]);
    expect(pos(out)).toEqual({ calendar: [0, 0, 8, 8], weather: [8, 0, 4, 4], chores: [8, 4, 4, 4] });
    expect(out.find((x) => x.i === 'quote')!.visible).toBe(false);
  });

  it('closes up a row band in the middle, moving what is below it up', () => {
    const out = layoutForSmallScreen([
      w('clock', 0, 0, 12, 2), w('photo', 0, 2, 12, 3, { hideOnSmallScreen: true }), w('tasks', 0, 5, 12, 4),
    ]);
    expect(pos(out)).toEqual({ clock: [0, 0, 12, 2], tasks: [0, 2, 12, 4] });
  });

  it('closes up a column only that widget used', () => {
    const out = layoutForSmallScreen([
      w('calendar', 0, 0, 8, 6), w('photo', 8, 0, 2, 6, { hideOnSmallScreen: true }), w('tasks', 10, 0, 2, 6),
    ]);
    expect(pos(out)).toEqual({ calendar: [0, 0, 8, 6], tasks: [8, 0, 2, 6] });
  });

  it('keeps a row another widget shares, and a gap the design left on purpose', () => {
    const out = layoutForSmallScreen([
      w('calendar', 0, 0, 8, 4), w('weather', 8, 0, 4, 2, { hideOnSmallScreen: true }),
      w('tasks', 0, 6, 12, 2), // rows 4 and 5 are empty in the design
    ]);
    expect(pos(out)).toEqual({ calendar: [0, 0, 8, 4], tasks: [0, 6, 12, 2] });
  });

  it('changes nothing when no widget is set, or when every one is', () => {
    const plain = [w('a', 0, 0, 6, 4), w('b', 6, 0, 6, 4)];
    expect(layoutForSmallScreen(plain)).toBe(plain);
    const all = [w('a', 0, 0, 6, 4, { hideOnSmallScreen: true }), w('b', 6, 0, 6, 4, { hideOnSmallScreen: true })];
    expect(layoutForSmallScreen(all)).toBe(all);
  });
});
