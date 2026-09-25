/**
 * The Docker init seed (03-seed.sql) writes the first dashboard a fresh
 * Compose install shows. It is plain SQL, so nothing type-checks it against
 * the layout grid. It once carried a layout in the old four-column units,
 * which the load-time migration in useLayouts scales up to a tall 48x72 grid
 * that letterboxes and overflows a landscape screen.
 *
 * These checks pin it to DEFAULT_TEMPLATE, in current units, inside the
 * landscape canvas.
 */
import fs from 'fs';
import path from 'path';
import { DEFAULT_TEMPLATE } from '@/lib/constants/layoutTemplates';

type Widget = { i: string; x: number; y: number; w: number; h: number };

function seedDefaultLayoutWidgets(): Widget[] {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'init', '03-seed.sql'), 'utf8');
  const match = sql.match(/\('Default Dashboard',[^']*'landscape',\s*'(\[[^']*\])'/);
  if (!match?.[1]) throw new Error("03-seed.sql: 'Default Dashboard' insert not found in the expected shape");
  return JSON.parse(match[1]) as Widget[];
}

describe('03-seed.sql default layout', () => {
  const widgets = seedDefaultLayoutWidgets();

  it('matches DEFAULT_TEMPLATE', () => {
    expect(widgets).toEqual(DEFAULT_TEMPLATE.widgets);
  });

  it('is in current 48-column units, so the legacy migration never rescales it', () => {
    // useLayouts treats a layout at most 12 columns wide as old units.
    expect(Math.max(...widgets.map((w) => w.x + w.w))).toBeGreaterThan(12);
  });

  it('fits the 48x27 landscape canvas', () => {
    expect(Math.max(...widgets.map((w) => w.x + w.w))).toBeLessThanOrEqual(48);
    expect(Math.max(...widgets.map((w) => w.y + w.h))).toBeLessThanOrEqual(27);
  });
});
