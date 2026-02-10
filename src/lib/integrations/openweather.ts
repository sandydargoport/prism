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

import type {
  WeatherData,
  WeatherCondition,
  CurrentWeather,
  ForecastDay,
  ForecastPeriod,
} from '@/components/widgets/WeatherWidget';

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
  };
}

/**
 * Get configuration from environment
 */
function getConfig() {
  const apiKey = process.env.OPENWEATHER_API_KEY;
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

/**
 * Convert m/s to mph
 */
function mpsToMph(mps: number): number {
  return Math.round(mps * 2.237);
}

/**
 * Fetch current weather data
 */
export async function fetchCurrentWeather(
  location?: string
): Promise<CurrentWeather & { locationName: string }> {
  const config = getConfig();
  const loc = location || config.location;

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(loc)}&appid=${config.apiKey}`;

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
    temperature: kelvinToFahrenheit(data.main.temp),
    feelsLike: kelvinToFahrenheit(data.main.feels_like),
    condition: mapCondition(weather.id),
    humidity: data.main.humidity,
    windSpeed: mpsToMph(data.wind.speed),
    description: weather.description,
    locationName: data.name,
  };
}

/**
 * Fetch 5-day forecast (returns raw data too for period extraction)
 */
async function fetchForecastRaw(location?: string): Promise<{
  forecast: ForecastDay[];
  raw: OpenWeatherForecast['list'];
  locationName: string;
}> {
  const config = getConfig();
  const loc = location || config.location;

  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(loc)}&appid=${config.apiKey}`;

  const response = await fetch(url, { next: { revalidate: 1800 } }); // Cache for 30 minutes

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch forecast: ${error}`);
  }

  const data: OpenWeatherForecast = await response.json();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group forecast by day and find daily highs/lows
  const dailyData = new Map<
    string,
    { date: Date; temps: number[]; conditions: number[] }
  >();

  for (const item of data.list) {
    const date = new Date(item.dt * 1000);
    const dateKey = date.toISOString().split('T')[0]!;

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

  for (const [, dayData] of dailyData) {
    if (count >= 5) break;

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

    const dayIndex = dayData.date.getDay();
    forecast.push({
      date: dayData.date,
      dayName: dayNames[dayIndex] || 'Day',
      high: kelvinToFahrenheit(high),
      low: kelvinToFahrenheit(low),
      condition: mapCondition(mostCommonCondition),
    });

    count++;
  }

  return {
    forecast,
    raw: data.list,
    locationName: `${data.city.name}, ${data.city.country}`,
  };
}

/**
 * Fetch 5-day forecast (public API)
 */
export async function fetchForecast(location?: string): Promise<{
  forecast: ForecastDay[];
  locationName: string;
}> {
  const result = await fetchForecastRaw(location);
  return { forecast: result.forecast, locationName: result.locationName };
}

/**
 * Extract today's period forecasts (Morning/Afternoon/Evening)
 * from the 3-hour forecast data.
 */
function extractPeriods(forecastList: OpenWeatherForecast['list']): ForecastPeriod[] {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const periods: ForecastPeriod[] = [];

  // Morning: 6am-12pm, Afternoon: 12pm-6pm, Evening: 6pm-12am
  const periodDefs = [
    { label: 'Morn', minHour: 6, maxHour: 12 },
    { label: 'Aft', minHour: 12, maxHour: 18 },
    { label: 'Eve', minHour: 18, maxHour: 24 },
  ];

  for (const def of periodDefs) {
    const matching = forecastList.filter((item) => {
      const d = new Date(item.dt * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const hour = d.getHours();
      return dateStr === todayStr && hour >= def.minHour && hour < def.maxHour;
    });

    if (matching.length > 0) {
      // Average temperature for the period
      const avgTemp = matching.reduce((sum, m) => sum + m.main.temp, 0) / matching.length;
      const condId = matching[0]!.weather[0]?.id || 800;
      periods.push({
        label: def.label,
        temp: kelvinToFahrenheit(avgTemp),
        condition: mapCondition(condId),
      });
    }
  }

  return periods;
}

/**
 * Fetch complete weather data (current + forecast)
 */
export async function fetchWeatherData(location?: string): Promise<WeatherData> {
  const [currentData, forecastData] = await Promise.all([
    fetchCurrentWeather(location),
    fetchForecastRaw(location),
  ]);

  const periods = extractPeriods(forecastData.raw);

  return {
    location: currentData.locationName,
    current: {
      temperature: currentData.temperature,
      feelsLike: currentData.feelsLike,
      condition: currentData.condition,
      humidity: currentData.humidity,
      windSpeed: currentData.windSpeed,
      description: currentData.description,
    },
    forecast: forecastData.forecast,
    periods,
    lastUpdated: new Date(),
  };
}
