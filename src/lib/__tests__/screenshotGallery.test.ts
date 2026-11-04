/**
 * The docs gallery shows what a family sees, in a new install's looks (#878).
 * scripts/screenshot-specs.ts is the list scripts/capture-screenshots.ts
 * shoots; these check the gallery part of it.
 */
import { GALLERY_SHOTS, STAGE_LAYOUTS, themeOf } from '../../../scripts/screenshot-specs';
import { LOOK_IDS } from '../looks';

/** Pages a family uses day to day. Everything else is settings, admin or editing. */
const FAMILY_PAGES = ['/', '/calendar', '/shopping'];

const names = GALLERY_SHOTS.map((s) => s.name);
const shot = (name: string) => GALLERY_SHOTS.find((s) => s.name === name)!;

describe('the docs gallery', () => {
  it('shoots the wall in every look, the idle screen, three widgets and the phone', () => {
    expect(names.sort()).toEqual(
      [
        ...LOOK_IDS.map((l) => `look-${l}`),
        'idle-screen',
        'widget-calendar', 'widget-chores', 'widget-shopping',
        'phone-home', 'phone-calendar', 'phone-shopping',
      ].sort(),
    );
  });

  it('shows no admin or editing page', () => {
    for (const s of GALLERY_SHOTS) expect([s.name, FAMILY_PAGES.includes(s.url)]).toEqual([s.name, true]);
  });

  it('stages every shot in a look, on the gallery dashboard', () => {
    for (const s of GALLERY_SHOTS) expect([s.name, s.stage?.layout]).toEqual([s.name, 'gallery']);
    for (const look of LOOK_IDS) expect(shot(`look-${look}`).stage?.look).toBe(look);
  });

  it('shoots the wall signed out with the rail and top bar hidden', () => {
    const wall = GALLERY_SHOTS.filter((s) => s.device === 'wall');
    expect(wall.length).toBe(7);
    for (const s of wall) expect([s.name, s.signedOut, s.idleChrome]).toEqual([s.name, true, true]);
  });

  it('draws the Night look dark and the others light', () => {
    expect(themeOf(shot('look-night'))).toBe('dark');
    expect(themeOf(shot('look-photo'))).not.toBe('dark');
    expect(themeOf(shot('look-paper'))).not.toBe('dark');
  });

  it('puts every close-up widget on the dashboard it is shot from', () => {
    for (const s of GALLERY_SHOTS.filter((g) => g.widget)) {
      expect(STAGE_LAYOUTS[s.stage!.layout].map((w) => w.i)).toContain(s.widget);
    }
  });

  it('puts the idle screen in idle', () => {
    expect(shot('idle-screen').idle).toBe(true);
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
