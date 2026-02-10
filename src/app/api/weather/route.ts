/**
 *
 * Provides weather data from OpenWeatherMap API.
 *
 * ENDPOINT: /api/weather
 * - GET: Fetch current weather and forecast
 *
 * QUERY PARAMETERS:
 * - location: Location string (e.g., "Chicago,IL,US")
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { optionalAuth } from '@/lib/auth';
import { fetchWeatherData } from '@/lib/integrations/openweather';
import { getCached } from '@/lib/cache/redis';

// Cache weather data for 30 minutes
const WEATHER_CACHE_TTL = 30 * 60;

/**
 * GET /api/weather
 * Fetches weather data for a location (cached for 30 minutes)
 */
export async function GET(request: NextRequest) {
  // Weather is available to everyone - no auth required for read-only
  const _auth = await optionalAuth();

  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location') || process.env.WEATHER_LOCATION || 'Chicago,IL,US';

    // Create a cache key based on location
    const cacheKey = `weather:${location.toLowerCase().replace(/\s+/g, '-')}`;

    // Get from cache or fetch fresh
    const weatherData = await getCached(
      cacheKey,
      () => fetchWeatherData(location),
      WEATHER_CACHE_TTL
    );

    return NextResponse.json(weatherData);
  } catch (error) {
    console.error('Weather API error:', error);

    // Check if it's a configuration error
    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json(
        { error: 'Weather API not configured', details: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
