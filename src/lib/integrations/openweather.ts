/**
 *
 * Provides OpenWeatherMap API integration for weather data.
 *
 * FEATURES:
 * - Current weather conditions
 * - 5-day forecast
 * - Location geocoding
 *
 */

import { DAYS_SHORT_ARRAY } from '@/lib/constants/days';
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
import { dateOnlyToFloatingUtc } from '@/lib/utils/zonedDate';
import { getMoonData } from './moon';

/**
 * Best-effort lat/lon for the moon calc. OpenWeather's free endpoints don't
 * include coordinates in the response, so we prefer an explicit `{lat, lon}`
 * LocationParam, then fall back to WEATHER_LAT/LON env, then Chicago.
 */
function resolveLatLon(location?: LocationParam): { lat: number; lon: number } {
  if (typeof location === 'object' && location !== null && 'lat' in location) {
    return { lat: location.lat, lon: location.lon };
  }
  const lat = parseFloat(process.env.WEATHER_LAT || '41.8781');
  const lon = parseFloat(process.env.WEATHER_LON || '-87.6298');
  return { lat, lon };
}

export type { LocationParam };

/**
 * OpenWeatherMap API response types
 */
interface OpenWeatherCurrent {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  wind: {
    speed: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  sys: {
    sunrise: number; // Unix timestamp
    sunset: number;  // Unix timestamp
  };
  name: string;
}

interface OpenWeatherForecast {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      temp_min: number;
      temp_max: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
    }>;
  }>;
  city: {
    name: string;
    country: string;
    timezone: number; // UTC offset in seconds (e.g., -18000 for CDT)
  };
}

/**
 * Get configuration — checks DB credentials store first, falls back to env.
 */
async function getConfig() {
  const { getWeatherApiKey } = await import('@/lib/integrations/credentialStore');
  const apiKey = await getWeatherApiKey();
  const location = process.env.WEATHER_LOCATION || 'Springfield,IL,US';

  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY is not configured in environment');
  }

  return { apiKey, location };
}

/**
 * Map OpenWeatherMap condition codes to our condition types
 */
function mapCondition(weatherId: number): WeatherCondition {
  // OpenWeatherMap weather condition codes:
  // https://openweathermap.org/weather-conditions
  if (weatherId >= 200 && weatherId < 300) {
    return 'stormy'; // Thunderstorm
  }
  if (weatherId >= 300 && weatherId < 400) {
    return 'rainy'; // Drizzle
  }
  if (weatherId >= 500 && weatherId < 600) {
    return 'rainy'; // Rain
  }
  if (weatherId >= 600 && weatherId < 700) {
    return 'snowy'; // Snow
  }
  if (weatherId >= 700 && weatherId < 800) {
    return 'cloudy'; // Atmosphere (mist, fog, etc.)
  }
  if (weatherId === 800) {
    return 'sunny'; // Clear
  }
  if (weatherId === 801 || weatherId === 802) {
    return 'partly-cloudy'; // Few/scattered clouds
  }
  if (weatherId >= 803) {
    return 'cloudy'; // Broken/overcast clouds
  }
  return 'cloudy';
}

/**
 * Convert Kelvin to Fahrenheit
 */
function kelvinToFahrenheit(kelvin: number): number {
  return Math.round((kelvin - 273.15) * 9 / 5 + 32);
}

/** Convert Kelvin to Celsius. */
function kelvinToCelsius(kelvin: number): number {
  return Math.round(kelvin - 273.15);
}

/**
 * Convert m/s to mph
 */
function mpsToMph(mps: number): number {
  return Math.round(mps * 2.237);
}

/** Convert m/s to km/h. */
function mpsToKmh(mps: number): number {
  return Math.round(mps * 3.6);
}

/** Unit-aware temperature converter for callers that have a WeatherUnits handy. */
function tempFromKelvin(kelvin: number, units: WeatherUnits): number {
  return units.temperature === 'C' ? kelvinToCelsius(kelvin) : kelvinToFahrenheit(kelvin);
}

/** Unit-aware wind-speed converter. */
function windFromMps(mps: number, units: WeatherUnits): number {
  return units.windSpeed === 'km/h' ? mpsToKmh(mps) : mpsToMph(mps);
}

/**
 * Build a location query string for the OWM API.
 * Prefers lat/lon (unambiguous) over the legacy string query.
 */
function buildLocationParam(loc: LocationParam): string {
  if (typeof loc === 'object' && 'lat' in loc) {
    return `lat=${loc.lat}&lon=${loc.lon}`;
  }
  return `q=${encodeURIComponent(loc as string)}`;
}


/**
 * Fetch current weather data
 */
export async function fetchCurrentWeather(
  location?: LocationParam,
  units: WeatherUnits = { temperature: 'F', windSpeed: 'mph', precipitation: 'in' },
): Promise<CurrentWeather & { locationName: string; sunrise: Date; sunset: Date }> {
  const config = await getConfig();
  const loc = location ?? config.location;

  const url = `https://api.openweathermap.org/data/2.5/weather?${buildLocationParam(loc)}&appid=${config.apiKey}`;

  const response = await fetch(url, { next: { revalidate: 300 } }); // Cache for 5 minutes

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch current weather: ${error}`);
  }

  const data: OpenWeatherCurrent = await response.json();
  const weather = data.weather[0];

  if (!weather) {
    throw new Error('No weather data in response');
  }

  return {
    temperature: tempFromKelvin(data.main.temp, units),
    feelsLike: tempFromKelvin(data.main.feels_like, units),
    condition: mapCondition(weather.id),
    humidity: data.main.humidity,
    windSpeed: windFromMps(data.wind.speed, units),
    description: weather.description,
    locationName: data.name,
    sunrise: new Date(data.sys.sunrise * 1000),
    sunset: new Date(data.sys.sunset * 1000),
  };
}

/**
 * Fetch 5-day forecast (returns raw data too for period extraction)
 */
async function fetchForecastRaw(
  location?: LocationParam,
  units: WeatherUnits = { temperature: 'F', windSpeed: 'mph', precipitation: 'in' },
): Promise<{
  forecast: ForecastDay[];
  raw: OpenWeatherForecast['list'];
  /** The location's UTC offset in seconds (OpenWeather's city.timezone). */
  tzOffsetSec: number;
  hourly: HourlyForecast[];
  locationName: string;
}> {
  const config = await getConfig();
  const loc = location ?? config.location;

  const url = `https://api.openweathermap.org/data/2.5/forecast?${buildLocationParam(loc)}&appid=${config.apiKey}`;

  const response = await fetch(url, { next: { revalidate: 1800 } }); // Cache for 30 minutes

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch forecast: ${error}`);
  }

  const data: OpenWeatherForecast = await response.json();
  const dayNames = DAYS_SHORT_ARRAY;

  // Group forecast by location-local day (using the city's UTC offset)
  // so that day boundaries align with midnight at the weather location,
  // not UTC midnight (which can be as early as 7 PM in US time zones).
  const tzOffsetSec = data.city.timezone;

  // Today's date key in location-local time — used to skip stale past-day buckets.
  // OWM's 3-hour intervals start from the next UTC boundary, so when shifted to local
  // time the very first interval can still belong to the previous local day (e.g. a
  // 3 AM UTC Friday interval is 10 PM CDT Thursday). Without this guard the forecast
  // would open with "Thu" when it is already Friday locally.
  const nowLocalMs = (Math.floor(Date.now() / 1000) + tzOffsetSec) * 1000;
  const todayKey = new Date(nowLocalMs).toISOString().split('T')[0]!;

  const dailyData = new Map<
    string,
    { date: Date; temps: number[]; conditions: number[] }
  >();

  for (const item of data.list) {
    const date = new Date(item.dt * 1000);
    // Shift by the location's UTC offset so the ISO date reflects local date
    const localShifted = new Date((item.dt + tzOffsetSec) * 1000);
    const dateKey = localShifted.toISOString().split('T')[0]!;

    if (!dailyData.has(dateKey)) {
      dailyData.set(dateKey, {
        date,
        temps: [],
        conditions: [],
      });
    }

    const day = dailyData.get(dateKey)!;
    day.temps.push(item.main.temp);
    if (item.weather[0]) {
      day.conditions.push(item.weather[0].id);
    }
  }

  // Convert to ForecastDay array
  const forecast: ForecastDay[] = [];
  let count = 0;

  for (const [dateKey, dayData] of dailyData) {
    // Skip any bucket that belongs to a past local day
    if (dateKey < todayKey) continue;
    if (count >= 7) break;

    const high = Math.max(...dayData.temps);
    const low = Math.min(...dayData.temps);
    // Use the most common condition for the day
    const conditionCounts = new Map<number, number>();
    for (const cond of dayData.conditions) {
      conditionCounts.set(cond, (conditionCounts.get(cond) || 0) + 1);
    }
    let mostCommonCondition = dayData.conditions[0] || 800;
    let maxCount = 0;
    for (const [cond, cnt] of conditionCounts) {
      if (cnt > maxCount) {
        maxCount = cnt;
        mostCommonCondition = cond;
      }
    }

    // Derive day-of-week directly from the local dateKey ("YYYY-MM-DD") so the
    // label always matches the bucket's date, regardless of when the first
    // 3-hour sample within that bucket happened to fall in UTC.
    const [yr, mo, dy] = dateKey.split('-').map(Number);
    const dayIndex = new Date(Date.UTC(yr!, mo! - 1, dy!)).getUTCDay();
    forecast.push({
      // UTC midnight of the location's date (the ForecastDay.date contract),
      // not the first 3-hour sample, which can fall on the previous UTC day.
      date: dateOnlyToFloatingUtc(dateKey),
      dayName: dayNames[dayIndex] || 'Day',
      high: tempFromKelvin(high, units),
      low: tempFromKelvin(low, units),
      condition: mapCondition(mostCommonCondition),
    });

    count++;
  }

  const now = Date.now();
  const cutoff = now + 24 * 3_600_000;
  const hourly: HourlyForecast[] = data.list
    .filter((item) => {
      const t = item.dt * 1000;
      // Include the currently-active 3-hour interval (its timestamp may be up to 3h in the past)
      return t > now - 3 * 3_600_000 && t <= cutoff;
    })
    .map((item) => ({
      time: new Date(item.dt * 1000),
      condition: mapCondition(item.weather[0]?.id ?? 800),
      temp: tempFromKelvin(item.main.temp, units),
    }));

  return {
    forecast,
    raw: data.list,
    tzOffsetSec,
    hourly,
    locationName: `${data.city.name}, ${data.city.country}`,
  };
}

/**
 * Fetch 5-day forecast (public API)
 */
export async function fetchForecast(location?: LocationParam): Promise<{
  forecast: ForecastDay[];
  locationName: string;
}> {
  const result = await fetchForecastRaw(location);
  return { forecast: result.forecast, locationName: result.locationName };
}

/**
 * Extract today's period forecasts (Morning/Afternoon/Evening)
 * from the 3-hour forecast data.
 *
 * Hours and "today" are the weather location's, from its UTC offset
 * (`city.timezone`, seconds): the server's own clock is UTC on a default
 * install, which put Chicago's 8 AM in "Afternoon".
 */
function extractPeriods(
  forecastList: OpenWeatherForecast['list'],
  units: WeatherUnits,
  tzOffsetSec: number,
): ForecastPeriod[] {
  // A Date shifted by the offset reads the location's wall clock with the
  // UTC getters.
  const local = (unixSec: number) => new Date((unixSec + tzOffsetSec) * 1000);
  const todayStr = local(Math.floor(Date.now() / 1000)).toISOString().slice(0, 10);
  const periods: ForecastPeriod[] = [];

  // Morning: 6am-12pm, Afternoon: 12pm-6pm, Evening: 6pm-12am
  const periodDefs = [
    { label: 'Morn', minHour: 6, maxHour: 12 },
    { label: 'Aft', minHour: 12, maxHour: 18 },
    { label: 'Eve', minHour: 18, maxHour: 24 },
  ];

  for (const def of periodDefs) {
    const matching = forecastList.filter((item) => {
      const d = local(item.dt);
      const dateStr = d.toISOString().slice(0, 10);
      const hour = d.getUTCHours();
      return dateStr === todayStr && hour >= def.minHour && hour < def.maxHour;
    });

    if (matching.length > 0) {
      // Average temperature for the period
      const avgTemp = matching.reduce((sum, m) => sum + m.main.temp, 0) / matching.length;
      const condId = matching[0]!.weather[0]?.id || 800;
      periods.push({
        label: def.label,
        temp: tempFromKelvin(avgTemp, units),
        condition: mapCondition(condId),
      });
    }
  }

  return periods;
}

/**
 * Fetch complete weather data (current + forecast)
 */
export async function fetchWeatherData(
  location?: LocationParam,
  options?: WeatherOptions,
): Promise<WeatherData> {
  const units: WeatherUnits = options?.units ?? { temperature: 'F', windSpeed: 'mph', precipitation: 'in' };
  const [currentData, forecastData] = await Promise.all([
    fetchCurrentWeather(location, units),
    fetchForecastRaw(location, units),
  ]);

  const periods = extractPeriods(forecastData.raw, units, forecastData.tzOffsetSec);

  // Override the currently-active hourly interval with observed current conditions,
  // since the forecast model can disagree with what's actually happening right now.
  const nowMs = Date.now();
  const patchedHourly = forecastData.hourly.map((h) =>
    h.time.getTime() <= nowMs
      ? { ...h, condition: currentData.condition, temp: currentData.temperature }
      : h
  );

  const { lat, lon } = resolveLatLon(location);
  // Rise and set for the location's day, not the server's (see moon.ts): its
  // midnight from the UTC offset, the only zone information OpenWeather gives.
  const offsetMs = forecastData.tzOffsetSec * 1000;
  const dayMs = 24 * 3_600_000;
  const localMidnight = new Date(Math.floor((nowMs + offsetMs) / dayMs) * dayMs - offsetMs);
  const moon = getMoonData(lat, lon, new Date(), localMidnight);

  return {
    location: currentData.locationName,
    units,
    current: {
      temperature: currentData.temperature,
      feelsLike: currentData.feelsLike,
      condition: currentData.condition,
      humidity: currentData.humidity,
      windSpeed: currentData.windSpeed,
      description: currentData.description,
    },
    forecast: forecastData.forecast,
    hourly: patchedHourly,
    periods,
    sunrise: currentData.sunrise,
    sunset: currentData.sunset,
    moonrise: moon.moonrise,
    moonset: moon.moonset,
    moonPhase: moon.moonPhase,
    moonIllumination: moon.moonIllumination,
    moonPhaseName: moon.moonPhaseName,
    lat,
    lon,
    lastUpdated: new Date(),
  };
}
