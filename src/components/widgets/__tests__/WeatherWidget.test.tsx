/**
 * @jest-environment jsdom
 *
 * Tests for WeatherWidget — covering the hourly forecast cards row, the day
 * summary header, the forecastDays prop, current conditions, and loading /
 * error / fallback states.
 */

import React from 'react';
import { act, render as rtlRender, screen, type RenderOptions } from '@testing-library/react';
import { TimeFormatProvider } from '@/components/providers';
import * as SunCalc from 'suncalc';

// WeatherWidget consumes useTimeFormat(), which requires a TimeFormatProvider
// ancestor. Wrap every render so the widget mounts the way it does in the app.
const render = (ui: React.ReactElement, options?: RenderOptions) =>
  rtlRender(ui, { wrapper: TimeFormatProvider, ...options });

// TimeFormatProvider fetches /api/settings on mount; jsdom has no global fetch,
// so stub it to a benign empty-settings response (the widget falls back to
// DEFAULT_TIME_FORMAT / UTC, which is what these assertions expect).
beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ settings: {} }) }),
  ) as unknown as typeof fetch;
});
afterAll(() => {
  delete (global as { fetch?: unknown }).fetch;
});

// --- mocks (must precede component import) ---------------------------------

jest.mock('suncalc', () => {
  const actual = jest.requireActual<typeof import('suncalc')>('suncalc');
  return {
    ...actual,
    getPosition: jest.fn(actual.getPosition),
    getMoonPosition: jest.fn(actual.getMoonPosition),
  };
});

const realSunCalc = jest.requireActual<typeof import('suncalc')>('suncalc');

// Stub WidgetContainer so we don't pull in next/link, Radix UI, etc.
jest.mock('../WidgetContainer', () => ({
  WidgetContainer: function MockWidgetContainer({
    children,
    title,
    loading,
    error,
  }: {
    children: React.ReactNode;
    title?: string;
    loading?: boolean;
    error?: string | null;
  }) {
    if (loading) return <div data-testid="loading-state">Loading</div>;
    if (error)   return <div data-testid="error-state">{error}</div>;
    return (
      <div data-testid="widget-container">
        {title && <div data-testid="widget-title">{title}</div>}
        {children}
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------

import { WeatherWidget } from '../WeatherWidget';
import type { WeatherData, ForecastDay, HourlyForecast, WeatherCondition } from '../WeatherWidget';

afterEach(() => {
  jest.useRealTimers();
  jest.mocked(SunCalc.getPosition).mockImplementation(realSunCalc.getPosition);
  jest.mocked(SunCalc.getMoonPosition).mockImplementation(realSunCalc.getMoonPosition);
});

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

// Providers store forecast.date as UTC midnight of the location's calendar
// day, and the widget reads it with getUTC*. So a fixture is UTC midnight of
// the local date `offset` days from today. Local noon only matched that
// contract near UTC: at UTC+14 tomorrow's local noon is still today in UTC,
// and the first column read TODAY instead of its weekday.
function forecastDate(offset: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset));
}
// Tomorrow, so the past-day filter never drops fixture dates.
const TOMORROW = forecastDate(1);

function makeForecastDay(overrides: Partial<ForecastDay> = {}): ForecastDay {
  return {
    date: TOMORROW,
    dayName: 'Tue',
    high: 72,
    low: 55,
    condition: 'sunny',
    ...overrides,
  };
}

/**
 * Build 24 hourly items anchored to the current hour so they pass the
 * "endTime in the future" filter in HourlyTimeline. The first item is "now",
 * the second is "now + 1 hour", etc.
 */
function makeHourlyForecast(
  conditionOrList: WeatherCondition | WeatherCondition[] = 'sunny',
  temp = 70,
): HourlyForecast[] {
  const conditions: WeatherCondition[] = Array.isArray(conditionOrList)
    ? conditionOrList
    : Array(24).fill(conditionOrList);

  // Anchor to the top of the current hour
  const base = new Date();
  base.setMinutes(0, 0, 0);

  return Array.from({ length: 24 }, (_, i) => ({
    time:      new Date(base.getTime() + i * 60 * 60_000),
    condition: conditions[i] ?? 'sunny',
    temp,
  }));
}

const DEFAULT_UNITS = { temperature: 'F' as const, windSpeed: 'mph' as const, precipitation: 'in' as const };

/** Build a full WeatherData object. */
function makeWeatherData(overrides: Partial<WeatherData> = {}): WeatherData {
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Start from tomorrow so no entry lands on "today" (which renders as 'TODAY'
  // rather than the dayName, breaking tests that check for specific day labels).
  const forecast: ForecastDay[] = DAY_NAMES.slice(0, 5).map((dayName, i) => ({
    date: forecastDate(1 + i),
    dayName,
    high: 70 + i,
    low:  50 + i,
    condition: 'sunny' as WeatherCondition,
  }));

  return {
    location: 'Chicago, IL',
    units: DEFAULT_UNITS,
    current: {
      temperature: 68,
      feelsLike:   65,
      condition:   'sunny',
      humidity:    45,
      windSpeed:   10,
      description: 'Clear sky',
    },
    forecast,
    hourly: makeHourlyForecast('sunny'),
    lastUpdated: new Date(),
    ...overrides,
  };
}


// ===========================================================================
// 1. Hourly forecast cards
// ===========================================================================

describe('hourly forecast cards', () => {
  it('renders the section header with the visible-hour count', () => {
    render(<WeatherWidget data={makeWeatherData()} />);
    expect(screen.queryByText(/Next 8 Hours/)).not.toBeNull();
  });

  it('renders the "Now" label for the first card', () => {
    render(<WeatherWidget data={makeWeatherData()} />);
    expect(screen.queryByText('Now')).not.toBeNull();
  });

  it('renders one card per hour for 8 upcoming hours', () => {
    const { container } = render(<WeatherWidget data={makeWeatherData()} />);
    // Each card has a Now/time label rendered as a span; "Now" + 7 more
    const labels = Array.from(container.querySelectorAll('span'))
      .map((s) => s.textContent ?? '')
      .filter((t) => t === 'Now' || /^\d{1,2}(am|pm)$/.test(t));
    expect(labels.length).toBeGreaterThanOrEqual(8);
  });

  it('renders the hourly temperature in each card', () => {
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny', 73) });
    render(<WeatherWidget data={data} />);
    // The temp appears in hourly cards and possibly current conditions; just
    // check that at least one occurrence is visible.
    expect(screen.queryAllByText(/73°/).length).toBeGreaterThan(0);
  });

  it('converts hourly temps to °C when useCelsius=true', () => {
    // 32°F → 0°C
    const data = makeWeatherData({ hourly: makeHourlyForecast('sunny', 32) });
    render(<WeatherWidget data={data} useCelsius />);
    expect(screen.queryAllByText(/0°/).length).toBeGreaterThan(0);
  });

  it('renders nothing for the hourly section when no hourly data', () => {
    render(<WeatherWidget data={makeWeatherData({ hourly: [] })} />);
    expect(screen.queryByText(/Next .* Hours/)).toBeNull();
  });

  it('moves the "Now" card along as time passes, without new data', () => {
    // A wall display keeps the same forecast for a while between fetches, so
    // the row has to follow the clock rather than the last render.
    jest.useFakeTimers({ now: new Date('2026-06-15T10:30:00Z') });
    const base = new Date('2026-06-15T10:00:00Z').getTime();
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      time: new Date(base + i * 60 * 60_000),
      condition: 'sunny' as WeatherCondition,
      temp: 100 + i, // unique per hour, and clear of every other temp shown
    }));
    render(<WeatherWidget data={makeWeatherData({ hourly })} />);
    expect(screen.queryAllByText(/^100°/).length).toBeGreaterThan(0);

    act(() => { jest.advanceTimersByTime(2 * 60 * 60_000); });

    expect(screen.queryAllByText(/^100°/)).toHaveLength(0);
    expect(screen.queryAllByText(/^101°/)).toHaveLength(0);
    expect(screen.queryAllByText(/^102°/).length).toBeGreaterThan(0);
  });

  it('hides the hourly section when showForecast=false', () => {
    render(<WeatherWidget data={makeWeatherData()} showForecast={false} />);
    expect(screen.queryByText(/Next .* Hours/)).toBeNull();
  });
});


// ===========================================================================
// 2. Day summary header (driven by forecastDays, not the hourly row)
// ===========================================================================

describe('day summary header', () => {
  it('renders a label for each forecast day', () => {
    const data = makeWeatherData({
      forecast: [
        makeForecastDay({ dayName: 'Mon' }),
        makeForecastDay({ dayName: 'Tue', date: forecastDate(2) }),
        makeForecastDay({ dayName: 'Wed', date: forecastDate(3) }),
      ],
    });
    render(<WeatherWidget data={data} forecastDays={3} />);

    // Widget calls dayName.toUpperCase() — DOM has 'MON' not 'Mon'
    expect(screen.queryByText('MON')).not.toBeNull();
    expect(screen.queryByText('TUE')).not.toBeNull();
    expect(screen.queryByText('WED')).not.toBeNull();
  });

  it('renders the correct number of day columns', () => {
    const data = makeWeatherData();
    const { container } = render(<WeatherWidget data={data} forecastDays={4} />);

    const dayColumns = container.querySelectorAll('[class*="flex-1"]');
    expect(dayColumns.length).toBeGreaterThanOrEqual(4);
  });

  it('shows the high temperature for each day in °F', () => {
    const data = makeWeatherData({
      forecast: [makeForecastDay({ dayName: 'Mon', high: 88, low: 60 })],
    });
    render(<WeatherWidget data={data} forecastDays={1} />);
    expect(screen.queryAllByText(/88°/).length).toBeGreaterThan(0);
  });

  it('shows the low temperature for each day in °F', () => {
    const data = makeWeatherData({
      forecast: [makeForecastDay({ dayName: 'Mon', high: 72, low: 44 })],
    });
    render(<WeatherWidget data={data} forecastDays={1} />);
    expect(screen.queryAllByText(/44°/).length).toBeGreaterThan(0);
  });

  it('displays temperatures as-is when data.units.temperature is C', () => {
    // Server returned values in °C — widget should not re-convert.
    const data = makeWeatherData({
      units: { temperature: 'C', windSpeed: 'km/h', precipitation: 'mm' },
      forecast: [makeForecastDay({ high: 35, low: 10 })],
    });
    render(<WeatherWidget data={data} forecastDays={1} />);
    expect(screen.queryAllByText(/35°/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/10°/).length).toBeGreaterThan(0);
  });

  it('renders an icon for each day in the header', () => {
    const data = makeWeatherData();
    const { container } = render(<WeatherWidget data={data} forecastDays={3} />);

    const svgs = container.querySelectorAll('svg');
    // At minimum: 1 current-conditions icon + 3 day header icons + hourly icons
    expect(svgs.length).toBeGreaterThanOrEqual(4);
  });
});


// ===========================================================================
// 3. forecastDays prop — controls the day summary, not the hourly cards
// ===========================================================================

describe('forecastDays prop', () => {
  it('picks the forecast length from the widget height when not specified', () => {
    const data = makeWeatherData();
    // Taller widget shows more days; a shorter one shows fewer (auto-fit).
    const { rerender } = render(<WeatherWidget data={data} gridH={17} />);
    expect(screen.queryByText('5-Day Forecast')).not.toBeNull();
    rerender(<WeatherWidget data={data} gridH={12} />);
    expect(screen.queryByText('3-Day Forecast')).not.toBeNull();
  });

  it('respects an explicit forecastDays value', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} forecastDays={3} />);
    expect(screen.queryByText('3-Day Forecast')).not.toBeNull();
  });

  it('shows only forecastDays day columns in the header', () => {
    const data = makeWeatherData(); // 5 days: Mon–Fri
    render(<WeatherWidget data={data} forecastDays={2} />);

    expect(screen.queryByText('MON')).not.toBeNull();
    expect(screen.queryByText('TUE')).not.toBeNull();
    expect(screen.queryByText('WED')).toBeNull();
  });

  it('shows only available days when fewer than forecastDays exist', () => {
    const data = makeWeatherData({
      forecast: [
        makeForecastDay({ dayName: 'Mon' }),
        makeForecastDay({ dayName: 'Tue', date: forecastDate(2) }),
      ],
    });
    render(<WeatherWidget data={data} forecastDays={5} />);

    // Label reflects actual visible days, not the requested prop
    expect(screen.queryByText('2-Day Forecast')).not.toBeNull();
    // Header shows only the 2 days that exist
    expect(screen.queryByText('MON')).not.toBeNull();
    expect(screen.queryByText('TUE')).not.toBeNull();
    expect(screen.queryByText('WED')).toBeNull();
  });
});


// ===========================================================================
// 4. Current conditions display
// ===========================================================================

describe('current conditions', () => {
  it('renders the current temperature in °F by default', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, temperature: 73 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('73°F')).not.toBeNull();
  });

  it('renders °C suffix when data.units.temperature is C', () => {
    // Server returns 0°C directly — widget renders the value with the unit
    // from data.units, not by client-side conversion.
    const data = makeWeatherData({
      units: { temperature: 'C', windSpeed: 'km/h', precipitation: 'mm' },
      current: { ...makeWeatherData().current, temperature: 0 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('0°C')).not.toBeNull();
  });

  it('renders the weather description', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, description: 'Heavy thunderstorm' },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('Heavy thunderstorm')).not.toBeNull();
  });

  it('renders the location name', () => {
    const data = makeWeatherData({ location: 'Denver, CO' });
    render(<WeatherWidget data={data} />);
    // formatLocation returns the city portion only
    expect(screen.queryByText('Denver')).not.toBeNull();
  });

  it('renders the "feels like" temperature', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, feelsLike: 60 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText(/Feels like 60°F/)).not.toBeNull();
  });

  it('renders humidity percentage', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, humidity: 78 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('78%')).not.toBeNull();
  });

  it('renders wind speed in mph', () => {
    const data = makeWeatherData({
      current: { ...makeWeatherData().current, windSpeed: 15 },
    });
    render(<WeatherWidget data={data} />);
    expect(screen.queryByText('15 mph')).not.toBeNull();
  });
});


// ===========================================================================
// 5. showForecast prop
// ===========================================================================

describe('showForecast prop', () => {
  it('renders the forecast section by default', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} />);
    // Default height (12 rows) auto-fits to a 3-day forecast + hourly timeline.
    expect(screen.queryByText('3-Day Forecast')).not.toBeNull();
    expect(screen.queryByText(/Next 8 Hours/)).not.toBeNull();
  });

  it('hides the forecast section when showForecast=false', () => {
    const data = makeWeatherData();
    render(<WeatherWidget data={data} showForecast={false} />);

    expect(screen.queryByText('5-Day Forecast')).toBeNull();
    expect(screen.queryByText(/Next .* Hours/)).toBeNull();
  });
});


// ===========================================================================
// 6. Loading and error states
// ===========================================================================

describe('loading and error states', () => {
  it('renders the loading state when loading=true', () => {
    render(<WeatherWidget loading />);
    expect(screen.queryByTestId('loading-state')).not.toBeNull();
  });

  it('renders the error message when error is provided', () => {
    render(<WeatherWidget error="Weather service unavailable" />);
    expect(screen.queryByText('Weather service unavailable')).not.toBeNull();
  });

  it('renders the widget content when neither loading nor error', () => {
    render(<WeatherWidget data={makeWeatherData()} />);
    expect(screen.queryByTestId('widget-container')).not.toBeNull();
  });
});


// ===========================================================================
// 7. Demo data fallback
// ===========================================================================

describe('demo data fallback', () => {
  it('renders without errors when no data prop is provided', () => {
    expect(() => render(<WeatherWidget />)).not.toThrow();
  });

  it('uses demo location when no location or data is provided', () => {
    render(<WeatherWidget />);
    expect(screen.queryByText('Melrose')).not.toBeNull();
  });

  it('shows the passed location in demo mode', () => {
    render(<WeatherWidget location="Austin, TX" />);
    expect(screen.queryByText('Austin')).not.toBeNull();
  });

  it('renders the hourly forecast cards with demo data', () => {
    render(<WeatherWidget />);
    expect(screen.queryByText(/Next .* Hours/)).not.toBeNull();
    expect(screen.queryByText('Now')).not.toBeNull();
  });
});


// ===========================================================================
// 8. Sun and moon arc geometry
// ===========================================================================

describe('sun and moon arcs', () => {
  it('converts SunCalc v2 degree altitudes before plotting the arcs', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 17, 12, 0));

    jest.mocked(SunCalc.getPosition).mockReturnValue({ altitude: 45, azimuth: 0 });
    jest.mocked(SunCalc.getMoonPosition).mockReturnValue({
      altitude: -30,
      azimuth: 0,
      distance: 384_400,
      parallacticAngle: 0,
    });

    const { container } = render(
      <WeatherWidget
        data={makeWeatherData({
          sunrise: new Date(2026, 6, 17, 5, 30),
          sunset: new Date(2026, 6, 17, 20, 15),
          moonrise: new Date(2026, 6, 17, 21, 0),
          moonset: new Date(2026, 6, 18, 5, 0),
          moonPhase: 0.5,
        })}
      />
    );

    const sunPath = Array.from(container.querySelectorAll('path'))
      .find((path) => path.getAttribute('stroke')?.startsWith('url(#sun-grad-'));

    // 45° maps halfway from the horizon at 66 to the zenith at 10. Treating
    // SunCalc v2's degrees as radians would clamp the point to y=10 instead.
    expect(sunPath?.getAttribute('d')).toContain('38.0');
  });
});


// ===========================================================================
// 9. An eclipse on the sun and moon arc
// ===========================================================================

describe('an eclipse on the arc', () => {
  // A partial solar eclipse from noon to two, at its peak at one.
  const solar = {
    body: 'sun' as const,
    kind: 'partial' as const,
    begin: new Date(2026, 6, 17, 12, 0),
    peak: new Date(2026, 6, 17, 13, 0),
    end: new Date(2026, 6, 17, 14, 0),
    obscuration: 0.6,
  };
  const day = (eclipse: WeatherData['eclipse']) => makeWeatherData({
    sunrise: new Date(2026, 6, 17, 5, 30),
    sunset: new Date(2026, 6, 17, 20, 15),
    moonrise: new Date(2026, 6, 17, 21, 0),
    moonset: new Date(2026, 6, 18, 5, 0),
    moonPhase: 0.5,
    lat: 45,
    lon: -100,
    eclipse,
  });
  const at = (h: number) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 17, h, 0));
  };

  it('outlines it ahead of time, where the sun will be at its peak, and says when', () => {
    at(9);
    render(<WeatherWidget data={day(solar)} />);
    const marker = screen.getByTestId('eclipse-marker');
    expect(marker.textContent).toMatch(/^Eclipse 1:00/);
    expect(screen.getByTestId('eclipse-line').textContent)
      .toMatch(/^Partial solar eclipse: 12:00.* to 2:00.*, peak 1:00/);
    // Nothing is covered yet.
    expect(screen.queryByTestId('eclipse-shadow')).toBeNull();
  });

  it('shows the shadow across the sun while it happens', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 17, 12, 30));
    // The sun is up: pinned, because the fixture's place and the clock's zone
    // need not agree, and in Tokyo 12:30 is the middle of the night at 100W.
    jest.mocked(SunCalc.getPosition).mockReturnValue({ altitude: 40, azimuth: 180 });
    render(<WeatherWidget data={day(solar)} />);
    expect(screen.getByTestId('eclipse-shadow')).toBeTruthy();
    // Once it has begun the outline has done its job; it would only sit on
    // top of the real thing.
    expect(screen.queryByTestId('eclipse-marker')).toBeNull();
    expect(screen.getByTestId('eclipse-line')).toBeTruthy();
  });

  it('is gone once it is over', () => {
    at(15);
    render(<WeatherWidget data={day(solar)} />);
    expect(screen.queryByTestId('eclipse-marker')).toBeNull();
    expect(screen.queryByTestId('eclipse-shadow')).toBeNull();
    expect(screen.queryByTestId('eclipse-line')).toBeNull();
  });

  it('turns the moon copper during a lunar eclipse', () => {
    at(23);
    jest.mocked(SunCalc.getMoonPosition).mockReturnValue({
      altitude: 30, azimuth: 180, distance: 384_400, parallacticAngle: 0,
    });
    render(<WeatherWidget data={day({
      ...solar,
      body: 'moon',
      kind: 'total',
      begin: new Date(2026, 6, 17, 22, 0),
      peak: new Date(2026, 6, 17, 23, 0),
      end: new Date(2026, 6, 18, 0, 0),
      obscuration: 1,
    })} />);
    expect(screen.getByTestId('eclipse-shadow').getAttribute('fill')).toBe('#B45309');
    expect(screen.getByTestId('eclipse-line').textContent).toMatch(/^Total lunar eclipse/);
  });
});
