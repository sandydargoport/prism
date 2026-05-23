/**
 * Open-Meteo (https://open-meteo.com) integration.
 *
 * No API key required. Free, no signup, generous rate limits (~10K/day per
 * IP). Better default for self-hosted installs than Pirate Weather or
 * OpenWeatherMap because zero env-var configuration is needed.
 *
 * FEATURES:
 *   - Current weather (temperature, apparent temperature, humidity, wind)
 *   - 7-day daily forecast (high/low, sunrise/sunset, precip probability)
 *   - 24-hour hourly forecast
 *   - WMO weather code mapping → Prism's WeatherCondition enum
 *
 * NOT SUPPORTED (vs Pirate Weather):
 *   - Minutely precipitation forecast — Open-Meteo provides 15-min hourly
 *     precip-prob in some models but no minute-by-minute "rain in 18 min"
 *     pattern. The widget gracefully omits the minutely arc when missing.
 *
 * CONFIGURATION:
 *   WEATHER_LAT / WEATHER_LON — coordinates (default Chicago)
 *   WEATHER_LOCATION         — display name shown in the widget
 *
 * Requests temperatures, wind, and precipitation in either imperial or metric
 * units based on the caller's `WeatherOptions.units` preference (defaults to
 * imperial). The response carries the actual `units` so display components
 * render the right suffix without converting values themselves.
 */

import type {
  WeatherData,
  WeatherCondition,
  WeatherUnits,
  CurrentWeather,
  ForecastDay,
  ForecastPeriod,
  HourlyForecast,
} from '@/components/widgets/WeatherWidget';
import type { LocationParam, WeatherOptions } from './weather';
import { getMoonData } from './moon';

function defaultImperialUnits(): WeatherUnits {
  return { temperature: 'F', windSpeed: 'mph', precipitation: 'in' };
}

// ---------------------------------------------------------------------------
// Open-Meteo response types (subset of the fields we use)
// ---------------------------------------------------------------------------

interface OpenMeteoCurrent {
  time: string; // ISO local-tz string when timezone=auto
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number; // 0-100
  wind_speed_10m: number;
  weather_code: number;
  precipitation: number;
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  precipitation_probability?: number[];
  precipitation: number[];
  weather_code: number[];
}

interface OpenMeteoDaily {
  time: string[]; // YYYY-MM-DD in `timezone=auto`
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
  precipitation_probability_max?: number[];
  sunrise: string[];
  sunset: string[];
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current: OpenMeteoCurrent;
  hourly: OpenMeteoHourly;
  daily: OpenMeteoDaily;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getConfig(location?: LocationParam) {
  let lat = parseFloat(process.env.WEATHER_LAT || '41.8781');
  let lon = parseFloat(process.env.WEATHER_LON || '-87.6298');
  let locationName = process.env.WEATHER_LOCATION || 'Chicago, IL';

  if (typeof location === 'object' && location !== null && 'lat' in location) {
    lat = location.lat;
    lon = location.lon;
  } else if (typeof location === 'string' && location.length > 0) {
    locationName = location;
  }

  return { lat, lon, locationName };
}

// ---------------------------------------------------------------------------
// WMO weather code mapping (https://open-meteo.com/en/docs#weather_variable_documentation)
// ---------------------------------------------------------------------------

function mapWmoCode(code: number): WeatherCondition {
  if (code === 0) return 'sunny'; // Clear sky
  if (code === 1 || code === 2) return 'partly-cloudy'; // Mainly clear, partly cloudy
  if (code === 3) return 'cloudy'; // Overcast
  if (code === 45 || code === 48) return 'cloudy'; // Fog
  if (code >= 51 && code <= 67) return 'rainy'; // Drizzle, rain
  if (code >= 71 && code <= 77) return 'snowy'; // Snow
  if (code >= 80 && code <= 82) return 'rainy'; // Rain showers
  if (code >= 85 && code <= 86) return 'snowy'; // Snow showers
  if (code >= 95 && code <= 99) return 'stormy'; // Thunderstorm
  return 'cloudy';
}

function describeWmo(code: number): string {
  // Human-readable description — kept intentionally short. The widget shows
  // this beneath the temperature.
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code >= 71 && code <= 75) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Cloudy';
}

// ---------------------------------------------------------------------------
// Wall-clock-in-timezone → UTC instant
// ---------------------------------------------------------------------------

/**
 * Convert a "wall-clock" ISO string ("2026-05-19T05:42", no offset) interpreted
 * in the given IANA timezone into a UTC `Date`. Open-Meteo returns its
 * `sunrise`, `sunset`, and `hourly.time` values in this shape when called with
 * `timezone=auto`, so we need this to land on the correct absolute instant
 * regardless of the runtime's local timezone (which is UTC in our containers).
 *
 * Approach: format the localIso (treated as UTC) in the target zone to read
 * back its longOffset like "GMT-05:00", then subtract that offset from the
 * UTC interpretation. DST transitions are handled implicitly because the
 * offset is recomputed against the actual date.
 */
function zonedTimeToUtc(localIso: string, timeZone: string): Date {
  // Treat the wall-clock as UTC for the moment — wrong by the timezone offset.
  const asUtc = new Date(`${localIso}Z`);
  // Ask Intl what UTC offset the target zone has at that moment.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    hour12: false,
  }).formatToParts(asUtc);
  const offsetName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  // "GMT-05:00" → ±HH:MM
  const m = /([+-])(\d{2}):?(\d{2})/.exec(offsetName);
  if (!m) return asUtc;
  const sign = m[1] === '+' ? 1 : -1;
  const offsetMinutes = sign * (parseInt(m[2]!, 10) * 60 + parseInt(m[3]!, 10));
  // Subtract the offset to get the real UTC instant for that wall-clock time.
  return new Date(asUtc.getTime() - offsetMinutes * 60_000);
}

// ---------------------------------------------------------------------------
// Main fetch function
// ---------------------------------------------------------------------------

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function fetchWeatherData(
  location?: LocationParam,
  options?: WeatherOptions,
): Promise<WeatherData> {
  const config = getConfig(location);
  const units = options?.units ?? defaultImperialUnits();

  // `timezone=auto` returns daily/hourly times in the location's local TZ,
  // which lets us treat YYYY-MM-DD daily entries as local-date strings without
  // an Intl.DateTimeFormat workaround (cf. pirateweather.ts).
  const params = new URLSearchParams({
    latitude: String(config.lat),
    longitude: String(config.lon),
    timezone: 'auto',
    temperature_unit: units.temperature === 'C' ? 'celsius' : 'fahrenheit',
    wind_speed_unit: units.windSpeed === 'km/h' ? 'kmh' : 'mph',
    precipitation_unit: units.precipitation === 'mm' ? 'mm' : 'inch',
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'wind_speed_10m',
      'weather_code',
      'precipitation',
    ].join(','),
    hourly: [
      'temperature_2m',
      'precipitation_probability',
      'precipitation',
      'weather_code',
    ].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'weather_code',
      'precipitation_probability_max',
      'sunrise',
      'sunset',
    ].join(','),
    forecast_days: '7',
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, { next: { revalidate: 1800 } }); // cache 30 min
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Open-Meteo network error: ${msg}`);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch Open-Meteo data: ${error}`);
  }

  const data: OpenMeteoResponse = await response.json();
  const { current, hourly, daily, timezone } = data;

  // ── Current conditions ────────────────────────────────────────────────────
  const currentWeather: CurrentWeather = {
    temperature: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    condition: mapWmoCode(current.weather_code),
    humidity: Math.round(current.relative_humidity_2m),
    windSpeed: Math.round(current.wind_speed_10m),
    description: describeWmo(current.weather_code),
  };

  // ── Sunrise / sunset from today's daily entry ─────────────────────────────
  // Open-Meteo returns ISO strings without TZ offset when timezone=auto
  // (e.g. "2026-05-19T05:42"). Plain `new Date(s)` interprets these in the
  // *runtime's* local time — which is UTC in our Docker container — then
  // serializes to ISO Z. The browser then parses that back as UTC and shifts
  // by the user's offset, producing sunrise ~midnight. Combining the wall-
  // clock string with the response's IANA timezone gives the correct UTC
  // instant in one step.
  const sunrise = daily.sunrise[0] ? zonedTimeToUtc(daily.sunrise[0], timezone) : undefined;
  const sunset  = daily.sunset[0]  ? zonedTimeToUtc(daily.sunset[0],  timezone) : undefined;

  // ── 7-day forecast ────────────────────────────────────────────────────────
  // Today's local date at the forecast location — used to drop stale past-day
  // entries that can appear when a cached response was generated yesterday.
  // Open-Meteo's `daily.time` strings are already in the response timezone, so
  // a YYYY-MM-DD comparison is sufficient. (See iann's PR #27 for the same
  // issue addressed in the OWM and Pirate Weather paths.)
  const todayLocalStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
    .format(new Date());

  const forecast: ForecastDay[] = daily.time
    .map((dateStr, i) => ({ dateStr, i }))
    .filter(({ dateStr }) => dateStr.slice(0, 10) >= todayLocalStr)
    .slice(0, 7)
    .map(({ dateStr, i }) => {
      // YYYY-MM-DD in the location's TZ. Anchor at UTC midnight so the
      // JSON round-trip preserves the calendar day: ISO string of a UTC-
      // midnight Date is "YYYY-MM-DDT00:00:00.000Z", which the client can
      // read back via getUTC* without TZ slippage. Computing dayName from
      // getUTCDay() keeps the day-of-week label consistent regardless of
      // the container's TZ (Docker = UTC; family viewer = Central).
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
      const date = m
        ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
        : new Date(dateStr);
      return {
        date,
        dayName: DAYS_SHORT[date.getUTCDay()] ?? 'Day',
        high: Math.round(daily.temperature_2m_max[i] ?? 0),
        low: Math.round(daily.temperature_2m_min[i] ?? 0),
        condition: mapWmoCode(daily.weather_code[i] ?? 0),
        precipProbability: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
      };
    });

  // ── Hourly: next 24 hours ─────────────────────────────────────────────────
  const nowMs = Date.now();
  const cutoff = nowMs + 12 * 3_600_000;
  const hourlyData: HourlyForecast[] = hourly.time
    .map((t, i) => ({
      // Same wall-clock-in-location issue as sunrise above — pass through
      // zonedTimeToUtc so the absolute instant is right for the user's browser.
      time: zonedTimeToUtc(t, timezone),
      condition: mapWmoCode(hourly.weather_code[i] ?? 0),
      temp: Math.round(hourly.temperature_2m[i] ?? 0),
      precipProbability: Math.round(hourly.precipitation_probability?.[i] ?? 0),
      precipIntensity: hourly.precipitation[i] ?? 0,
    }))
    .filter((h) => {
      const t = h.time.getTime();
      return t > nowMs - 3_600_000 && t <= cutoff;
    });

  // Override the currently-active hour with observed current conditions —
  // matches the pattern in openweather.ts and pirateweather.ts.
  const patchedHourly = hourlyData.map((h) =>
    h.time.getTime() <= nowMs
      ? {
          ...h,
          condition: currentWeather.condition,
          temp: currentWeather.temperature,
          precipIntensity: current.precipitation,
        }
      : h,
  );

  // ── Periods (Morning / Afternoon / Evening) ───────────────────────────────
  const todayStr = new Date().toLocaleDateString('en-CA');
  const periodDefs = [
    { label: 'Morn', minHour: 6, maxHour: 12 },
    { label: 'Aft', minHour: 12, maxHour: 18 },
    { label: 'Eve', minHour: 18, maxHour: 24 },
  ];
  const periods: ForecastPeriod[] = [];
  for (const def of periodDefs) {
    const matching = hourlyData.filter((h) => {
      return (
        h.time.toLocaleDateString('en-CA') === todayStr &&
        h.time.getHours() >= def.minHour &&
        h.time.getHours() < def.maxHour
      );
    });
    if (matching.length > 0) {
      const avgTemp = matching.reduce((s, h) => s + h.temp, 0) / matching.length;
      periods.push({
        label: def.label,
        temp: Math.round(avgTemp),
        condition: matching[0]!.condition,
      });
    }
  }

  // ── Moon (local computation — Open-Meteo doesn't expose moon data) ────────
  const moon = getMoonData(config.lat, config.lon);

  return {
    location: config.locationName,
    units,
    current: currentWeather,
    forecast,
    hourly: patchedHourly,
    periods,
    sunrise,
    sunset,
    moonrise: moon.moonrise,
    moonset: moon.moonset,
    moonPhase: moon.moonPhase,
    moonIllumination: moon.moonIllumination,
    moonPhaseName: moon.moonPhaseName,
    lat: config.lat,
    lon: config.lon,
    // Open-Meteo doesn't provide minutely precip — leave undefined.
    minutely: undefined,
    lastUpdated: new Date(),
  };
}
