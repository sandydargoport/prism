/**
 * The screen owns its day (#1345): one screen setting key holds the idle look
 * by day and at night, the night rule and how much darker; the household
 * keeps a starting day; client and database defaults agree.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  backgroundOf,
  DEFAULT_SCREEN_DAY,
  effectiveScreenDay,
  HOUSEHOLD_DAY_SETTING,
  levelFromDim,
  parseHouseholdDay,
  parseScreenDay,
  SCREEN_DAY_KEY,
  serializeScreenDay,
  withBackground,
  type ScreenDay,
} from '../screenDay';
import { isScreenSettingKey } from '../displays/screenSettings';
import { withStartingDay } from '../displays/startingDay';
import { publicSettings } from '../settings/publicSettings';
import { DEFAULT_NIGHT } from '../throughTheDay';

jest.mock('../db/client', () => ({ db: {} }));

const ROOT = path.join(__dirname, '..', '..', '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const PHOTOS_SKY: ScreenDay = { day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' }, nightLevel: 25 };

describe('the day key', () => {
  it('is a screen setting, so it syncs, edits remotely and stays per browser unnamed', () => {
    expect(isScreenSettingKey(SCREEN_DAY_KEY)).toBe(true);
  });

  it('round-trips, and reads the text the migration writes', () => {
    expect(parseScreenDay(serializeScreenDay(PHOTOS_SKY))).toEqual(PHOTOS_SKY);
    // jsonb::text, as 0057 stores it.
    const fromSql = '{"day": "photos", "night": "sky", "switch": {"by": "clock", "from": "21:00", "to": "06:30"}, "nightLevel": 25}';
    expect(parseScreenDay(fromSql)).toEqual(PHOTOS_SKY);
  });

  it('reads a missing level as not darker: the code default stays 0', () => {
    expect(parseScreenDay(JSON.stringify({ day: 'dashboard', night: 'off', switch: DEFAULT_NIGHT }))?.nightLevel).toBe(0);
  });

  it('refuses what it does not know', () => {
    expect(parseScreenDay('not json')).toBeNull();
    expect(parseScreenDay(JSON.stringify({ ...PHOTOS_SKY, nightLevel: 40 }))).toBeNull();
    expect(parseScreenDay(JSON.stringify({ source: 'photos' }))).toBeNull();
  });

  it('gives the idle code one look when day and night match on the default rule', () => {
    expect(backgroundOf({ ...DEFAULT_SCREEN_DAY, nightLevel: 50 })).toEqual({ source: 'dashboard' });
    expect(backgroundOf(PHOTOS_SKY)).toEqual({ day: 'photos', night: 'sky', switch: PHOTOS_SKY.switch });
    expect(withBackground(PHOTOS_SKY, { source: 'off' })).toEqual({ day: 'off', night: 'off', switch: DEFAULT_NIGHT, nightLevel: 25 });
  });
});

describe('client and database defaults agree (#1345, 6.1 item 16)', () => {
  it('with nothing stored, a screen idles as its dashboard, as the database default says', () => {
    const column = read('src/lib/db/init/02-schema.sql').match(/idle_background jsonb DEFAULT '([^']+)'/)![1]!;
    expect(JSON.parse(column)).toEqual({ source: 'dashboard' });
    expect(read('src/lib/db/schema.ts')).toMatch(/idleBackground: jsonb\('idle_background'\)[^\n]*default\(\{ source: 'dashboard' \}\)/);
    expect(backgroundOf(DEFAULT_SCREEN_DAY)).toEqual(JSON.parse(column));
    expect(parseHouseholdDay(undefined)).toEqual(DEFAULT_SCREEN_DAY);
    expect(effectiveScreenDay(null, parseHouseholdDay(null), null).day).toBe('dashboard');
  });
});

describe('the household starting day', () => {
  it('a fresh install seeds it as the dashboard quieter, dusk to dawn, 50% darker', () => {
    const seed = read('src/lib/db/init/02-schema.sql')
      .match(new RegExp(`VALUES \\('${HOUSEHOLD_DAY_SETTING}', '([^']+)'::jsonb\\)`))![1]!;
    expect(parseHouseholdDay(JSON.parse(seed))).toEqual({ day: 'dashboard', night: 'dashboard', switch: DEFAULT_NIGHT, nightLevel: 50 });
  });

  it('the test seed writes the same row, as an install from before calm mode has it', () => {
    expect(read('src/lib/db/seed.ts')).toContain(`key: '${HOUSEHOLD_DAY_SETTING}'`);
  });

  it('is readable by a wall nobody signed in to', () => {
    expect(publicSettings({ [HOUSEHOLD_DAY_SETTING]: PHOTOS_SKY, security: null })).toEqual({ [HOUSEHOLD_DAY_SETTING]: PHOTOS_SKY });
  });
});

describe('an unnamed browser (migration table row)', () => {
  const household: ScreenDay = { ...DEFAULT_SCREEN_DAY, day: 'photos', night: 'photos' };

  it('uses the household day until it sets its own', () => {
    expect(effectiveScreenDay(null, household, null)).toBe(household);
    expect(effectiveScreenDay(serializeScreenDay(PHOTOS_SKY), household, null)).toEqual(PHOTOS_SKY);
  });

  it('keeps its local dim value meanwhile', () => {
    expect(effectiveScreenDay(null, household, '0.75')).toEqual({ ...household, nightLevel: 75 });
    // Once it has its own day, the old value no longer counts.
    expect(effectiveScreenDay(serializeScreenDay(PHOTOS_SKY), household, '0.75').nightLevel).toBe(25);
  });

  it('reads the old dim values as levels', () => {
    expect(['0', '0.25', '0.5', '0.75', null, '1'].map(levelFromDim)).toEqual([0, 25, 50, 75, null, null]);
  });
});

describe('a device named after the upgrade (migration table row)', () => {
  const upgraded: ScreenDay = { ...DEFAULT_SCREEN_DAY, day: 'photos', night: 'photos', nightLevel: 0 };

  it('carries up the day it was going by, not new-screen defaults', () => {
    expect(withStartingDay({ 'prism-screensaver-timeout': '120' }, upgraded)).toEqual({
      'prism-screensaver-timeout': '120',
      [SCREEN_DAY_KEY]: serializeScreenDay(upgraded),
    });
    expect(withStartingDay({ 'prism-screensaver-dim': '0.5' }, upgraded)).toEqual({
      [SCREEN_DAY_KEY]: serializeScreenDay({ ...upgraded, nightLevel: 50 }),
    });
  });
});
