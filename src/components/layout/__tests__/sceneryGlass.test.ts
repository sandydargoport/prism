/**
 * @jest-environment jsdom
 */
import fs from 'fs';
import path from 'path';
import { wallpaperPool } from '../WallpaperBackground';
import { getWidgetStyle, getTextColorClass, isSeeThroughFill } from '../grid/gridWidgetStyles';
import { SCENERY } from '@/lib/scenery';
import { FIRST_SCREEN_TEMPLATE } from '@/lib/constants/layoutTemplates';

// #808 part 2: new installs show bundled park scenery behind glass cards
// until the household adds photos; existing installs keep their background.

jest.mock('@/lib/hooks/usePhotos', () => ({ usePhotos: () => ({ photos: [], loading: false }) }));
jest.mock('@/lib/hooks/useScreenOrientation', () => ({ useScreenOrientation: () => 'landscape' }));

const ROOT = path.resolve(__dirname, '../../../..');

describe('wallpaperPool', () => {
  it('shows the bundled scenery on a new install with no photos', () => {
    const { items, scenery } = wallpaperPool([], false, true);
    expect(scenery).toBe(true);
    expect(items.map((i) => i.src)).toEqual(SCENERY.map((s) => s.src));
  });

  it('shows nothing extra on an install that never turned scenery on', () => {
    expect(wallpaperPool([], false, false)).toEqual({ items: [], scenery: false });
  });

  it("prefers the household's own photos as soon as there are any", () => {
    const { items, scenery } = wallpaperPool([{ id: 'p1' }], false, true);
    expect(scenery).toBe(false);
    expect(items).toEqual([{ id: 'p1', src: '/api/photos/p1/file' }]);
  });

  it('waits for photos to load, so a household with photos never flashes scenery', () => {
    expect(wallpaperPool([], true, true).items).toEqual([]);
  });
});

describe('bundled scenery files', () => {
  it('every listed photo ships, and is credited', () => {
    const credits = fs.readFileSync(path.join(ROOT, 'public/scenery/CREDITS.md'), 'utf8');
    expect(SCENERY.length).toBeGreaterThanOrEqual(4);
    for (const s of SCENERY) {
      const file = path.join(ROOT, 'public', s.src);
      expect([s.id, fs.existsSync(file)]).toEqual([s.id, true]);
      expect([s.id, fs.statSync(file).size < 800 * 1024]).toEqual([s.id, true]);
      expect(credits).toContain(`\`${s.id}.webp\``);
    }
  });
});

describe('Glass fill', () => {
  it('is the theme card colour, see-through, with the blur from the design tokens', () => {
    const style = getWidgetStyle({ i: 'clock', x: 0, y: 0, w: 1, h: 1, backgroundColor: 'glass' });
    expect(style?.backgroundColor).toBe('hsl(var(--card) / var(--ds-glass-alpha))');
    expect(style?.backdropFilter).toBe('var(--ds-glass-filter)');
  });

  it('keeps the theme text colour, like frosted', () => {
    expect(isSeeThroughFill('glass')).toBe(true);
    expect(getTextColorClass({ i: 'clock', x: 0, y: 0, w: 1, h: 1, backgroundColor: 'glass' }, 'fallback')).toBe('fallback');
  });

  it("is the new install's card fill", () => {
    for (const w of FIRST_SCREEN_TEMPLATE.widgets) expect([w.i, w.backgroundColor]).toEqual([w.i, 'glass']);
  });
});
