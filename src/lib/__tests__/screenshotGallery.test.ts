/**
 * The docs gallery shows what a family sees, in a new install's looks (#878).
 * scripts/screenshot-specs.ts is the list scripts/capture-screenshots.ts
 * shoots; these check the gallery part of it.
 */
import fs from 'node:fs';
import {
  DAY_SHOTS, GALLERY_SHOTS, HERO_SHOTS, PHOTOS, STAGE_LAYOUTS, scenerySource, themeOf,
} from '../../../scripts/screenshot-specs';
import { LOOK_IDS } from '../looks';
import { SCENERY } from '../scenery';

/** Pages a family uses day to day. Everything else is settings, admin or editing. */
const FAMILY_PAGES = ['/', '/calendar', '/shopping'];

const names = GALLERY_SHOTS.map((s) => s.name);
const shot = (name: string) => GALLERY_SHOTS.find((s) => s.name === name)!;

describe('the docs gallery', () => {
  it('shoots the Simple wall, a kitchen layout, the idle screen, three widgets and the phone', () => {
    expect([...names].sort()).toEqual(
      [
        'wall-simple', 'wall-night', 'wall-kitchen',
        'idle-screen',
        'widget-calendar', 'widget-chores', 'widget-shopping',
        'phone-home', 'phone-calendar', 'phone-shopping',
      ].sort(),
    );
  });

  it('leaves the old three-widget grid in each look out (#1142)', () => {
    for (const look of LOOK_IDS) expect(names).not.toContain(`look-${look}`);
    const walls = GALLERY_SHOTS.filter((s) => s.device === 'wall' && !s.widget && !s.idle);
    for (const s of walls) expect([s.name, s.stage?.layout]).not.toEqual([s.name, 'gallery']);
  });

  it('still shows every look a new install offers', () => {
    const looks = new Set(GALLERY_SHOTS.filter((s) => s.name.startsWith('wall-')).map((s) => s.stage?.look));
    expect([...looks].sort()).toEqual([...LOOK_IDS].sort());
  });

  it('stages each wall on the dashboard and in the look it names', () => {
    expect([shot('wall-simple').stage, shot('wall-night').stage, shot('wall-kitchen').stage]).toEqual([
      { look: 'photo', layout: 'simple' },
      { look: 'night', layout: 'simple' },
      { look: 'paper', layout: 'kitchen' },
    ]);
  });

  it('shows no admin or editing page', () => {
    for (const s of GALLERY_SHOTS) expect([s.name, FAMILY_PAGES.includes(s.url)]).toEqual([s.name, true]);
  });

  it('shoots the wall signed out with the rail and top bar hidden', () => {
    const wall = GALLERY_SHOTS.filter((s) => s.device === 'wall');
    expect(wall.length).toBe(7);
    for (const s of wall) expect([s.name, s.signedOut, s.idleChrome]).toEqual([s.name, true, true]);
  });

  it('draws the Night look dark and the others light', () => {
    expect(themeOf(shot('wall-night'))).toBe('dark');
    expect(themeOf(shot('wall-simple'))).not.toBe('dark');
    expect(themeOf(shot('wall-kitchen'))).not.toBe('dark');
  });

  it('puts every close-up widget on the dashboard it is shot from', () => {
    for (const s of GALLERY_SHOTS.filter((g) => g.widget)) {
      expect(STAGE_LAYOUTS[s.stage!.layout].map((w) => w.i)).toContain(s.widget);
    }
  });

  it('keeps the kitchen layout on the grid without overlaps', () => {
    const cells = STAGE_LAYOUTS.kitchen;
    const taken = new Set<string>();
    for (const c of cells) {
      expect(c.x + c.w).toBeLessThanOrEqual(48);
      expect(c.y + c.h).toBeLessThanOrEqual(27);
      for (let x = c.x; x < c.x + c.w; x++) for (let y = c.y; y < c.y + c.h; y++) {
        expect(taken.has(`${x},${y}`)).toBe(false);
        taken.add(`${x},${y}`);
      }
    }
  });

  it('puts the idle screen in idle', () => {
    expect(shot('idle-screen').idle).toBe(true);
  });
});

describe('each shot names the landscape it is taken on (#1142)', () => {
  const ids = SCENERY.map((s) => s.id);

  it('takes the hero and the Simple wall on the most striking landscape', () => {
    expect(PHOTOS.hero).toBe('dunes-sunset');
    for (const s of [...HERO_SHOTS, shot('wall-simple'), shot('idle-screen')]) expect([s.name, s.photo]).toEqual([s.name, PHOTOS.hero]);
  });

  it('takes the morning in morning light and the evening at sunset', () => {
    expect(DAY_SHOTS.map((s) => [s.name, s.photo])).toEqual([
      ['day-morning', 'morning-hills'],
      ['day-afternoon', 'dunes-sunset'],
      ['day-evening', 'river-sunset'],
    ]);
  });

  it('names only bundled photos, on a look that shows the scenery', () => {
    for (const s of [...HERO_SHOTS, ...GALLERY_SHOTS, ...DAY_SHOTS].filter((x) => x.photo)) {
      expect([s.name, ids.includes(s.photo!)]).toEqual([s.name, true]);
      expect(fs.existsSync(scenerySource(s.photo!))).toBe(true);
      expect([s.name, s.stage?.look]).not.toEqual([s.name, 'paper']);
    }
    expect(() => scenerySource('not-a-photo')).toThrow(/No bundled scenery photo/);
  });

  it('serves the named photo in place of the first, with the service worker out of the way', () => {
    const script = fs.readFileSync(require.resolve('../../../scripts/capture-screenshots.ts'), 'utf8');
    expect(script).toMatch(/serviceWorkers: spec\.photo \? 'block'/);
    expect(script).toMatch(/context\.route\(`\*\*\$\{SCENERY\[0\]!\.src\}`, \(route\) => route\.fulfill\(\{ path: scenerySource\(spec\.photo!\) \}\)\)/);
  });
});

describe('a failed staging explains itself', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  const read = (p: string) => fs.readFileSync(require.resolve(`../../../${p}`), 'utf8');

  it('prints the server log when the capture fails', () => {
    expect(read('.github/workflows/refresh-screenshots.yml')).toMatch(/npm run screenshots:capture \|\| \{[\s\S]*tail -120 \/tmp\/dev\.log/);
  });

  it('checks every answer when putting a look back', () => {
    expect(read('scripts/capture-screenshots.ts')).toMatch(/const failed = answers\.filter\(\(r\) => !r\.ok\(\)\)/);
  });
});

describe('no dev overlay in a shot', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  const script = fs.readFileSync(require.resolve('../../../scripts/capture-screenshots.ts'), 'utf8');

  it('removes the Next.js overlay right before each screenshot', () => {
    const removal = script.indexOf("querySelectorAll('nextjs-portal').forEach((el) => el.remove())");
    expect(removal).toBeGreaterThan(-1);
    expect(removal).toBeLessThan(script.indexOf('const outPath = path.join(OUT_DIR'));
  });
});

describe('the gallery page', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  const page = fs.readFileSync(require.resolve('../../../docs/screenshots.md'), 'utf8');
  const shown = [...page.matchAll(/\(demos\/([a-z0-9-]+)\.png/g)].map((m) => m[1]!);

  it('shows every gallery shot', () => {
    for (const s of GALLERY_SHOTS) expect(shown).toContain(s.name);
  });

  it('shows nothing but the gallery and the hero', () => {
    const allowed = new Set([...GALLERY_SHOTS.map((s) => s.name), 'hero-light', 'hero-dark']);
    expect(shown.filter((n) => !allowed.has(n))).toEqual([]);
  });
});

describe('the hero and the day shots show Simple (#1123)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { HERO_SHOTS, DAY_SHOTS, SIMPLE_LAYOUT } = require('../../../scripts/screenshot-specs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TODAY_TEMPLATE } = require('../constants/layoutTemplates');
  type Spec = { name: string; stage?: { layout: string }; shiftMinutes?: number; device?: string; signedOut?: boolean };

  it('stages the hero on the Simple front page', () => {
    for (const s of HERO_SHOTS as Spec[]) expect([s.name, s.stage?.layout]).toEqual([s.name, 'simple']);
  });

  it('places Simple the way the premade Today page does', () => {
    expect(SIMPLE_LAYOUT.map((w: { i: string }) => w.i)).toEqual(TODAY_TEMPLATE.widgets.map((w: { i: string }) => w.i));
  });

  it('shoots the morning, after school and the evening of one day, on a signed-out Simple wall', () => {
    const day = DAY_SHOTS as Spec[];
    expect(day.map((s) => s.name)).toEqual(['day-morning', 'day-afternoon', 'day-evening']);
    for (const s of day) expect([s.name, s.stage?.layout, s.device, s.signedOut]).toEqual([s.name, 'simple', 'wall', true]);
    const shifts = day.map((s) => s.shiftMinutes!);
    expect([...shifts].sort((a, b) => a - b)).toEqual(shifts);
    // The fixed moment is 4:10 PM: all three stay inside the same day.
    expect(16 * 60 + 10 + shifts[0]!).toBeGreaterThan(6 * 60);
    expect(16 * 60 + 10 + shifts[2]!).toBeLessThan(21 * 60);
  });
});
