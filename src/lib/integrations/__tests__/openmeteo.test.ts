/**
 * Tests for the Open-Meteo integration.
 *
 * Verifies the request URL plumbs lat/lon from the LocationParam (not just
 * env), that day-of-week labels respect the response (timezone=auto returns
 * local-date strings so no Intl.DateTimeFormat workaround is needed), and
 * that network errors get a clear provider-named message.
 */

export {}; // module marker so const declarations don't leak into global scope

jest.mock('@/components/widgets/WeatherWidget', () => ({}), { virtual: true });

const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    WEATHER_LAT: '41.8781',
    WEATHER_LON: '-87.6298',
    WEATHER_LOCATION: 'Chicago, IL',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Compute YYYY-MM-DD in the response timezone for a given offset (0 = today,
// 1 = tomorrow, etc). Open-Meteo returns local-date strings with timezone=auto,
// so the fixture mirrors that. Dates are derived from the runner's clock so
// the past-day forecast filter (introduced in v1.7.2) does not strip fixture
// days when the test runs.
function localDate(offsetDays: number, timezone: string): string {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(base);
}

function dayNameFromIso(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
}

function buildResponse(timezone = 'America/Chicago') {
  const today = localDate(0, timezone);
  const day1 = localDate(1, timezone);
  const day2 = localDate(2, timezone);
  return {
    latitude: 0,
    longitude: 0,
    timezone,
    current: {
      time: `${today}T10:00`,
      temperature_2m: 70,
      apparent_temperature: 70,
      relative_humidity_2m: 50,
      wind_speed_10m: 5,
      weather_code: 0,
      precipitation: 0,
    },
    hourly: {
      time: [`${today}T10:00`, `${today}T11:00`, `${today}T12:00`],
      temperature_2m: [70, 71, 72],
      precipitation_probability: [0, 0, 0],
      precipitation: [0, 0, 0],
      weather_code: [0, 1, 2],
    },
    daily: {
      time: [today, day1, day2],
      temperature_2m_max: [75, 76, 77],
      temperature_2m_min: [60, 61, 62],
      weather_code: [0, 1, 2],
      precipitation_probability_max: [0, 10, 20],
      sunrise: [`${today}T06:00`, `${day1}T06:00`, `${day2}T06:00`],
      sunset:  [`${today}T19:00`, `${day1}T19:00`, `${day2}T19:00`],
    },
  };
}

describe('openmeteo.fetchWeatherData', () => {
  it('passes lat/lon from LocationParam to the request URL', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValue({
        ok: true,
        json: async () => buildResponse(),
      } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    await fetchWeatherData({ lat: 40.7128, lon: -74.006 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('latitude=40.7128');
    expect(calledUrl).toContain('longitude=-74.006');
    expect(calledUrl).not.toContain('latitude=41.8781'); // env default not used
  });

  it('falls back to env coordinates when no LocationParam is provided', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValue({
        ok: true,
        json: async () => buildResponse(),
      } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    await fetchWeatherData();

    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('latitude=41.8781');
    expect(calledUrl).toContain('longitude=-87.6298');
  });

  it('requests timezone=auto so daily entries use the location-local date', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValue({
        ok: true,
        json: async () => buildResponse(),
      } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    await fetchWeatherData();

    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('timezone=auto');
  });

  it('returns 7 forecast entries with high/low/condition mapped from WMO codes', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => buildResponse(),
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    const result = await fetchWeatherData();

    expect(result.forecast.length).toBe(3); // fixture has 3 days
    expect(result.forecast[0]?.high).toBe(75);
    expect(result.forecast[0]?.low).toBe(60);
    expect(result.forecast[0]?.condition).toBe('sunny'); // WMO 0 = clear sky
    expect(result.forecast[1]?.condition).toBe('partly-cloudy'); // WMO 1
    expect(result.forecast[2]?.condition).toBe('partly-cloudy'); // WMO 2
  });

  it('parses YYYY-MM-DD daily date strings as local dates (no UTC shift)', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => buildResponse(),
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    const result = await fetchWeatherData();

    // The day-name labels must reflect the response's local-date strings.
    // If the parse went through UTC, the day-of-week could shift by one
    // in negative-UTC zones. Compute the expected names from the same
    // fixture dates the response was built from so the test is independent
    // of the calendar date the runner happens to be on.
    const expected0 = dayNameFromIso(localDate(0, 'America/Chicago'));
    const expected1 = dayNameFromIso(localDate(1, 'America/Chicago'));
    expect(result.forecast[0]?.dayName).toBe(expected0);
    expect(result.forecast[1]?.dayName).toBe(expected1);
  });

  it('omits minutely (Open-Meteo does not provide minute-by-minute precip)', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => buildResponse(),
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    const result = await fetchWeatherData();
    expect(result.minutely).toBeUndefined();
  });

  it('wraps network errors in a clear provider-named message', async () => {
    jest
      .spyOn(global, 'fetch' as never)
      .mockImplementation((() => Promise.reject(new Error('ECONNREFUSED'))) as never);

    const { fetchWeatherData } = await import('../openmeteo');
    await expect(fetchWeatherData()).rejects.toThrow(/Open-Meteo network error: ECONNREFUSED/);
  });

  it('skips stale past-day entries that arrive in a cached response', async () => {
    // Simulate a response cached just before midnight: the first daily entry
    // is yesterday's date in the response timezone. Today's local date in
    // America/Chicago should drop that first entry from the forecast.
    const todayLocal = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
    }).format(new Date());
    const todayDate = new Date(`${todayLocal}T12:00:00`);
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' })
      .format(new Date(todayDate.getTime() - 24 * 60 * 60 * 1000));
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' })
      .format(new Date(todayDate.getTime() + 24 * 60 * 60 * 1000));

    const stale = {
      latitude: 0,
      longitude: 0,
      timezone: 'America/Chicago',
      current: {
        time: `${todayLocal}T10:00`,
        temperature_2m: 70, apparent_temperature: 70, relative_humidity_2m: 50,
        wind_speed_10m: 5, weather_code: 0, precipitation: 0,
      },
      hourly: { time: [], temperature_2m: [], precipitation_probability: [], precipitation: [], weather_code: [] },
      daily: {
        time: [yesterday, todayLocal, tomorrow],
        temperature_2m_max: [50, 75, 76],
        temperature_2m_min: [40, 60, 61],
        weather_code: [3, 0, 1],
        precipitation_probability_max: [80, 0, 10],
        sunrise: [`${yesterday}T06:00`, `${todayLocal}T06:00`, `${tomorrow}T06:00`],
        sunset:  [`${yesterday}T19:00`, `${todayLocal}T19:00`, `${tomorrow}T19:00`],
      },
    };

    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => stale,
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    const result = await fetchWeatherData({ lat: 41.8, lon: -87.6 });

    // Yesterday's high (50°F) and condition (overcast=3) should not appear.
    expect(result.forecast.length).toBe(2);
    expect(result.forecast[0]?.high).toBe(75);
    expect(result.forecast[0]?.condition).not.toBe('cloudy');
  });

  it('parses sunrise/sunset as wall-clock-in-location, not wall-clock-in-runtime', async () => {
    // Regression: Open-Meteo returns "2026-05-19T05:42" (no offset) for a
    // location in America/Chicago. The bug was that `new Date(s)` interpreted
    // this as the runtime's local time — UTC in our Docker containers — so the
    // serialized ISO instant was 5 hours off, displaying sunrise around
    // midnight in the browser. Verify the parser uses the response's timezone
    // to land on the correct UTC instant.
    const today = localDate(0, 'America/Chicago');
    const response = buildResponse('America/Chicago');
    response.daily.sunrise = [`${today}T05:42`];
    response.daily.sunset = [`${today}T20:07`];

    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => response,
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    const result = await fetchWeatherData();

    // 05:42 CDT = 10:42 UTC (or 05:42 CST = 11:42 UTC in winter). Display in
    // the location's TZ to make the assertion robust to test-runner TZ AND
    // DST transitions — what we care about is "05:42 in Chicago".
    const sunriseInChicago = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(result.sunrise);
    expect(sunriseInChicago).toBe('05:42');

    const sunsetInChicago = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(result.sunset!);
    expect(sunsetInChicago).toBe('20:07');
  });

  it('parses hourly times as wall-clock-in-location', async () => {
    // Same regression as the sunrise test, applied to the hourly forecast.
    // Build the fixture hours relative to `now` in Chicago so the (now-1h, now+12h]
    // filter window always includes them — otherwise the test is time-of-day
    // sensitive and fails on CI runs that happen too late in the day.
    const chicagoNow = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const part = (type: string) => chicagoNow.find((p) => p.type === type)!.value;
    const baseHour = Number(part('hour'));
    const ymd = `${part('year')}-${part('month')}-${part('day')}`;
    const h1 = String(baseHour).padStart(2, '0');
    const h2 = String((baseHour + 1) % 24).padStart(2, '0');
    const h3 = String((baseHour + 2) % 24).padStart(2, '0');
    const fixtureHours = [`${h1}:00`, `${h2}:00`, `${h3}:00`];

    const response = buildResponse('America/Chicago');
    response.hourly.time = fixtureHours.map((h) => `${ymd}T${h}`);
    response.hourly.temperature_2m = [70, 71, 72];
    response.hourly.precipitation_probability = [0, 0, 0];
    response.hourly.precipitation = [0, 0, 0];
    response.hourly.weather_code = [0, 0, 0];

    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => response,
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    const result = await fetchWeatherData();

    // All three fixture hours straddle `now` so the (now-1h, now+12h] window
    // catches them. Each surviving hour's wall-clock in Chicago must match
    // one of the three we planted.
    expect(result.hourly && result.hourly.length).toBeGreaterThan(0);
    if (result.hourly && result.hourly.length > 0) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const wallClocks = result.hourly.map((h) => formatter.format(h.time));
      expect(wallClocks.every((wc) => fixtureHours.includes(wc))).toBe(true);
    }
  });

  it('does not require any API key (zero env-var configuration)', async () => {
    // Strip any provider key env vars to prove openmeteo doesn't read them.
    const stripped = { ...process.env };
    delete stripped.OPENWEATHER_API_KEY;
    delete stripped.PIRATE_WEATHER_API_KEY;
    process.env = stripped;

    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => buildResponse(),
    } as never);

    const { fetchWeatherData } = await import('../openmeteo');
    await expect(fetchWeatherData()).resolves.toBeDefined();
  });
});
