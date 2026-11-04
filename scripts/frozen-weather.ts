/**
 * Weather for the screenshot run's fixed moment.
 *
 * The capture run freezes the clock (PRISM_SEED_NOW), but the forecast comes
 * from a live provider, so a June afternoon was drawn with November's hourly
 * forecast, sunrise and sunset. This replaces the provider's fields in an
 * /api/weather response with a fixed summer afternoon at that moment. Fields
 * the server works out from its own clock (the moon and any eclipse) are
 * worked out again for the fixed moment, the way the server does it.
 */
import * as SunCalc from 'suncalc';
import { getMoonData } from '../src/lib/integrations/moon';
import { dayWindowUtc, todayKey } from '../src/lib/utils/zonedDate';

type Raw = Record<string, unknown> & {
  timezone?: string;
  lat?: number;
  lon?: number;
  units?: { temperature?: string; windSpeed?: string };
};

/** Afternoon highs falling into a clear evening, in °F, one per hour. */
const HOURLY_F = [76, 77, 76, 75, 73, 71, 69, 67, 66, 65, 64, 63, 62, 62, 61, 61, 60, 61, 63, 66, 69, 72, 74, 76];
const DAILY: Array<[high: number, low: number, condition: string, precip: number]> = [
  [78, 61, 'partly-cloudy', 10],
  [81, 63, 'sunny', 0],
  [79, 64, 'partly-cloudy', 20],
  [72, 60, 'rainy', 70],
  [75, 59, 'partly-cloudy', 10],
  [80, 62, 'sunny', 0],
  [82, 65, 'sunny', 5],
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Chicago, where the demo household lives, when the response carries no location. */
const DEFAULT_LAT = 41.88;
const DEFAULT_LON = -87.63;

export function freezeWeather(raw: Raw, nowIso: string): Raw {
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) throw new Error(`Not a date: ${nowIso}`);
  const celsius = raw.units?.temperature === 'C';
  const kmh = raw.units?.windSpeed === 'km/h';
  const temp = (f: number) => (celsius ? Math.round(((f - 32) * 5) / 9) : f);

  const hourStart = new Date(now);
  hourStart.setUTCMinutes(0, 0, 0);
  const hourly = HOURLY_F.map((f, i) => {
    const time = new Date(hourStart.getTime() + i * 3_600_000);
    // Clear overnight, a few clouds by day.
    const sunUp = SunCalc.getPosition(time, raw.lat ?? DEFAULT_LAT, raw.lon ?? DEFAULT_LON).altitude > 0;
    return { time: time.toISOString(), condition: sunUp ? 'partly-cloudy' : 'sunny', temp: temp(f), precipProbability: 0 };
  });

  // Forecast dates are "floating": UTC midnight of the calendar date.
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const forecast = DAILY.map(([high, low, condition, precip], i) => {
    const date = new Date(today + i * 86_400_000);
    return { date: date.toISOString(), dayName: DAY_NAMES[date.getUTCDay()], high: temp(high), low: temp(low), condition, precipProbability: precip };
  });

  const lat = raw.lat ?? DEFAULT_LAT;
  const lon = raw.lon ?? DEFAULT_LON;
  const sun = SunCalc.getTimes(now, lat, lon);
  const zone = raw.timezone ?? 'America/Chicago';
  const moon = getMoonData(lat, lon, now, dayWindowUtc(todayKey(zone, now), zone).start);

  return {
    ...raw,
    current: {
      temperature: temp(76),
      feelsLike: temp(75),
      condition: 'partly-cloudy',
      humidity: 48,
      windSpeed: kmh ? 13 : 8,
      description: 'Partly cloudy',
    },
    hourly,
    forecast,
    minutely: undefined,
    periods: undefined,
    // No sunrise or sunset at all near the poles in midsummer.
    sunrise: sun.sunrise?.toISOString(),
    sunset: sun.sunset?.toISOString(),
    moonrise: moon.moonrise?.toISOString(),
    moonset: moon.moonset?.toISOString(),
    moonPhase: moon.moonPhase,
    moonIllumination: moon.moonIllumination,
    moonPhaseName: moon.moonPhaseName,
    eclipse: moon.eclipse
      ? { ...moon.eclipse, begin: moon.eclipse.begin.toISOString(), peak: moon.eclipse.peak.toISOString(), end: moon.eclipse.end.toISOString() }
      : undefined,
    lastUpdated: now.toISOString(),
  };
}
