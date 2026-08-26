/**
 * Weather provider factory.
 * Selects the active provider based on the WEATHER_PROVIDER env var.
 *
 *   WEATHER_PROVIDER=meteo       → Open-Meteo (DEFAULT — no API key required)
 *   WEATHER_PROVIDER=pirate      → Pirate Weather (Dark Sky-compatible, key required)
 *   WEATHER_PROVIDER=openweather → OpenWeatherMap (key required)
 *
 * The default is Open-Meteo so a fresh install has working weather with zero
 * env-var configuration. Users who want minutely precipitation forecasts can
 * opt into Pirate Weather by setting PIRATE_WEATHER_API_KEY.
 *
 * Usage:
 *   import { fetchWeatherData, type LocationParam } from '@/lib/integrations/weather';
 */

import type { WeatherData, WeatherUnits } from '@/components/widgets/WeatherWidget';

/**
 * A location to fetch weather for.
 *
 * `displayName` matters for providers that return no place name of their own.
 * Open-Meteo is coordinates-in, coordinates-out, so without the label the
 * caller chose there is nothing to show the user, and the widget falls back to
 * whatever WEATHER_LOCATION happens to say — which is how a saved location of
 * Leverkusen ended up displaying as Springfield (#295).
 */
export type LocationParam = string | { lat: number; lon: number; displayName?: string };

export interface WeatherOptions {
  units?: WeatherUnits;
}

export async function fetchWeatherData(
  location?: LocationParam,
  options?: WeatherOptions,
): Promise<WeatherData> {
  const provider = process.env.WEATHER_PROVIDER ?? 'meteo';

  if (provider === 'openweather') {
    const { fetchWeatherData: fetchOW } = await import('./openweather');
    return fetchOW(location, options);
  }

  if (provider === 'pirate') {
    const { fetchWeatherData: fetchPW } = await import('./pirateweather');
    return fetchPW(location, options);
  }

  const { fetchWeatherData: fetchOM } = await import('./openmeteo');
  return fetchOM(location, options);
}
