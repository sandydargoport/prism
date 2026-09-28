/**
 * Tests for the Pirate Weather integration.
 *
 * Covers: URL construction, icon→condition mapping, unit conversions,
 * timezone-aware day labels, hourly filtering + patching, period extraction,
 * sunrise/sunset, minutely passthrough, and error paths.
 */

export {}; // module marker so const declarations don't leak into global scope

jest.mock('@/components/widgets/WeatherWidget', () => ({}), { virtual: true });

const originalEnv = process.env;
const mockApiKey = 'test-pirate-key';

// Fixed "now" so hourly-window tests are deterministic.
// 2026-05-01 15:00 UTC = 10:00 AM CDT (Friday)
const MOCK_NOW = Date.UTC(2026, 4, 1, 15, 0, 0);

beforeAll(() => {
  process.env = {
    ...originalEnv,
    PIRATE_WEATHER_API_KEY: mockApiKey,
    WEATHER_LAT: '41.8781',
    WEATHER_LON: '-87.6298',
    WEATHER_LOCATION: 'Chicago, IL',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(MOCK_NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const SEC = (ms: number) => Math.floor(ms / 1000);

function daily(dt: number, overrides: Partial<{
  icon: string;
  temperatureHigh: number;
  temperatureLow: number;
  precipProbability: number;
}> = {}) {
  return {
    time: dt,
    icon: overrides.icon ?? 'clear-day',
    temperatureHigh: overrides.temperatureHigh ?? 75,
    temperatureLow: overrides.temperatureLow ?? 55,
    precipProbability: overrides.precipProbability ?? 0,
    sunriseTime: dt + 6 * 3600,
    sunsetTime: dt + 19 * 3600,
  };
}

function hourly(dt: number, overrides: Partial<{
  icon: string;
  temperature: number;
  precipProbability: number;
  precipIntensity: number;
}> = {}) {
  return {
    time: dt,
    icon: overrides.icon ?? 'clear-day',
    temperature: overrides.temperature ?? 68,
    precipProbability: overrides.precipProbability ?? 0,
    precipIntensity: overrides.precipIntensity ?? 0,
  };
}

function buildResponse(overrides: Partial<{
  timezone: string;
  currentIcon: string;
  currentTemp: number;
  currentFeelsLike: number;
  currentHumidity: number;
  currentWindSpeed: number;
  currentSummary: string;
  currentPrecipIntensity: number;
  dailyData: ReturnType<typeof daily>[];
  hourlyData: ReturnType<typeof hourly>[];
  minutelyData: { time: number; precipIntensity: number; precipProbability: number }[];
}> = {}) {
  const now = SEC(MOCK_NOW);
  return {
    latitude: 41.8781,
    longitude: -87.6298,
    timezone: overrides.timezone ?? 'America/Chicago',
    currently: {
      time: now,
      icon: overrides.currentIcon ?? 'clear-day',
      temperature: overrides.currentTemp ?? 70,
      apparentTemperature: overrides.currentFeelsLike ?? 68,
      humidity: overrides.currentHumidity ?? 0.65,
      windSpeed: overrides.currentWindSpeed ?? 10,
      precipIntensity: overrides.currentPrecipIntensity ?? 0,
      precipProbability: 0,
      summary: overrides.currentSummary,
    },
    minutely: overrides.minutelyData ? { data: overrides.minutelyData } : undefined,
    hourly: { data: overrides.hourlyData ?? [] },
    daily: { data: overrides.dailyData ?? [daily(now)] },
  };
}

function mockFetch(body: object) {
  return jest.spyOn(global, 'fetch' as never).mockResolvedValue({
    ok: true,
    json: async () => body,
  } as never);
}

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

describe('URL construction', () => {
  it('uses lat/lon from LocationParam, ignoring env coordinates', async () => {
    const spy = mockFetch(buildResponse());
    const { fetchWeatherData } = await import('../pirateweather');
    await fetchWeatherData({ lat: 40.7128, lon: -74.006 });

    const url = spy.mock.calls[0]![0] as string;
    expect(url).toContain('/40.7128,-74.006?');
    expect(url).not.toContain('41.8781');
  });

  it('falls back to env coordinates when no LocationParam provided', async () => {
    const spy = mockFetch(buildResponse());
    const { fetchWeatherData } = await import('../pirateweather');
    await fetchWeatherData();

    const url = spy.mock.calls[0]![0] as string;
    expect(url).toContain('/41.8781,-87.6298?');
  });

  it('uses env coordinates but overrides display name for string location', async () => {
    const spy = mockFetch(buildResponse());
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData('Springfield, IL');

    const url = spy.mock.calls[0]![0] as string;
    expect(url).toContain('/41.8781,-87.6298?');   // env coords used
    expect(result.location).toBe('Springfield, IL'); // string becomes display name
  });

  it('includes the API key in the URL', async () => {
    const spy = mockFetch(buildResponse());
    const { fetchWeatherData } = await import('../pirateweather');
    await fetchWeatherData();

    const url = spy.mock.calls[0]![0] as string;
    expect(url).toContain(mockApiKey);
  });
});

// ---------------------------------------------------------------------------
// Icon → condition mapping
// ---------------------------------------------------------------------------

describe('mapIcon — icon string → WeatherCondition', () => {
  const cases: [string, string][] = [
    ['clear-day',           'sunny'],
    ['clear-night',         'sunny'],
    ['partly-cloudy-day',   'partly-cloudy'],
    ['partly-cloudy-night', 'partly-cloudy'],
    ['cloudy',              'cloudy'],
    ['fog',                 'cloudy'],
    ['wind',                'cloudy'],
    ['rain',                'rainy'],
    ['drizzle',             'rainy'],
    ['snow',                'snowy'],
    ['sleet',               'snowy'],
    ['thunderstorm',        'stormy'],
    ['unknown-icon',        'cloudy'], // default
  ];

  it.each(cases)('"%s" → "%s"', async (icon, expectedCondition) => {
    mockFetch(buildResponse({ currentIcon: icon }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.current.condition).toBe(expectedCondition);
  });
});

// ---------------------------------------------------------------------------
// Current conditions
// ---------------------------------------------------------------------------

describe('current conditions', () => {
  it('rounds temperature to nearest integer', async () => {
    mockFetch(buildResponse({ currentTemp: 72.7, currentFeelsLike: 69.3 }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.current.temperature).toBe(73);
    expect(result.current.feelsLike).toBe(69);
  });

  it('converts humidity from 0–1 to integer percent', async () => {
    mockFetch(buildResponse({ currentHumidity: 0.78 }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.current.humidity).toBe(78);
  });

  it('rounds wind speed to nearest integer', async () => {
    mockFetch(buildResponse({ currentWindSpeed: 7.6 }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.current.windSpeed).toBe(8);
  });

  it('uses summary as description when present', async () => {
    mockFetch(buildResponse({ currentSummary: 'Light drizzle' }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.current.description).toBe('Light drizzle');
  });

  it('falls back to icon name (dashes → spaces) when summary is absent', async () => {
    const response = buildResponse({ currentIcon: 'partly-cloudy-day' });
    // Remove summary so the fallback triggers
    (response.currently as { summary?: string }).summary = undefined;
    mockFetch(response);
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.current.description).toBe('partly cloudy day');
  });
});

// ---------------------------------------------------------------------------
// 7-day forecast
// ---------------------------------------------------------------------------

describe('7-day forecast', () => {
  it('caps at 7 days even when API returns more', async () => {
    const days = Array.from({ length: 10 }, (_, i) =>
      daily(SEC(MOCK_NOW) + i * 86400)
    );
    mockFetch(buildResponse({ dailyData: days }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.forecast).toHaveLength(7);
  });

  it('labels each day using the response timezone, not UTC', async () => {
    // 2026-05-03 00:00 UTC = Sat 7pm in Chicago (CDT, UTC-5) → still Sat
    const saturdayUtcMidnight = SEC(Date.UTC(2026, 4, 3, 0, 0, 0));
    mockFetch(buildResponse({
      timezone: 'America/Chicago',
      dailyData: [daily(saturdayUtcMidnight)],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.forecast[0]?.dayName).toBe('Sat');
  });

  it('uses LA timezone for the same UTC midnight (still Saturday in LA)', async () => {
    const saturdayUtcMidnight = SEC(Date.UTC(2026, 4, 3, 0, 0, 0));
    mockFetch(buildResponse({
      timezone: 'America/Los_Angeles',
      dailyData: [daily(saturdayUtcMidnight)],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.forecast[0]?.dayName).toBe('Sat');
  });

  it('includes precipProbability as an integer percent', async () => {
    mockFetch(buildResponse({
      dailyData: [daily(SEC(MOCK_NOW), { precipProbability: 0.73 })],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.forecast[0]?.precipProbability).toBe(73);
  });

  it('maps forecast condition from the daily icon', async () => {
    mockFetch(buildResponse({
      dailyData: [daily(SEC(MOCK_NOW), { icon: 'rain' })],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.forecast[0]?.condition).toBe('rainy');
  });
});

// ---------------------------------------------------------------------------
// 7-day forecast — day boundaries
// ---------------------------------------------------------------------------

describe('7-day forecast — day boundaries', () => {
  it('excludes a stale yesterday entry from daily.data[0]', async () => {
    // Pirate Weather can return yesterday as daily.data[0] when serving a
    // cached response generated before local midnight. That entry must be dropped.
    //
    // Thursday midnight CDT = 2026-04-30 00:00 CDT = 2026-04-30T05:00:00Z
    const thuMidnightCdt = SEC(Date.UTC(2026, 3, 30, 5, 0, 0)); // Thu (past)
    // Friday midnight CDT = 2026-05-01 00:00 CDT = 2026-05-01T05:00:00Z
    const friMidnightCdt = SEC(Date.UTC(2026, 4,  1, 5, 0, 0)); // Fri (today)

    mockFetch(buildResponse({
      timezone: 'America/Chicago',
      dailyData: [
        daily(thuMidnightCdt), // yesterday — must be excluded
        daily(friMidnightCdt), // today — must be first entry
      ],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    expect(result.forecast[0]?.dayName).toBe('Fri');
    expect(result.forecast).toHaveLength(1);
  });

  it('past-day high/low do not appear in the forecast', async () => {
    const thuMidnightCdt = SEC(Date.UTC(2026, 3, 30, 5, 0, 0));
    const friMidnightCdt = SEC(Date.UTC(2026, 4,  1, 5, 0, 0));

    mockFetch(buildResponse({
      timezone: 'America/Chicago',
      dailyData: [
        daily(thuMidnightCdt, { temperatureHigh: 999, temperatureLow: -999 }),
        daily(friMidnightCdt, { temperatureHigh: 75,  temperatureLow: 58  }),
      ],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    expect(result.forecast[0]?.high).toBe(75);
    expect(result.forecast[0]?.low).toBe(58);
  });

  it('today is the first entry when the API data is current', async () => {
    const friMidnightCdt = SEC(Date.UTC(2026, 4, 1, 5, 0, 0));

    mockFetch(buildResponse({
      timezone: 'America/Chicago',
      dailyData: [daily(friMidnightCdt)],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    expect(result.forecast[0]?.dayName).toBe('Fri');
  });

  it('an EDT location (UTC-4) with 4am UTC midnight entry is correctly labeled', async () => {
    // Eastern Daylight Time: midnight EDT = 04:00 UTC
    const friMidnightEdt = SEC(Date.UTC(2026, 4, 1, 4, 0, 0)); // Fri 00:00 EDT

    mockFetch(buildResponse({
      timezone: 'America/New_York',
      dailyData: [daily(friMidnightEdt)],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    expect(result.forecast[0]?.dayName).toBe('Fri');
  });

  it('a UTC midnight entry in a UTC+5:30 timezone (IST) is correctly labeled as the local day', async () => {
    // 2026-05-01 00:00 UTC = 2026-05-01 05:30 IST → Friday
    const utcMidnight = SEC(Date.UTC(2026, 4, 1, 0, 0, 0));

    mockFetch(buildResponse({
      timezone: 'Asia/Kolkata',
      dailyData: [daily(utcMidnight)],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    // 00:00 UTC = 05:30 IST on the same calendar day → still Friday
    expect(result.forecast[0]?.dayName).toBe('Fri');
  });
});

// ---------------------------------------------------------------------------
// Hourly forecast
// ---------------------------------------------------------------------------

describe('hourly forecast', () => {
  it('only returns items within [now − 1 h, now + 12 h]', async () => {
    const tooOld      = SEC(MOCK_NOW - 2 * 3_600_000);  // 2 h ago — excluded
    const recentStart = SEC(MOCK_NOW - 30 * 60_000);     // 30 min ago — included
    const current     = SEC(MOCK_NOW);
    const future6h    = SEC(MOCK_NOW + 6 * 3_600_000);
    const future12h   = SEC(MOCK_NOW + 12 * 3_600_000);  // boundary — included
    const tooFar      = SEC(MOCK_NOW + 13 * 3_600_000);  // excluded

    mockFetch(buildResponse({
      hourlyData: [
        hourly(tooOld),
        hourly(recentStart),
        hourly(current),
        hourly(future6h),
        hourly(future12h),
        hourly(tooFar),
      ],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    const times = result.hourly!.map((h) => h.time.getTime());
    expect(times).not.toContain(tooOld * 1000);
    expect(times).toContain(recentStart * 1000);
    expect(times).toContain(future12h * 1000);
    expect(times).not.toContain(tooFar * 1000);
  });

  it('patches the currently-active hour with observed current conditions', async () => {
    // An hourly slot that started 30 minutes ago is "active"
    const activeSlot = SEC(MOCK_NOW - 30 * 60_000);

    mockFetch(buildResponse({
      currentIcon: 'rain',
      currentTemp: 58,
      currentPrecipIntensity: 0.05,
      hourlyData: [
        hourly(activeSlot, { icon: 'clear-day', temperature: 65 }),
      ],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    const active = result.hourly!.find((h) => h.time.getTime() === activeSlot * 1000);
    expect(active?.condition).toBe('rainy');
    expect(active?.temp).toBe(58);
    expect(active?.precipIntensity).toBe(0.05);
  });

  it('does not patch future hourly slots', async () => {
    const futureSlot = SEC(MOCK_NOW + 2 * 3_600_000);

    mockFetch(buildResponse({
      currentIcon: 'rain',
      currentTemp: 58,
      hourlyData: [hourly(futureSlot, { icon: 'clear-day', temperature: 72 })],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    const future = result.hourly!.find((h) => h.time.getTime() === futureSlot * 1000);
    expect(future?.condition).toBe('sunny');    // unchanged
    expect(future?.temp).toBe(72);
  });

  it('includes precipProbability and precipIntensity on hourly entries', async () => {
    const slot = SEC(MOCK_NOW + 3_600_000);
    mockFetch(buildResponse({
      hourlyData: [hourly(slot, { precipProbability: 0.4, precipIntensity: 0.02 })],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    const h = result.hourly![0];
    expect(h?.precipProbability).toBe(40);
    expect(h?.precipIntensity).toBe(0.02);
  });
});

// ---------------------------------------------------------------------------
// Sunrise / sunset
// ---------------------------------------------------------------------------

describe('sunrise and sunset', () => {
  it('exposes sunrise and sunset from daily[0]', async () => {
    const base = SEC(MOCK_NOW);
    const sunriseTs = base + 6 * 3600;
    const sunsetTs  = base + 19 * 3600;

    mockFetch(buildResponse({
      dailyData: [{ ...daily(base), sunriseTime: sunriseTs, sunsetTime: sunsetTs }],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    expect(result.sunrise?.getTime()).toBe(sunriseTs * 1000);
    expect(result.sunset?.getTime()).toBe(sunsetTs * 1000);
  });

  it('returns undefined sunrise/sunset when daily data is empty', async () => {
    const response = buildResponse({ dailyData: [] });
    response.daily = { data: [] };
    mockFetch(response);
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    expect(result.sunrise).toBeUndefined();
    expect(result.sunset).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Minutely data
// ---------------------------------------------------------------------------

describe('minutely precipitation', () => {
  it('passes minutely data through when the API includes it', async () => {
    const minutelyData = [
      { time: SEC(MOCK_NOW), precipIntensity: 0.1, precipProbability: 0.8 },
      { time: SEC(MOCK_NOW) + 60, precipIntensity: 0.0, precipProbability: 0.1 },
    ];
    mockFetch(buildResponse({ minutelyData }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    expect(result.minutely).toEqual(minutelyData);
  });

  it('returns undefined minutely when the API omits it', async () => {
    mockFetch(buildResponse()); // no minutelyData in overrides → undefined
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();

    expect(result.minutely).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('throws when PIRATE_WEATHER_API_KEY is not set', async () => {
    const savedKey = process.env.PIRATE_WEATHER_API_KEY;
    delete process.env.PIRATE_WEATHER_API_KEY;

    // Re-import so the module re-reads env
    jest.resetModules();
    const { fetchWeatherData } = await import('../pirateweather');
    await expect(fetchWeatherData()).rejects.toThrow('PIRATE_WEATHER_API_KEY');

    process.env.PIRATE_WEATHER_API_KEY = savedKey;
  });

  it('throws on non-OK HTTP response', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: false,
      text: async () => 'Forbidden',
    } as never);

    jest.resetModules();
    const { fetchWeatherData } = await import('../pirateweather');
    await expect(fetchWeatherData()).rejects.toThrow('Failed to fetch Pirate Weather data');
  });

  it('wraps network errors with a descriptive message', async () => {
    jest.spyOn(global, 'fetch' as never).mockImplementation(
      (() => Promise.reject(new Error('ECONNREFUSED'))) as never
    );
    jest.resetModules();
    const { fetchWeatherData } = await import('../pirateweather');
    await expect(fetchWeatherData()).rejects.toThrow(/Pirate Weather network error: ECONNREFUSED/);
  });
});

describe('the location zone, not the server clock', () => {
  it('anchors each forecast date at UTC midnight of the local date', async () => {
    // Pirate's daily time is the location's midnight: 05:00Z on 1 May in Chicago.
    mockFetch(buildResponse({ dailyData: [daily(SEC(Date.UTC(2026, 4, 1, 5, 0, 0)))] }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.forecast[0]!.date.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('buckets morning, afternoon and evening by the location hour', async () => {
    // 8 AM, 2 PM and 8 PM CDT on 1 May. On a UTC server the old code put 8 AM
    // in "Afternoon" and dropped 8 PM, which is already 2 May in UTC.
    mockFetch(buildResponse({
      hourlyData: [
        hourly(SEC(Date.UTC(2026, 4, 1, 13)), { temperature: 50 }),
        hourly(SEC(Date.UTC(2026, 4, 1, 19)), { temperature: 70 }),
        hourly(SEC(Date.UTC(2026, 4, 2, 1)), { temperature: 60 }),
      ],
    }));
    const { fetchWeatherData } = await import('../pirateweather');
    const result = await fetchWeatherData();
    expect(result.periods?.map((p) => [p.label, p.temp])).toEqual([['Morn', 50], ['Aft', 70], ['Eve', 60]]);
  });
});
