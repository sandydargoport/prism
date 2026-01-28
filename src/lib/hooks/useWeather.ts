/**
 * ============================================================================
 * PRISM - useWeather Hook
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides a React hook for fetching weather data.
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WeatherData } from '@/components/widgets/WeatherWidget';

interface UseWeatherOptions {
  /** Location to fetch weather for */
  location?: string;
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number;
}

interface UseWeatherResult {
  data: WeatherData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching weather data
 */
export function useWeather(options: UseWeatherOptions = {}): UseWeatherResult {
  const { location, refreshInterval = 5 * 60 * 1000 } = options; // Default 5 minute refresh

  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch weather from API
   */
  const fetchWeather = useCallback(async () => {
    try {
      setError(null);

      const url = location
        ? `/api/weather?location=${encodeURIComponent(location)}`
        : '/api/weather';

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch weather');
      }

      const weatherData = await response.json();

      // Convert date strings to Date objects
      setData({
        ...weatherData,
        lastUpdated: new Date(weatherData.lastUpdated),
        forecast: weatherData.forecast.map((day: { date: string; dayName: string; high: number; low: number; condition: string }) => ({
          ...day,
          date: new Date(day.date),
        })),
      });
    } catch (err) {
      console.error('Error fetching weather:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch weather');
    } finally {
      setLoading(false);
    }
  }, [location]);

  // Initial fetch
  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(fetchWeather, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchWeather]);

  return {
    data,
    loading,
    error,
    refresh: fetchWeather,
  };
}
