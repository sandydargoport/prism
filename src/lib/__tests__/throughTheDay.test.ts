/**
 * Through the day (#1152): one function decides active, resting or night for
 * a time and a place, and one rule says when night is. The veil, the dim and
 * the night backdrop all ask it.
 */
import * as SunCalc from 'suncalc';
import { idleBackgroundSchema, needsLocation, type IdleBackground } from '../idleBackground';
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

describe('screenStateAt', () => {
  const night = shift(SunCalc.getTimes(NOON, LAT, LON).sunset!, 120);
  it('is active while someone is using the screen, day or night', () => {
    expect(screenStateAt({ idle: false, now: NOON, rule: DEFAULT_NIGHT, lat: LAT, lon: LON })).toBe('active');
    expect(screenStateAt({ idle: false, now: night, rule: DEFAULT_NIGHT, lat: LAT, lon: LON })).toBe('active');
  });
  it('is resting by day and night after dark once nobody is', () => {
    expect(screenStateAt({ idle: true, now: NOON, rule: DEFAULT_NIGHT, lat: LAT, lon: LON })).toBe('resting');
    expect(screenStateAt({ idle: true, now: night, rule: DEFAULT_NIGHT, lat: LAT, lon: LON })).toBe('night');
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
