/**
 * Tests for the OpenWeather integration.
 *
 * Covers: unit conversions, condition-code mapping, timezone-aware daily
 * grouping, stale past-day bucket exclusion (the "Thursday problem"), day-name
 * derivation from the local dateKey, hourly slicing, and error paths.
 */

export {};

jest.mock('@/components/widgets/WeatherWidget', () => ({}), { virtual: true });

const originalEnv = process.env;
const mockApiKey = 'test-owm-key';

// Fixed "now": 2026-05-01 15:00:00 UTC (Friday 10 AM CDT)
const MOCK_NOW = Date.UTC(2026, 4, 1, 15, 0, 0);

// CDT = UTC-5 → tzOffsetSec = -18000
const CDT_OFFSET = -18_000;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    OPENWEATHER_API_KEY: mockApiKey,
    WEATHER_LOCATION: 'TestCity,US',
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
  jest.resetModules();
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const SEC = (ms: number) => Math.floor(ms / 1000);

function currentResponse(overrides: Partial<{
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherId: number;
  description: string;
  name: string;
}> = {}) {
  return {
    main: {
      temp: overrides.temp ?? 300,
      feels_like: overrides.feelsLike ?? 300,
      humidity: overrides.humidity ?? 65,
    },
    wind: { speed: overrides.windSpeed ?? 5 },
    weather: [{
      id: overrides.weatherId ?? 800,
      main: 'Clear',
      description: overrides.description ?? 'clear sky',
      icon: '01d',
    }],
    name: overrides.name ?? 'TestCity',
    sys: { sunrise: 1_700_000_000, sunset: 1_700_050_000 },
  };
}

function forecastItem(dt: number, temp: number, weatherId = 800) {
  return {
    dt,
    main: { temp, temp_min: temp - 2, temp_max: temp + 2 },
    weather: [{ id: weatherId, main: 'Weather', description: 'weather' }],
  };
}

function forecastResponse(
  items: ReturnType<typeof forecastItem>[],
  tzOffsetSec = CDT_OFFSET,
  cityName = 'TestCity',
) {
  return {
    list: items,
    city: { name: cityName, country: 'US', timezone: tzOffsetSec },
  };
}

function mockFetch(body: object) {
  return jest.spyOn(global, 'fetch' as never).mockResolvedValue({
    ok: true,
    json: async () => body,
  } as never);
}

// ---------------------------------------------------------------------------
// fetchCurrentWeather — unit conversions
// ---------------------------------------------------------------------------

describe('fetchCurrentWeather — unit conversions', () => {
  it('converts 273.15 K (freezing) to exactly 32 °F', async () => {
    mockFetch(currentResponse({ temp: 273.15, feelsLike: 273.15 }));
    const { fetchCurrentWeather } = await import('../openweather');
    const result = await fetchCurrentWeather();
    expect(result.temperature).toBe(32);
    expect(result.feelsLike).toBe(32);
  });

  it('converts 373.15 K (boiling) to 212 °F', async () => {
    mockFetch(currentResponse({ temp: 373.15, feelsLike: 373.15 }));
    const { fetchCurrentWeather } = await import('../openweather');
    const result = await fetchCurrentWeather();
    expect(result.temperature).toBe(212);
  });

  it('rounds fractional Fahrenheit values', async () => {
    // 295 K → (295 - 273.15) × 9/5 + 32 = 71.33°F → rounds to 71
    mockFetch(currentResponse({ temp: 295 }));
    const { fetchCurrentWeather } = await import('../openweather');
    const result = await fetchCurrentWeather();
    expect(result.temperature).toBe(71);
  });

  it('converts 10 m/s wind to 22 mph', async () => {
    mockFetch(currentResponse({ windSpeed: 10 }));
    const { fetchCurrentWeather } = await import('../openweather');
    const result = await fetchCurrentWeather();
    expect(result.windSpeed).toBe(22);
  });

  it('converts 0 m/s wind to 0 mph', async () => {
    mockFetch(currentResponse({ windSpeed: 0 }));
    const { fetchCurrentWeather } = await import('../openweather');
    const result = await fetchCurrentWeather();
    expect(result.windSpeed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fetchCurrentWeather — condition code mapping
// ---------------------------------------------------------------------------

describe('fetchCurrentWeather — condition code mapping', () => {
  const cases: [number, string, string][] = [
    [200,  'stormy',        'thunderstorm (200)'],
    [299,  'stormy',        'thunderstorm (299)'],
    [300,  'rainy',         'drizzle (300)'],
    [399,  'rainy',         'drizzle (399)'],
    [500,  'rainy',         'rain (500)'],
    [599,  'rainy',         'rain (599)'],
    [600,  'snowy',         'snow (600)'],
    [699,  'snowy',         'snow (699)'],
    [700,  'cloudy',        'atmosphere/mist (700)'],
    [741,  'cloudy',        'fog (741)'],
    [799,  'cloudy',        'atmosphere (799)'],
    [800,  'sunny',         'clear sky (800)'],
    [801,  'partly-cloudy', 'few clouds (801)'],
    [802,  'partly-cloudy', 'scattered clouds (802)'],
    [803,  'cloudy',        'broken clouds (803)'],
    [804,  'cloudy',        'overcast (804)'],
  ];

  it.each(cases)('code %i → "%s" (%s)', async (code, expected) => {
    mockFetch(currentResponse({ weatherId: code }));
    const { fetchCurrentWeather } = await import('../openweather');
    const result = await fetchCurrentWeather();
    expect(result.condition).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// fetchCurrentWeather — error paths
// ---------------------------------------------------------------------------

describe('fetchCurrentWeather — errors', () => {
  it('throws on non-OK HTTP response', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: false,
      text: async () => 'City not found',
    } as never);

    const { fetchCurrentWeather } = await import('../openweather');
    await expect(fetchCurrentWeather()).rejects.toThrow('Failed to fetch current weather');
  });
});

// ---------------------------------------------------------------------------
// fetchForecast — timezone-aware daily grouping
// ---------------------------------------------------------------------------

describe('fetchForecast — timezone-aware daily grouping', () => {
  it('buckets a 3 AM UTC item into the PREVIOUS local day (CDT)', async () => {
    // 3am UTC May 1 = 10pm CDT April 30 (Thursday) → dateKey "2026-04-30"
    // Today (mocked) = 2026-05-01 in CDT, so April 30 is in the past and excluded.
    // Separately, 6am UTC May 1 = 1am CDT May 1 → dateKey "2026-05-01" → included.
    const thu3amUtc = SEC(Date.UTC(2026, 4, 1, 3, 0, 0));  // CDT: Thu Apr 30 10pm
    const fri6amUtc = SEC(Date.UTC(2026, 4, 1, 6, 0, 0));  // CDT: Fri May 1  1am

    mockFetch(forecastResponse([
      forecastItem(thu3amUtc, 290),
      forecastItem(fri6amUtc, 295),
    ]));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    // Thursday bucket is in the past → excluded; Friday is today → included
    expect(result.forecast).toHaveLength(1);
    expect(result.forecast[0]?.dayName).toBe('Fri');
  });

  it('skips daily buckets that fall before today at the location timezone', async () => {
    // Build one item each for: Thu Apr 30, Fri May 1, Sat May 2 (all CDT).
    // Thu is yesterday → must be excluded. Fri and Sat → included.
    const thuItem = SEC(Date.UTC(2026, 3, 30, 12, 0, 0)); // Thu Apr 30 7am CDT
    const friItem = SEC(Date.UTC(2026, 4, 1,  12, 0, 0)); // Fri May 1  7am CDT
    const satItem = SEC(Date.UTC(2026, 4, 2,  12, 0, 0)); // Sat May 2  7am CDT

    mockFetch(forecastResponse([
      forecastItem(thuItem, 280),
      forecastItem(friItem, 285),
      forecastItem(satItem, 290),
    ]));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    const dayNames = result.forecast.map((d) => d.dayName);
    expect(dayNames).not.toContain('Thu');
    expect(dayNames).toContain('Fri');
    expect(dayNames).toContain('Sat');
  });

  it('derives day name from the local dateKey, not the UTC timestamp', async () => {
    // 2026-05-01 03:00 UTC = 2026-04-30 22:00 CDT (Thursday night).
    // The dateKey for this item is "2026-04-30" (Thursday).
    // HOWEVER today is May 1 (Friday) so Thursday is skipped.
    // A mid-day Friday item (12pm UTC May 1 = 7am CDT May 1) → "Fri".
    const friNoon = SEC(Date.UTC(2026, 4, 1, 12, 0, 0));

    mockFetch(forecastResponse([forecastItem(friNoon, 290)]));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    expect(result.forecast[0]?.dayName).toBe('Fri');
  });

  it('correctly labels a UTC-midnight item using the location timezone', async () => {
    // With UTC offset = 0, local date == UTC date.
    // 2026-05-01 noon UTC → dateKey "2026-05-01" → "Fri"
    const noonUtc = SEC(Date.UTC(2026, 4, 1, 12, 0, 0));

    mockFetch(forecastResponse([forecastItem(noonUtc, 290)], 0));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    expect(result.forecast[0]?.dayName).toBe('Fri');
  });

  it('limits the forecast to at most 7 days', async () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      forecastItem(SEC(Date.UTC(2026, 4, 1 + i, 12, 0, 0)), 290)
    );

    mockFetch(forecastResponse(items));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    expect(result.forecast.length).toBeLessThanOrEqual(7);
  });

  it('uses the most common condition code for the day', async () => {
    const base = SEC(Date.UTC(2026, 4, 1, 6, 0, 0)); // CDT: Fri 1am (today)

    mockFetch(forecastResponse([
      forecastItem(base,          290, 800), // sunny  ×1
      forecastItem(base + 10800,  290, 500), // rainy  ×3
      forecastItem(base + 21600,  290, 500),
      forecastItem(base + 32400,  290, 500),
    ]));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    expect(result.forecast[0]?.condition).toBe('rainy');
  });

  it('reports the max as high and min as low for the day', async () => {
    const base = SEC(Date.UTC(2026, 4, 1, 6, 0, 0));

    mockFetch(forecastResponse([
      forecastItem(base,         273.15, 800), // 32°F
      forecastItem(base + 10800, 300,    800), // 80°F
      forecastItem(base + 21600, 295,    800), // 71°F
    ]));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    expect(result.forecast[0]?.high).toBe(80);
    expect(result.forecast[0]?.low).toBe(32);
  });

  it('includes the city name and country in locationName', async () => {
    mockFetch(forecastResponse(
      [forecastItem(SEC(Date.UTC(2026, 4, 1, 12, 0, 0)), 290)],
      0,
      'Springfield',
    ));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    expect(result.locationName).toBe('Springfield, US');
  });
});

// ---------------------------------------------------------------------------
// fetchForecast — day boundary precision
// ---------------------------------------------------------------------------

describe('fetchForecast — day boundary precision', () => {
  it('item at exactly CDT midnight (05:00 UTC) goes into the new day', async () => {
    // 2026-05-01 05:00:00 UTC = 2026-05-01 00:00:00 CDT → Friday bucket (today)
    const cdtMidnight = SEC(Date.UTC(2026, 4, 1, 5, 0, 0));
    mockFetch(forecastResponse([forecastItem(cdtMidnight, 290)]));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();
    expect(result.forecast).toHaveLength(1);
    expect(result.forecast[0]?.dayName).toBe('Fri');
  });

  it('item 1 second before CDT midnight goes into the prior day and is excluded', async () => {
    // 2026-05-01 04:59:59 UTC = 2026-04-30 23:59:59 CDT → Thursday bucket (past)
    const justBeforeMidnight = SEC(Date.UTC(2026, 4, 1, 4, 59, 59));
    const fridayNoon         = SEC(Date.UTC(2026, 4, 1, 12,  0,  0));

    mockFetch(forecastResponse([
      forecastItem(justBeforeMidnight, 400), // Thu — excluded
      forecastItem(fridayNoon,         290), // Fri — included
    ]));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    expect(result.forecast).toHaveLength(1);
    expect(result.forecast[0]?.dayName).toBe('Fri');
    // 400 K → 261 °F should NOT appear; 290 K → 62 °F should be high AND low
    expect(result.forecast[0]?.high).toBe(62);
    expect(result.forecast[0]?.low).toBe(62);
  });

  it('past-day temperatures do not pollute the current day high/low', async () => {
    const thuItem = SEC(Date.UTC(2026, 3, 30, 12, 0, 0)); // Thu Apr 30 (past)
    const friItem = SEC(Date.UTC(2026, 4,  1, 12, 0, 0)); // Fri May 1  (today)

    mockFetch(forecastResponse([
      forecastItem(thuItem, 320), // 320 K → 116 °F — excluded
      forecastItem(friItem, 280), // 280 K →  44 °F — today only
    ]));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    const fri = result.forecast.find((d) => d.dayName === 'Fri');
    expect(fri?.high).toBe(44); // not 116 from Thursday
    expect(fri?.low).toBe(44);
  });

  it('items straddling midnight split cleanly into their respective day buckets', async () => {
    // 04:59 UTC May 1 = 23:59 CDT Apr 30 (Thu) → excluded
    // 05:01 UTC May 1 = 00:01 CDT May 1  (Fri) → Fri, rainy
    // 06:00 UTC May 2 = 01:00 CDT May 2  (Sat) → Sat, partly-cloudy
    const thuEnd   = SEC(Date.UTC(2026, 4, 1, 4, 59, 0));
    const friStart = SEC(Date.UTC(2026, 4, 1, 5,  1, 0));
    const satItem  = SEC(Date.UTC(2026, 4, 2, 6,  0, 0));

    mockFetch(forecastResponse([
      forecastItem(thuEnd,   283, 800), // ~50 °F  Thu — excluded
      forecastItem(friStart, 293, 500), // ~68 °F  Fri — rainy
      forecastItem(satItem,  298, 801), // ~77 °F  Sat — partly-cloudy
    ]));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    expect(result.forecast).toHaveLength(2);
    expect(result.forecast[0]?.dayName).toBe('Fri');
    expect(result.forecast[0]?.condition).toBe('rainy');
    expect(result.forecast[1]?.dayName).toBe('Sat');
    expect(result.forecast[1]?.condition).toBe('partly-cloudy');
  });

  it('a positive UTC offset (e.g. UTC+5:30 IST) rolls items forward into the next local day', async () => {
    // IST = UTC+5:30 → tzOffsetSec = +19800
    // 2026-05-01 00:00 UTC = 2026-05-01 05:30 IST → Friday bucket (today)
    const utcMidnight = SEC(Date.UTC(2026, 4, 1, 0, 0, 0));

    // Today in IST at MOCK_NOW (15:00 UTC) = 20:30 IST = still Fri
    // todayKey with IST offset: (MOCK_NOW/1000 + 19800) → ~20:30 IST → "2026-05-01"
    mockFetch(forecastResponse([forecastItem(utcMidnight, 305)], 19_800));
    const { fetchForecast } = await import('../openweather');
    const result = await fetchForecast();

    expect(result.forecast[0]?.dayName).toBe('Fri');
  });
});

// ---------------------------------------------------------------------------
// fetchForecast — hourly slice
// ---------------------------------------------------------------------------

describe('fetchForecast — hourly slice', () => {
  it('includes 3-hour intervals within [now − 3 h, now + 24 h]', async () => {
    // tooOld: 4h before now → excluded
    // justIn: 2h before now → included (active interval lookback = 3h)
    // future24: exactly 24h after now → included
    // tooFar: 25h after now → excluded
    const tooOld  = SEC(MOCK_NOW - 4 * 3_600_000);
    const justIn  = SEC(MOCK_NOW - 2 * 3_600_000);
    const future24 = SEC(MOCK_NOW + 24 * 3_600_000);
    const tooFar  = SEC(MOCK_NOW + 25 * 3_600_000);

    const allItems = [tooOld, justIn, future24, tooFar].map((dt) =>
      forecastItem(dt, 290)
    );

    mockFetch(forecastResponse(allItems));
    const { fetchForecast } = await import('../openweather');

    // fetchForecast doesn't expose hourly directly — use fetchWeatherData instead
    const { fetchWeatherData } = await import('../openweather');

    // Re-mock since fetchWeatherData makes two fetch calls
    jest.restoreAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_NOW);
    jest.spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce({ ok: true, json: async () => currentResponse() } as never) // current
      .mockResolvedValueOnce({ ok: true, json: async () => forecastResponse(allItems) } as never); // forecast

    const result = await fetchWeatherData();
    const hourlyTimes = result.hourly!.map((h) => h.time.getTime() / 1000);

    expect(hourlyTimes).not.toContain(tooOld);
    expect(hourlyTimes).toContain(justIn);
    expect(hourlyTimes).toContain(future24);
    expect(hourlyTimes).not.toContain(tooFar);
  });
});

// ---------------------------------------------------------------------------
// fetchForecast — error paths
// ---------------------------------------------------------------------------

describe('fetchForecast — errors', () => {
  it('throws on non-OK HTTP response', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: false,
      text: async () => 'Unauthorized',
    } as never);

    const { fetchForecast } = await import('../openweather');
    await expect(fetchForecast()).rejects.toThrow('Failed to fetch forecast');
  });
});

describe('the location zone, not the server clock', () => {
  // 8 AM, 2 PM and 8 PM CDT on Fri 1 May; 8 PM is already 2 May in UTC.
  const items = [
    forecastItem(SEC(Date.UTC(2026, 4, 1, 13)), 283),
    forecastItem(SEC(Date.UTC(2026, 4, 1, 19)), 293),
    forecastItem(SEC(Date.UTC(2026, 4, 2, 1)), 288),
  ];

  it('anchors each forecast date at UTC midnight of the local date', async () => {
    mockFetch(forecastResponse(items));
    const { fetchForecast } = await import('../openweather');
    const { forecast } = await fetchForecast();
    expect(forecast[0]!.date.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(forecast).toHaveLength(1);
  });

  it('buckets morning, afternoon and evening by the location hour', async () => {
    jest.spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce({ ok: true, json: async () => currentResponse() } as never)
      .mockResolvedValueOnce({ ok: true, json: async () => forecastResponse(items) } as never);
    const { fetchWeatherData } = await import('../openweather');
    const result = await fetchWeatherData();
    expect(result.periods?.map((p) => p.label)).toEqual(['Morn', 'Aft', 'Eve']);
  });
});
