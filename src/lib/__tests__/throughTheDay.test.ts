/**
 * Through the day (#1152): one function decides active, resting or night for
 * a time and a place, and one rule says when night is. The veil, the dim and
 * the night backdrop all ask it.
 */
import * as SunCalc from 'suncalc';
import { idleBackgroundSchema, idleSourceAt, needsLocation, type IdleBackground } from '../idleBackground';
import { asDayAndNight, backdropFor, DEFAULT_NIGHT, isNightAt, nightRule, screenStateAt } from '../throughTheDay';

// A fictional household somewhere mid-latitude, west of Greenwich.
const LAT = 45;
const LON = -100;
const MIN = 60_000;
const NOON = new Date('2026-11-05T18:00:00Z');
const shift = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MIN);

describe('the night rule', () => {
  it('is half an hour after sunset to half an hour before sunrise when a dashboard sets none', () => {
    const sunset = SunCalc.getTimes(NOON, LAT, LON).sunset!;
    const sunrise = SunCalc.getTimes(shift(NOON, 24 * 60), LAT, LON).sunrise!;
    const rule = nightRule({ source: 'photos' });
    expect(rule).toEqual(DEFAULT_NIGHT);
    expect(isNightAt(rule, shift(sunset, 29), LAT, LON)).toBe(false);
    expect(isNightAt(rule, shift(sunset, 31), LAT, LON)).toBe(true);
    expect(isNightAt(rule, shift(sunrise, -31), LAT, LON)).toBe(true);
    expect(isNightAt(rule, shift(sunrise, -29), LAT, LON)).toBe(false);
  });

  it('is the dashboard\'s own when it sets one', () => {
    const bg: IdleBackground = { day: 'dashboard', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } };
    const local = (h: number, m = 0) => new Date(2026, 10, 5, h, m);
    expect(isNightAt(nightRule(bg), local(20, 59), LAT, LON)).toBe(false);
    expect(isNightAt(nightRule(bg), local(21, 0), LAT, LON)).toBe(true);
    expect(isNightAt(nightRule(bg), local(6, 29), LAT, LON)).toBe(true);
    expect(isNightAt(nightRule(bg), local(6, 30), LAT, LON)).toBe(false);
  });

  it('needs the place unless night is set by the clock and the sky is not shown', () => {
    expect(needsLocation({ source: 'photos' })).toBe(true);
    expect(needsLocation({ day: 'photos', night: 'off', switch: { by: 'clock', from: '21:00', to: '06:30' } })).toBe(false);
    expect(needsLocation({ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } })).toBe(true);
  });
});

describe('screenStateAt: what a screen shows (#1344)', () => {
  const night = shift(SunCalc.getTimes(NOON, LAT, LON).sunset!, 120);
  const at = (now: Date) => ({ now, lat: LAT, lon: LON });
  const photos: IdleBackground = { source: 'photos' };
  const offAtNight: IdleBackground = { day: 'photos', night: 'off', switch: DEFAULT_NIGHT };

  it('is active while someone is using the screen, day or night', () => {
    expect(screenStateAt({ idle: false, background: photos, at: at(NOON) }).state).toBe('active');
    expect(screenStateAt({ idle: false, background: photos, at: at(night) }).state).toBe('active');
  });
  it('is resting by day and night after dark once nobody is', () => {
    expect(screenStateAt({ idle: true, background: photos, at: at(NOON) }).state).toBe('resting');
    expect(screenStateAt({ idle: true, background: photos, at: at(night) }).state).toBe('night');
  });

  // Each row is what a screen showed before the one function: the wall's
  // look, night, ink and dim, and the editor preview's forced moments.
  it.each([
    // in use: the dashboard, never dimmed, but night is still night (Glance's veil)
    ['in use by day', { idle: false, at: at(NOON) }, { state: 'active', night: false, look: 'dashboard', dim: 0 }],
    ['in use at night', { idle: false, at: at(night) }, { state: 'active', night: true, look: 'dashboard', dim: 0 }],
    ['idle by day', { idle: true, at: at(NOON) }, { state: 'resting', night: false, look: 'photos', dim: 0 }],
    ['idle at night', { idle: true, at: at(night) }, { state: 'night', night: true, look: 'off', dim: 0.5 }],
    // Away and Sitter keep the screen in use, so they cancel the dim (#1348 changes this).
    ['idle at night in Away', { idle: true, away: true, at: at(night) }, { state: 'active', night: true, look: 'dashboard', dim: 0 }],
    ['idle at night with a sitter', { idle: true, sitter: true, at: at(night) }, { state: 'active', night: true, look: 'dashboard', dim: 0 }],
    ['a screen that cannot idle', { idle: true, canIdle: false, at: at(night) }, { state: 'active', night: true, look: 'dashboard', dim: 0 }],
    // Never idle, and never dimmed, over the editor (#1342).
    ['idle at night while editing', { idle: true, editing: true, at: at(night) }, { state: 'active', night: true, look: 'dashboard', dim: 0 }],
    // The editor's previews give night outright.
    ['the Resting preview', { idle: true, at: { night: false } }, { state: 'resting', night: false, look: 'photos', dim: 0 }],
    ['the Night preview', { idle: true, at: { night: true } }, { state: 'night', night: true, look: 'off', dim: 0.5 }],
    ['the In use preview at night', { idle: false, at: { night: true } }, { state: 'active', night: true, look: 'dashboard', dim: 0 }],
  ] as const)('%s', (_name, input, scene) => {
    expect(screenStateAt({ background: offAtNight, dimLevel: 0.5, ...input })).toEqual(scene);
  });

  it('agrees with the rules the wall used, for every background, time and mode', () => {
    const level = 0.75;
    const backgrounds: IdleBackground[] = [
      { source: 'photos' }, { source: 'dashboard' }, { source: 'sky' }, { source: 'off' },
      { day: 'dashboard', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } },
      offAtNight,
    ];
    const times = [NOON, night, new Date(2026, 10, 5, 22), new Date(2026, 10, 5, 7)];
    for (const background of backgrounds) for (const now of times) for (const idle of [false, true])
      for (const away of [false, true]) for (const sitter of [false, true]) {
        const scene = screenStateAt({ idle, away, sitter, background, at: at(now), dimLevel: level });
        // The wall before #1344: shouldShowScreensaver, isNightAt with the
        // dashboard's rule, idleSourceAt, and the dim only while idle at night.
        const wallIdle = idle && !away && !sitter;
        const wallNight = isNightAt(nightRule(background), now, LAT, LON);
        expect(scene.night).toBe(wallNight);
        expect(scene.state !== 'active').toBe(wallIdle);
        expect(scene.look).toBe(wallIdle ? idleSourceAt(background, now, LAT, LON) : 'dashboard');
        expect(scene.dim).toBe(wallIdle && wallNight ? level : 0);
      }
  });
});

describe('what shows in each state', () => {
  const bg: IdleBackground = { day: 'photos', night: 'off', switch: DEFAULT_NIGHT };
  it('is the dashboard while active, the resting backdrop, then the night look', () => {
    expect(backdropFor(bg, 'active')).toBe('dashboard');
    expect(backdropFor(bg, 'resting')).toBe('photos');
    expect(backdropFor(bg, 'night')).toBe('off');
    expect(backdropFor({ source: 'sky' }, 'night')).toBe('sky');
  });
  it('can be a screen that goes off at night', () => {
    expect(idleBackgroundSchema.safeParse(bg).success).toBe(true);
  });
  it('reads one background as the same by day and night, on the default rule', () => {
    expect(asDayAndNight({ source: 'dashboard' })).toEqual({ day: 'dashboard', night: 'dashboard', switch: DEFAULT_NIGHT });
    expect(asDayAndNight(bg)).toBe(bg);
  });
});
