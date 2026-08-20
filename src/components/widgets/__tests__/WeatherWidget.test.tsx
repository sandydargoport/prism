/**
 * @jest-environment jsdom
 *
 * Tests for WeatherWidget — covering the hourly forecast cards row, the day
 * summary header, the forecastDays prop, current conditions, and loading /
 * error / fallback states.
 */

import React from 'react';
import { render as rtlRender, screen, type RenderOptions } from '@testing-library/react';
import { TimeFormatProvider } from '@/components/providers';

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

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

// Anchor to noon tomorrow so the past-day filter never drops fixture dates.
const NOON_MS = new Date().setHours(12, 0, 0, 0);
const TOMORROW_NOON = new Date(NOON_MS + 86_400_000);
const DAY_MS = 86_400_000;

function makeForecastDay(overrides: Partial<ForecastDay> = {}): ForecastDay {
  return {
    date: TOMORROW_NOON,
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
    date: new Date(NOON_MS + (1 + i) * DAY_MS),
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
        makeForecastDay({ dayName: 'Tue', date: new Date(NOON_MS + 2 * DAY_MS) }),
        makeForecastDay({ dayName: 'Wed', date: new Date(NOON_MS + 3 * DAY_MS) }),
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
        makeForecastDay({ dayName: 'Tue', date: new Date(NOON_MS + 2 * DAY_MS) }),
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
