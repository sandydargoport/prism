/**
 *
 * Displays current weather conditions and forecast.
 * Shows temperature, conditions, and a multi-day forecast.
 *
 * FEATURES:
 * - Current temperature and conditions
 * - "Feels like" temperature
 * - Humidity and wind info
 * - 5-day forecast
 * - Weather icons for conditions
 *
 * DATA SOURCE:
 * Uses OpenWeatherMap API (configured in .env).
 * For this component, we show a demo/mock version that works without API.
 * Real API integration is in src/lib/integrations/weather.ts
 *
 * USAGE:
 *   <WeatherWidget />
 *   <WeatherWidget location="Chicago, IL" />
 *
 */

'use client';

import * as React from 'react';
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, Wind, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer } from './WidgetContainer';


/**
 * WEATHER DATA TYPES
 */

/** Weather condition types */
export type WeatherCondition =
  | 'sunny'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rainy'
  | 'snowy'
  | 'stormy';

/** Current weather data */
export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  condition: WeatherCondition;
  humidity: number;
  windSpeed: number;
  description: string;
}

/** Forecast for a single day */
export interface ForecastDay {
  date: Date;
  dayName: string;
  high: number;
  low: number;
  condition: WeatherCondition;
}

/** Period forecast (morning/afternoon/evening) */
export interface ForecastPeriod {
  label: string;
  temp: number;
  condition: WeatherCondition;
}

/** Complete weather data */
export interface WeatherData {
  location: string;
  current: CurrentWeather;
  forecast: ForecastDay[];
  periods?: ForecastPeriod[];
  lastUpdated: Date;
}


/**
 * WEATHER WIDGET PROPS
 */
export interface WeatherWidgetProps {
  /** Location name (e.g., "Springfield, IL") */
  location?: string;
  /** Use Celsius instead of Fahrenheit */
  useCelsius?: boolean;
  /** Show extended forecast */
  showForecast?: boolean;
  /** Number of forecast days to show */
  forecastDays?: number;
  /** Weather data (if provided externally) */
  data?: WeatherData;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Grid width in layout units */
  gridW?: number;
  /** Grid height in layout units */
  gridH?: number;
  /** Additional CSS classes */
  className?: string;
}


/**
 * WEATHER WIDGET COMPONENT
 * Displays weather information with current conditions and forecast.
 *
 * NOTE: This version shows demo data. In production, you would:
 * 1. Fetch data from /api/weather endpoint
 * 2. Use React Query or SWR for caching
 * 3. Handle loading and error states properly
 *
 * @example Basic usage
 * <WeatherWidget />
 *
 * @example With location
 * <WeatherWidget location="Chicago, IL" />
 *
 * @example Celsius
 * <WeatherWidget useCelsius />
 */
export function WeatherWidget({
  location = 'Springfield, IL',
  useCelsius = false,
  showForecast = true,
  forecastDays,
  data: externalData,
  loading = false,
  error = null,
  gridW = 3,
  gridH = 3,
  className,
}: WeatherWidgetProps) {
  // Use provided data or demo data
  const weatherData = externalData || getDemoWeatherData(location);

  // Auto-orient: vertical if gridH > gridW, horizontal otherwise
  const isVertical = gridH > gridW;

  // Dynamic forecast days: scale with available space (1-5)
  const dynamicForecastDays = forecastDays ?? Math.max(1, Math.min(5, isVertical ? Math.min(3, gridW) : gridW - 1));

  // Convert temperature if needed
  const formatTemp = (fahrenheit: number): string => {
    if (useCelsius) {
      const celsius = Math.round((fahrenheit - 32) * 5 / 9);
      return `${celsius}°C`;
    }
    return `${Math.round(fahrenheit)}°F`;
  };

  return (
    <WidgetContainer
      title="Weather"
      icon={<Cloud className="h-4 w-4" />}
      size="medium"
      loading={loading}
      error={error}
      className={className}
    >
      <div className={cn('flex h-full', isVertical ? 'flex-col' : 'flex-col')}>
        {/* CURRENT CONDITIONS */}
        <div className="flex items-center justify-between mb-4">
          {/* Temperature and icon */}
          <div className="flex items-center gap-3">
            <WeatherIcon
              condition={weatherData.current.condition}
              className="h-12 w-12 text-primary"
            />
            <div>
              <div className="text-4xl font-bold">
                {formatTemp(weatherData.current.temperature)}
              </div>
              <div className="text-sm text-muted-foreground capitalize">
                {weatherData.current.description}
              </div>
            </div>
          </div>

          {/* Additional info */}
          <div className="text-right text-sm text-muted-foreground space-y-1">
            <div>Feels like {formatTemp(weatherData.current.feelsLike)}</div>
            <div className="flex items-center justify-end gap-1">
              <Droplets className="h-3 w-3" />
              {weatherData.current.humidity}%
            </div>
            <div className="flex items-center justify-end gap-1">
              <Wind className="h-3 w-3" />
              {weatherData.current.windSpeed} mph
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="text-xs text-muted-foreground mb-3">
          {weatherData.location}
        </div>

        {/* TODAY'S PERIODS (Morning/Afternoon/Evening) */}
        {weatherData.periods && weatherData.periods.length > 0 && (
          <div className="border-t border-border pt-2 pb-2 mb-1">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Today</div>
            <div className="flex gap-3">
              {weatherData.periods.map((period, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <WeatherIcon condition={period.condition} className="h-4 w-4 text-muted-foreground" />
                  <div className="text-xs">
                    <span className="text-muted-foreground">{period.label}</span>
                    {' '}
                    <span className="font-medium">{formatTemp(period.temp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FORECAST */}
        {showForecast && (
          <div className={cn('flex-1 border-t border-border pt-3')}>
            {isVertical ? (
              // Vertical layout: stack forecast days
              <div className="space-y-2">
                {weatherData.forecast.slice(0, dynamicForecastDays).map((day, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground w-8">{day.dayName}</span>
                    <WeatherIcon condition={day.condition} className="h-5 w-5 text-muted-foreground" />
                    <div className="text-xs">
                      <span className="font-medium">{formatTemp(day.high)}</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-muted-foreground">{formatTemp(day.low)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Horizontal layout: grid of forecast columns
              <div className={`grid gap-2 h-full`} style={{ gridTemplateColumns: `repeat(${dynamicForecastDays}, 1fr)` }}>
                {weatherData.forecast.slice(0, dynamicForecastDays).map((day, index) => (
                  <ForecastDayCard
                    key={index}
                    day={day}
                    formatTemp={formatTemp}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </WidgetContainer>
  );
}


/**
 * FORECAST DAY CARD
 * Displays a single day in the forecast.
 */
function ForecastDayCard({
  day,
  formatTemp,
}: {
  day: ForecastDay;
  formatTemp: (temp: number) => string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Day name */}
      <div className="text-xs font-medium text-muted-foreground mb-1">
        {day.dayName}
      </div>
      {/* Weather icon */}
      <WeatherIcon
        condition={day.condition}
        className="h-6 w-6 text-muted-foreground mb-1"
      />
      {/* High/Low temps */}
      <div className="text-xs">
        <span className="font-medium">{formatTemp(day.high)}</span>
        <span className="text-muted-foreground mx-1">/</span>
        <span className="text-muted-foreground">{formatTemp(day.low)}</span>
      </div>
    </div>
  );
}


/**
 * WEATHER ICON
 * Returns the appropriate icon for a weather condition.
 */
function WeatherIcon({
  condition,
  className,
}: {
  condition: WeatherCondition;
  className?: string;
}) {
  const icons: Record<WeatherCondition, React.ReactNode> = {
    'sunny': <Sun className={className} />,
    'partly-cloudy': <CloudSun className={className} />,
    'cloudy': <Cloud className={className} />,
    'rainy': <CloudRain className={className} />,
    'snowy': <CloudSnow className={className} />,
    'stormy': <CloudRain className={className} />,
  };

  return icons[condition] || <Cloud className={className} />;
}


/**
 * GET DEMO WEATHER DATA
 * Returns realistic demo data for development/testing.
 * In production, this would be fetched from the weather API.
 */
function getDemoWeatherData(location: string): WeatherData {
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return {
    location,
    current: {
      temperature: 42,
      feelsLike: 38,
      condition: 'partly-cloudy',
      humidity: 65,
      windSpeed: 12,
      description: 'Partly cloudy',
    },
    forecast: Array.from({ length: 5 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      // Vary the conditions slightly for realism
      const conditions: WeatherCondition[] = [
        'partly-cloudy', 'sunny', 'cloudy', 'rainy', 'sunny'
      ];

      return {
        date,
        dayName: dayNames[date.getDay()] || 'Day',
        high: 45 + Math.floor(Math.random() * 10),
        low: 32 + Math.floor(Math.random() * 8),
        condition: conditions[i] || 'sunny',
      };
    }),
    lastUpdated: new Date(),
  };
}
