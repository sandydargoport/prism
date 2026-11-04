/**
 * The screenshot run draws one fixed moment (PRISM_SEED_NOW, a June afternoon
 * in Chicago). Everything the shots show has to agree with it: the server's
 * "now", the weather, and the demo bus.
 */
import { freezeWeather } from '../../../scripts/frozen-weather';
import { afternoonTripEvents } from '../db/seedBusTrip';
import { serverNow } from '../utils/serverNow';

const MOMENT = '2026-06-17T21:10:00Z'; // 4:10 PM CDT, a Wednesday

describe('the server\'s "now" for the fixed moment', () => {
  const saved = { now: process.env.PRISM_SCREENSHOT_NOW, db: process.env.E2E_HAS_TEST_DB };
  afterEach(() => {
    process.env.PRISM_SCREENSHOT_NOW = saved.now;
    process.env.E2E_HAS_TEST_DB = saved.db;
    if (saved.now === undefined) delete process.env.PRISM_SCREENSHOT_NOW;
    if (saved.db === undefined) delete process.env.E2E_HAS_TEST_DB;
  });

  it('is the fixed moment on a test database', () => {
    process.env.PRISM_SCREENSHOT_NOW = MOMENT;
    process.env.E2E_HAS_TEST_DB = '1';
    expect(serverNow().toISOString()).toBe('2026-06-17T21:10:00.000Z');
  });

  it('is the real clock anywhere else, even with the variable set', () => {
    process.env.PRISM_SCREENSHOT_NOW = MOMENT;
    delete process.env.E2E_HAS_TEST_DB;
    expect(Math.abs(serverNow().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('is the real clock when the variable is unset or not a date', () => {
    process.env.E2E_HAS_TEST_DB = '1';
    delete process.env.PRISM_SCREENSHOT_NOW;
    expect(Math.abs(serverNow().getTime() - Date.now())).toBeLessThan(1000);
    process.env.PRISM_SCREENSHOT_NOW = 'soon';
    expect(Math.abs(serverNow().getTime() - Date.now())).toBeLessThan(1000);
  });
});

describe('weather drawn for the fixed moment', () => {
  // A live response from a November day, the shape /api/weather returns.
  const live = {
    location: 'Springfield',
    lat: 41.88,
    lon: -87.63,
    units: { temperature: 'F', windSpeed: 'mph', precipitation: 'in' },
    current: { temperature: 48, feelsLike: 44, condition: 'cloudy', humidity: 80, windSpeed: 11, description: 'Overcast' },
    hourly: [{ time: '2026-11-04T04:00:00Z', condition: 'rainy', temp: 46 }],
    forecast: [{ date: '2026-11-04T00:00:00Z', dayName: 'Wed', high: 50, low: 40, condition: 'cloudy' }],
    sunrise: '2026-11-04T12:25:00Z',
    sunset: '2026-11-04T22:42:00Z',
    moonPhaseName: 'Waxing Gibbous',
    lastUpdated: '2026-11-04T20:00:00Z',
  };

  it('starts the hourly strip at the fixed hour, not the live one', () => {
    const w = freezeWeather(live, MOMENT) as { hourly: Array<{ time: string }> };
    expect(w.hourly[0]!.time).toBe('2026-06-17T21:00:00.000Z');
    expect(w.hourly).toHaveLength(24);
  });

  it('gives June sunrise and sunset in Chicago', () => {
    const w = freezeWeather(live, MOMENT) as { sunrise: string; sunset: string };
    const local = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
    expect(local(w.sunrise)).toMatch(/^5:1\d AM$/);
    expect(local(w.sunset)).toMatch(/^8:[23]\d PM$/);
  });

  it('starts the daily forecast on the fixed day', () => {
    const w = freezeWeather(live, MOMENT) as { forecast: Array<{ date: string; dayName: string }> };
    expect(w.forecast[0]!.date).toBe('2026-06-17T00:00:00.000Z');
    expect(w.forecast[0]!.dayName).toBe('Wed');
  });

  it('works the moon out for the fixed day, and keeps the place and units', () => {
    const w = freezeWeather({ ...live, timezone: 'America/Chicago' }, MOMENT) as { moonPhaseName: string; moonrise: string; location: string; units: unknown };
    // 17 June 2026 is two days after a new moon.
    expect(w.moonPhaseName).toBe('Waxing Crescent');
    expect(w.moonrise.startsWith('2026-06-17')).toBe(true);
    expect(w.location).toBe('Springfield');
    expect(w.units).toEqual(live.units);
  });

  it('converts to Celsius when the household uses it', () => {
    const w = freezeWeather({ ...live, units: { temperature: 'C' } }, MOMENT) as { current: { temperature: number } };
    expect(w.current.temperature).toBe(24);
  });
});

describe('the demo bus on the fixed afternoon', () => {
  it('has reached its stop by 4:10 PM, so the card is not overdue', () => {
    const events = afternoonTripEvents(new Date(MOMENT));
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1]!;
    expect(last.eventType).toBe('arrived_at_stop');
    expect(last.eventTime.getTime()).toBeLessThan(Date.parse(MOMENT));
    expect(events.every((e) => e.tripDate === '2026-06-17')).toBe(true);
  });

  it('logs nothing before the trip ends, so a morning seed is unchanged', () => {
    expect(afternoonTripEvents(new Date('2026-06-17T14:30:00Z'))).toEqual([]); // 9:30 AM
  });

  it('logs nothing at the weekend', () => {
    expect(afternoonTripEvents(new Date('2026-06-20T21:10:00Z'))).toEqual([]); // Saturday
  });
});

describe('the screenshot run uses all of the above', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  const read = (p: string) => fs.readFileSync(require.resolve(`../../../${p}`), 'utf8');

  it('starts the screenshot server at the fixed moment', () => {
    expect(read('.github/workflows/refresh-screenshots.yml')).toMatch(/PRISM_SCREENSHOT_NOW="\$PRISM_SEED_NOW" npm run dev/);
  });

  it('has birthdays and the bus count from the server\'s "now"', () => {
    expect(read('src/app/api/birthdays/route.ts')).toMatch(/todayKey\(.*serverNow\(\)\)/);
    expect(read('src/lib/services/bus-arrival-predictor.ts')).toMatch(/const now = serverNow\(\);/);
  });

  it('draws the fixed moment\'s weather', () => {
    expect(read('scripts/capture-screenshots.ts')).toMatch(/route\('\*\*\/api\/weather\*\*'[\s\S]*freezeWeather\(/);
  });

  it('seeds today\'s afternoon trip', () => {
    expect(read('src/lib/db/seed.ts')).toMatch(/afternoonTripEvents\(NOW\)/);
  });
});
