/**
 *
 * Displays current weather conditions, a multi-day forecast summary,
 * and a 24-hour hourly timeline.
 * Uses merry-timeline to render the next 24 hours as a color-coded strip.
 *
 * FEATURES:
 * - Current temperature and conditions
 * - "Feels like" temperature, humidity, wind
 * - Multi-day forecast summary (day name, hi/lo, icon)
 * - Next 24 Hours timeline at hourly resolution (merry-timeline)
 * - Configurable number of days in the summary (forecastDays prop)
 * - Celsius/Fahrenheit toggle
 * - Responsive layout
 *
 * DATA SOURCE:
 * Uses OpenWeatherMap API (configured in .env).
 * Falls back to demo data when no external data is provided.
 *
 * USAGE:
 *   <WeatherWidget />
 *   <WeatherWidget location="Chicago, IL" forecastDays={7} />
 *
 */

'use client';

import * as React from 'react';
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  CloudSun,
  Wind,
  Droplets,
  Zap,
} from 'lucide-react';
import timeline from 'merry-timeline';
import { cn } from '@/lib/utils';
import { DAYS_SHORT_ARRAY } from '@/lib/constants/days';
import { WidgetContainer } from './WidgetContainer';

/**
 * WEATHER DATA TYPES
 */

export type WeatherCondition =
  | 'sunny'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rainy'
  | 'snowy'
  | 'stormy';

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  condition: WeatherCondition;
  humidity: number;
  windSpeed: number;
  description: string;
}

export interface ForecastDay {
  date: Date;
  dayName: string;
  high: number;
  low: number;
  condition: WeatherCondition;
  precipProbability?: number; // 0–100
}

/** One hour of forecast data for the 24-hour timeline. */
export interface HourlyForecast {
  time: Date;
  condition: WeatherCondition;
  temp: number; // °F
  precipProbability?: number; // 0–100
  precipIntensity?: number;   // mm/hr
}

export interface ForecastPeriod {
  label: string;
  temp: number;
  condition: WeatherCondition;
}

/** One minute of precipitation data from the minutely forecast. */
export interface MinutelyData {
  time: number;           // unix timestamp
  precipIntensity: number;  // mm/hr
  precipProbability: number; // 0–1
}

export interface WeatherData {
  location: string;
  current: CurrentWeather;
  forecast: ForecastDay[];
  /** Next 24 hours of hourly forecast data for the timeline. */
  hourly?: HourlyForecast[];
  periods?: ForecastPeriod[];
  /** Next 60 minutes of minute-by-minute precipitation data. */
  minutely?: MinutelyData[];
  sunrise?: Date;
  sunset?: Date;
  lastUpdated: Date;
}


/**
 * WEATHER WIDGET PROPS
 */
export interface WeatherWidgetProps {
  location?: string;
  useCelsius?: boolean;
  showForecast?: boolean;
  /** Number of upcoming days to display in the multi-day summary (1–7, default 5) */
  forecastDays?: number;
  data?: WeatherData;
  loading?: boolean;
  error?: string | null;
  gridW?: number;
  gridH?: number;
  className?: string;
}


/**
 * ABSOLUTE TEMPERATURE COLOR SCALE
 * Maps a Fahrenheit value to a color on a fixed scale.
 * Since ForecastDay temps are always stored in °F, this works for both
 * display units — pass the raw °F value regardless of useCelsius.
 */
const TEMP_COLOR_STOPS: Array<{ temp: number; rgb: [number, number, number] }> = [
  { temp:  0, rgb: [147, 197, 253] }, // blue-300    — very cold
  { temp: 32, rgb: [ 96, 165, 250] }, // blue-400    — freezing
  { temp: 45, rgb: [103, 232, 249] }, // cyan-300    — cold
  { temp: 55, rgb: [134, 239, 172] }, // green-300   — cool
  { temp: 65, rgb: [253, 230, 138] }, // amber-200   — mild
  { temp: 75, rgb: [252, 211,  77] }, // amber-300   — warm
  { temp: 85, rgb: [249, 115,  22] }, // orange-500  — hot
  { temp: 95, rgb: [239,  68,  68] }, // red-500     — very hot
];

function tempToColor(fahrenheit: number): string {
  const stops = TEMP_COLOR_STOPS;
  if (fahrenheit <= stops[0]!.temp) {
    const [r, g, b] = stops[0]!.rgb;
    return `rgb(${r},${g},${b})`;
  }
  if (fahrenheit >= stops[stops.length - 1]!.temp) {
    const [r, g, b] = stops[stops.length - 1]!.rgb;
    return `rgb(${r},${g},${b})`;
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (fahrenheit >= a.temp && fahrenheit <= b.temp) {
      const t = (fahrenheit - a.temp) / (b.temp - a.temp);
      const r = Math.round(a.rgb[0] + t * (b.rgb[0] - a.rgb[0]));
      const g = Math.round(a.rgb[1] + t * (b.rgb[1] - a.rgb[1]));
      const bl = Math.round(a.rgb[2] + t * (b.rgb[2] - a.rgb[2]));
      return `rgb(${r},${g},${bl})`;
    }
  }
  const [r, g, b] = stops[stops.length - 1]!.rgb;
  return `rgb(${r},${g},${b})`;
}


/** Normalize "City,State,Country" → "City, State" regardless of upstream format. */
function formatLocation(location: string): string {
  const parts = location.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 1) return parts[0]!;
  return location;
}

function formatTempDisplay(fahrenheit: number, useCelsius: boolean): string {
  if (useCelsius) {
    return `${Math.round((fahrenheit - 32) * 5 / 9)}°C`;
  }
  return `${Math.round(fahrenheit)}°F`;
}


/**
 * WEATHER WIDGET COMPONENT
 */
export const WeatherWidget = React.memo(function WeatherWidget({
  location = '',
  useCelsius = false,
  showForecast = true,
  forecastDays,
  data: externalData,
  loading = false,
  error = null,
  gridW = 12,
  gridH = 12,
  className,
}: WeatherWidgetProps) {
  const weatherData = externalData || getDemoWeatherData(location);

  const isVertical = gridH > gridW;

  // Clamp forecast days: default 7, max 7, min 1
  const resolvedDays = forecastDays ?? Math.min(7, Math.max(1, weatherData.forecast.length));

  // Pre-filter to today-or-future so the label count matches what renders.
  const now = new Date();
  const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const visibleForecast = weatherData.forecast.slice(0, resolvedDays).filter((day) => {
    const d = new Date(day.date);
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return s >= todayLocalStr;
  });

  const hasDays = weatherData.forecast.length > 0;

  // Show precipitation chart when rain is imminent (any minute > 0.01 mm/hr) and data is available
  const hasImminentRain = (weatherData.minutely ?? []).some((m) => m.precipIntensity > 0.01);
  const showPrecipChart = hasImminentRain && !!weatherData.minutely?.length;
  const showSunArc = !!weatherData.sunrise && !!weatherData.sunset && !showPrecipChart;

  return (
    <WidgetContainer
      widgetType="Weather"
      icon={<Cloud className="h-4 w-4" />}
      size="medium"
      loading={loading}
      error={error}
      className={className}
    >
      <div className={cn('flex flex-col gap-3 h-full overflow-auto', isVertical ? 'pb-2' : '')}>

        {/* CURRENT CONDITIONS */}
        <CurrentConditions
          weather={weatherData.current}
          location={weatherData.location}
          useCelsius={useCelsius}
        />

        {/* 24-HOUR TIMELINE */}
        {showForecast && weatherData.hourly && weatherData.hourly.length > 0 && (
          <div className="border-t border-border pt-3">
            <HourlyTimeline hourly={weatherData.hourly} />
          </div>
        )}

        {/* FORECAST SECTION */}
        {showForecast && hasDays && (
          <div className="border-t border-border pt-3 flex-1 min-h-0 flex flex-col gap-3">

            {/* Multi-day summary */}
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {visibleForecast.length}-Day Forecast
              </span>
              <DayHeader
                days={visibleForecast}
                useCelsius={useCelsius}
              />
            </div>

            {/* Sunrise / sunset arc — replaced by precip chart when rain is imminent */}
            {showSunArc && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sun
                </span>
                <SunriseSunsetArc sunrise={weatherData.sunrise!} sunset={weatherData.sunset!} />
              </div>
            )}

            {/* Precipitation chart — replaces sunrise/sunset arc when rain is coming in the next hour */}
            {showPrecipChart && (
              <div className="flex flex-col gap-1">
                <PrecipitationChart minutely={weatherData.minutely!} />
              </div>
            )}

          </div>
        )}
      </div>
    </WidgetContainer>
  );
});


/**
 * CURRENT CONDITIONS SECTION
 */
function CurrentConditions({
  weather,
  location,
  useCelsius,
}: {
  weather: CurrentWeather;
  location: string;
  useCelsius: boolean;
}) {
  const temp  = formatTempDisplay(weather.temperature, useCelsius);
  const feels = formatTempDisplay(weather.feelsLike, useCelsius);

  return (
    <div className="flex items-start justify-between gap-2">
      {/* Left: icon + temp + description */}
      <div className="flex items-center gap-3">
        <WeatherIcon
          condition={weather.condition}
          className="h-10 w-10 text-primary flex-shrink-0"
        />
        <div>
          <div className="text-4xl font-bold leading-none">{temp}</div>
          <div className="text-sm text-muted-foreground capitalize mt-0.5">
            {weather.description}
          </div>
          {location && (
            <div className="text-xs text-muted-foreground/70 mt-0.5 truncate max-w-[140px]">
              {formatLocation(location)}
            </div>
          )}
        </div>
      </div>

      {/* Right: stats */}
      <div className="text-right text-xs text-muted-foreground space-y-1 pt-0.5">
        <div className="text-sm">Feels like {feels}</div>
        <div className="flex items-center justify-end gap-1">
          <Droplets className="h-3 w-3" />
          <span>{weather.humidity}%</span>
        </div>
        <div className="flex items-center justify-end gap-1">
          <Wind className="h-3 w-3" />
          <span>{weather.windSpeed} mph</span>
        </div>
      </div>
    </div>
  );
}


/**
 * DAY HEADER
 * Dark Sky-style row list: day name + precip %, icon, lo | range bar | hi.
 * The bar track spans the full week's min–max range so each day's segment
 * is positioned proportionally.
 */
function DayHeader({
  days,
  useCelsius,
}: {
  days: ForecastDay[];
  useCelsius: boolean;
}) {
  const now = new Date();
  const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const globalMin = Math.min(...days.map((d) => d.low));
  const globalMax = Math.max(...days.map((d) => d.high));
  const span = globalMax - globalMin || 1;

  const fmt = (f: number) =>
    useCelsius ? Math.round((f - 32) * 5 / 9) : Math.round(f);

  return (
    <div className="flex flex-col mt-1">
      {days.map((day, i) => {
        const d = new Date(day.date);
        const dayLocalStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const isToday = dayLocalStr === todayLocalStr;
        const label = isToday ? 'TODAY' : day.dayName.toUpperCase();

        const leftPct  = ((day.low  - globalMin) / span) * 100;
        const widthPct = ((day.high - day.low)   / span) * 100;
        const rightPct = ((day.high - globalMin)  / span) * 100;

        return (
          <div key={i} className="flex items-center gap-2 py-1">

            {/* Day label + precip % + icon — all one left cell */}
            <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
              <div className="w-12 flex-shrink-0 h-8 flex flex-col justify-center">
                <div className="text-[11px] font-bold tracking-wide text-foreground leading-tight whitespace-nowrap">
                  {label}
                </div>
                {day.precipProbability !== undefined && (
                  <div className="flex items-center gap-0.5 text-[10px] text-blue-500 leading-tight">
                    <Droplets className="h-2.5 w-2.5 flex-shrink-0" />
                    <span>{day.precipProbability}%</span>
                  </div>
                )}
              </div>
              <WeatherIcon
                condition={day.condition}
                className="h-5 w-5 flex-shrink-0 text-muted-foreground"
              />
            </div>

            {/* Track: proportional flex spacers keep temps outside the pill, no overflow */}
            <div className="flex-1 flex items-center min-w-0">
              <div style={{ flex: leftPct }} />
              <span className="flex-none text-[11px] text-muted-foreground tabular-nums pr-1">
                {fmt(day.low)}°
              </span>
              <div
                className="h-4 rounded-full"
                style={{
                  flex: Math.max(widthPct, 4),
                  background: `linear-gradient(to right, ${tempToColor(day.low)}, ${tempToColor(day.high)})`,
                }}
              />
              <span className="flex-none text-[11px] font-semibold tabular-nums pl-1">
                {fmt(day.high)}°
              </span>
              <div style={{ flex: Math.max(100 - rightPct, 0) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}


/**
 * CONDITION HELPERS (for merry-timeline stripes)
 */

/** Map a WeatherCondition (+ optional precipIntensity) to a hex color for merry-timeline. */
function conditionToHex(condition: WeatherCondition, precipIntensity?: number): string {
  if (condition === 'rainy' && precipIntensity !== undefined) {
    if (precipIntensity < 0.1) return '#B8D0E8'; // drizzle — very light blue
    if (precipIntensity < 2.5) return '#7B9EC7'; // light rain
    if (precipIntensity < 10)  return '#5A7DB5'; // moderate rain
    return '#3A5C9A';                             // heavy rain — dark blue
  }
  const map: Record<WeatherCondition, string> = {
    'sunny':         '#EAECF0', // near-white gray — Clear
    'partly-cloudy': '#C8CBD6', // light gray
    'cloudy':        '#A8ADB8', // medium gray
    'rainy':         '#7B9EC7', // muted periwinkle blue (fallback, no intensity)
    'snowy':         '#B8D4E8', // icy light blue
    'stormy':        '#4A6FA5', // dark slate blue
  };
  return map[condition] ?? '#A8ADB8';
}

/** Map a WeatherCondition (+ optional precipIntensity) to a text label for merry-timeline. */
function conditionLabel(condition: WeatherCondition, precipIntensity?: number): string {
  if (condition === 'rainy' && precipIntensity !== undefined) {
    if (precipIntensity < 0.1) return 'Drizzle';
    if (precipIntensity < 2.5) return 'Light Rain';
    if (precipIntensity < 10)  return 'Rain';
    return 'Heavy Rain';
  }
  const map: Record<WeatherCondition, string> = {
    'sunny':         'Clear',
    'partly-cloudy': 'Partly Cloudy',
    'cloudy':        'Cloudy',
    'rainy':         'Rain',
    'snowy':         'Snow',
    'stormy':        'Thunderstorm',
  };
  return map[condition] ?? 'Cloudy';
}


/**
 * WEATHER ICON
 */
function WeatherIcon({
  condition,
  className,
}: {
  condition: WeatherCondition;
  className?: string;
}) {
  const icons: Record<WeatherCondition, React.ReactNode> = {
    'sunny':         <Sun className={className} />,
    'partly-cloudy': <CloudSun className={className} />,
    'cloudy':        <Cloud className={className} />,
    'rainy':         <CloudRain className={className} />,
    'snowy':         <CloudSnow className={className} />,
    'stormy':        <Zap className={className} />,
  };
  return <>{icons[condition] ?? <Cloud className={className} />}</>;
}


/**
 * HOURLY TIMELINE
 * Dark Sky-style color strip rendered by merry-timeline.
 * Consecutive hours sharing the same condition merge into one labeled stripe.
 * A red tracker line marks the current time. Hour labels appear below.
 */
function HourlyTimeline({ hourly }: { hourly: HourlyForecast[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || hourly.length === 0) return;

    const data = hourly.map((h) => ({
      time: Math.floor(h.time.getTime() / 1000),
      color: conditionToHex(h.condition, h.precipIntensity),
      text: conditionLabel(h.condition, h.precipIntensity),
    }));

    // Use ResizeObserver to pass the actual pixel width to merry-timeline
    // so it renders correctly even before the layout has fully settled.
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) timeline(el, data, { width, tracker: 0, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hourly]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Next 12 Hours
      </span>
      <div ref={containerRef} className="w-full" data-keep-bg="" />
    </div>
  );
}


/**
 * PRECIPITATION CHART
 * Smooth SVG area chart showing minute-by-minute precipitation intensity over
 * the next 60 minutes.  Y-axis shows HEAVY / MED / LIGHT intensity bands with
 * dotted reference lines; x-axis shows 10-minute interval labels.
 * Auto-shown when any minute has precipIntensity > 0.01 mm/hr.
 */
function PrecipitationChart({ minutely }: { minutely: MinutelyData[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(220);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Layout — no left padding needed since labels are inside the chart
  const PAD_LEFT  = 4;
  const PAD_RIGHT = 4;
  const PAD_TOP   = 4;
  const CHART_H   = 56;
  const AXIS_H    = 14;
  const totalH    = PAD_TOP + CHART_H + AXIS_H;
  const chartW    = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const baseY     = PAD_TOP + CHART_H;

  // Linear scale: 0–5 mm/hr maps to baseY..PAD_TOP (heavy rain clips to top, common events fill chart)
  const MAX_MM = 5;
  const intensityToY = (mm: number) =>
    baseY - (Math.min(mm, MAX_MM) / MAX_MM) * CHART_H;

  // Three equal zones — dotted lines are the boundaries, labels go in the middle of each zone
  const ZONE_H       = CHART_H / 3;
  const HEAVY_LINE_Y = PAD_TOP + ZONE_H;
  const MED_LINE_Y   = PAD_TOP + ZONE_H * 2;

  // Vertical center of each zone
  const HEAVY_LABEL_Y = PAD_TOP + ZONE_H * 0.5;
  const MED_LABEL_Y   = PAD_TOP + ZONE_H * 1.5;
  const LIGHT_LABEL_Y = PAD_TOP + ZONE_H * 2.5;

  // Convert minutely data to SVG points
  const n = minutely.length;
  const pts = minutely.map((m, i) => ({
    x: PAD_LEFT + (i / Math.max(n - 1, 1)) * chartW,
    y: intensityToY(m.precipIntensity),
  }));

  const linePath = catmullRomPath(pts);
  const areaPath =
    linePath +
    ` L ${(PAD_LEFT + chartW).toFixed(1)} ${baseY} L ${PAD_LEFT} ${baseY} Z`;

  const xTicks = [10, 20, 30, 40, 50].map((min) => ({
    min,
    x: PAD_LEFT + (min / 60) * chartW,
  }));

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <CloudRain className="h-3 w-3 text-blue-400" />
        Rain next hour
      </span>
      <div ref={containerRef} className="w-full">
        <svg width={width} height={totalH} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="precip-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#60A5FA" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Zone boundary lines (between labels) */}
          <line x1={PAD_LEFT} y1={HEAVY_LINE_Y} x2={PAD_LEFT + chartW} y2={HEAVY_LINE_Y}
            stroke="currentColor" strokeOpacity={0.25} strokeWidth={0.75} strokeDasharray="3 3" />
          <line x1={PAD_LEFT} y1={MED_LINE_Y} x2={PAD_LEFT + chartW} y2={MED_LINE_Y}
            stroke="currentColor" strokeOpacity={0.25} strokeWidth={0.75} strokeDasharray="3 3" />

          {/* Zone labels — vertically centered in their zone, inside the chart */}
          <text x={PAD_LEFT + 4} y={HEAVY_LABEL_Y} textAnchor="start" fontSize={7.5}
            fill="currentColor" fillOpacity={0.5} dominantBaseline="middle">HEAVY</text>
          <text x={PAD_LEFT + 4} y={MED_LABEL_Y} textAnchor="start" fontSize={7.5}
            fill="currentColor" fillOpacity={0.5} dominantBaseline="middle">MED</text>
          <text x={PAD_LEFT + 4} y={LIGHT_LABEL_Y} textAnchor="start" fontSize={7.5}
            fill="currentColor" fillOpacity={0.5} dominantBaseline="middle">LIGHT</text>

          {/* Filled area */}
          <path d={areaPath} fill="url(#precip-area-gradient)" />

          {/* Top stroke */}
          <path d={linePath} fill="none" stroke="#60A5FA" strokeWidth={1.5}
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Baseline */}
          <line x1={PAD_LEFT} y1={baseY} x2={PAD_LEFT + chartW} y2={baseY}
            stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />

          {/* X-axis labels */}
          {xTicks.map(({ min, x }) => (
            <text key={min} x={x} y={baseY + 11} textAnchor="middle" fontSize={7.5}
              fill="currentColor" fillOpacity={0.5}>{min} min</text>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** Catmull-Rom spline → cubic bezier SVG path.  Produces a smooth curve that
 *  passes through every data point without wild oscillations. */
function catmullRomPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0]!.x} ${pts[0]!.y}`;

  const d: string[] = [`M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`];

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d.push(
      `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    );
  }

  return d.join(' ');
}


/**
 * SUNRISE / SUNSET ARC
 * Full 24-hour timeline: right edge = 12 AM (midnight), left edge = next 12 AM.
 * The single arc rises above the horizon between sunrise and sunset, and dips
 * below at night. The sun/moon dot moves right-to-left as the day progresses,
 * resetting to the right edge at midnight.
 */
function SunriseSunsetArc({ sunrise, sunset }: { sunrise: Date; sunset: Date }) {
  const [width, setWidth] = React.useState(220);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nowMs  = Date.now();
  const riseMs = sunrise.getTime();
  const setMs  = sunset.getTime();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const midnightMs = today.getTime();

  const dayMs   = setMs - riseMs;
  const nightMs = 24 * 3_600_000 - dayMs;
  const isDay   = nowMs >= riseMs && nowMs <= setMs;

  const H        = 110;
  const horizonY = 66;
  const pad      = 8;
  const arcWidth = width - 2 * pad;
  const ryTop    = horizonY - 10;      // peak height above horizon during day
  const ryBot    = H - horizonY - 10;  // depth below horizon during night

  // Y for any absolute timestamp — sinusoidal within each day/night half
  const getY = (tAbs: number): number => {
    if (tAbs >= riseMs && tAbs <= setMs) {
      return horizonY - ryTop * Math.sin(Math.PI * (tAbs - riseMs) / dayMs);
    } else if (tAbs > setMs) {
      return horizonY + ryBot * Math.sin(Math.PI * (tAbs - setMs) / nightMs);
    } else {
      // Before sunrise: late-night phase (fraction from previous sunset)
      return horizonY + ryBot * Math.sin(Math.PI * (1 - (riseMs - tAbs) / nightMs));
    }
  };

  // X: frac=0 (midnight) → left edge; frac=1 (next midnight) → right edge
  const xOf = (frac: number) => pad + frac * arcWidth;

  const nowFrac  = Math.max(0, Math.min(1, (nowMs - midnightMs) / 86_400_000));
  const riseFrac = (riseMs - midnightMs) / 86_400_000;
  const setFrac  = (setMs  - midnightMs) / 86_400_000;

  const sunX  = xOf(nowFrac);
  const sunY  = getY(nowMs);
  const riseX = xOf(riseFrac);
  const setX  = xOf(setFrac);

  // Build an SVG polyline path between two time fractions
  const buildPath = (fromFrac: number, toFrac: number, steps: number): string => {
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const f = fromFrac + (i / steps) * (toFrac - fromFrac);
      pts.push(`${i === 0 ? 'M' : 'L'} ${xOf(f).toFixed(1)} ${getY(midnightMs + f * 86_400_000).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const fullPath = buildPath(0, 1, 96);

  // Elapsed arcs — scoped to avoid amber appearing on the wrong side of the horizon.
  // Daytime:       amber from sunrise → now (in progress).
  // After sunset:  amber from sunrise → sunset (completed day) + gray from sunset → now.
  // Before sunrise: gray from midnight → now (still in overnight).
  let elapsedDayPath: string | null = null;
  let elapsedNightPath: string | null = null;  // post-sunset night portion
  let elapsedPreDawnPath: string | null = null; // midnight → sunrise portion

  if (isDay) {
    // Midnight → sunrise has already passed
    elapsedPreDawnPath = buildPath(0, riseFrac, Math.max(4, Math.round(96 * riseFrac)));
    if (nowFrac > riseFrac + 0.002) {
      elapsedDayPath = buildPath(riseFrac, nowFrac, Math.max(4, Math.round(96 * (nowFrac - riseFrac))));
    }
  } else if (nowMs > setMs) {
    // Full day completed: pre-dawn night + full day arc + post-sunset night so far
    elapsedPreDawnPath = buildPath(0, riseFrac, Math.max(4, Math.round(96 * riseFrac)));
    elapsedDayPath     = buildPath(riseFrac, setFrac, Math.max(8, Math.round(96 * (setFrac - riseFrac))));
    if (nowFrac > setFrac + 0.002) {
      elapsedNightPath = buildPath(setFrac, nowFrac, Math.max(4, Math.round(96 * (nowFrac - setFrac))));
    }
  } else {
    if (nowFrac > 0.01) {
      elapsedNightPath = buildPath(0, nowFrac, Math.max(4, Math.round(96 * nowFrac)));
    }
  }

  const fmt  = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  const dayH = Math.floor(dayMs / 3_600_000);
  const dayM = Math.round((dayMs % 3_600_000) / 60_000);

  return (
    <div ref={containerRef} className="flex flex-col gap-1 w-full">
      <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {/* Horizon line */}
        <line
          x1={pad - 4} y1={horizonY} x2={width - pad + 4} y2={horizonY}
          stroke="currentColor" strokeOpacity={0.12} strokeWidth={1}
        />

        {/* Sunrise / sunset tick marks */}
        <line x1={riseX} y1={horizonY - 5} x2={riseX} y2={horizonY + 5}
          stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />
        <line x1={setX}  y1={horizonY - 5} x2={setX}  y2={horizonY + 5}
          stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />

        {/* Full 24-hour arc — dashed */}
        <path
          d={fullPath}
          fill="none" stroke="currentColor"
          strokeOpacity={0.2} strokeWidth={2} strokeDasharray="4 3"
        />

        {/* Elapsed daytime arc — amber */}
        {elapsedDayPath && (
          <path
            d={elapsedDayPath}
            fill="none" stroke="#FBBF24"
            strokeOpacity={0.7} strokeWidth={2.5} strokeLinecap="round"
          />
        )}

        {/* Elapsed pre-dawn arc — muted (midnight → sunrise) */}
        {elapsedPreDawnPath && (
          <path
            d={elapsedPreDawnPath}
            fill="none" stroke="#94A3B8"
            strokeOpacity={0.45} strokeWidth={2.5} strokeLinecap="round"
          />
        )}

        {/* Elapsed post-sunset arc — muted (sunset → now) */}
        {elapsedNightPath && (
          <path
            d={elapsedNightPath}
            fill="none" stroke="#94A3B8"
            strokeOpacity={0.45} strokeWidth={2.5} strokeLinecap="round"
          />
        )}

        {/* Sun glow */}
        {isDay && <circle cx={sunX} cy={sunY} r={16} fill="#FBBF24" opacity={0.2} />}

        {/* Sun / moon dot */}
        <circle
          cx={sunX} cy={sunY}
          r={isDay ? 7 : 5}
          fill={isDay ? '#FBBF24' : '#94A3B8'}
          opacity={isDay ? 1 : 0.65}
        />
      </svg>

      {/* Labels: sunrise/sunset at their x positions, daylight duration between */}
      <div className="relative h-4 text-[11px] text-muted-foreground/70 select-none">
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: riseX }}>
          {fmt(sunrise)}
        </span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap opacity-60" style={{ left: (riseX + setX) / 2 }}>
          {dayH}h {dayM}m
        </span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: setX }}>
          {fmt(sunset)}
        </span>
      </div>
    </div>
  );
}


/**
 * DEMO DATA
 * Realistic variety for development/testing.
 */
function getDemoWeatherData(location: string): WeatherData {
  const today = new Date();
  const dayNames = DAYS_SHORT_ARRAY;

  const conditions: WeatherCondition[] = [
    'partly-cloudy',
    'sunny',
    'cloudy',
    'rainy',
    'stormy',
    'snowy',
    'sunny',
  ];

  const highs   = [52, 61, 47, 44, 39, 34, 58];
  const lows    = [38, 45, 36, 31, 27, 22, 40];
  const precips = [78,  0,  0, 86, 97,  2, 20];

  const forecast: ForecastDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    return {
      date,
      dayName:          dayNames[date.getDay()] ?? 'Day',
      high:             highs[i] ?? 55,
      low:              lows[i] ?? 40,
      condition:        conditions[i] ?? 'sunny',
      precipProbability: precips[i] ?? 0,
    };
  });

  const sunrise = new Date(today);
  sunrise.setHours(6, 27, 0, 0);
  const sunset = new Date(today);
  sunset.setHours(19, 48, 0, 0);

  // Demo hourly data: 24 hours starting now
  const hourlyConditions: WeatherCondition[] = [
    'partly-cloudy', 'partly-cloudy', 'cloudy', 'rainy', 'rainy',
    'rainy', 'cloudy', 'cloudy', 'partly-cloudy', 'sunny',
    'sunny', 'sunny', 'partly-cloudy', 'cloudy', 'rainy',
    'rainy', 'cloudy', 'cloudy', 'partly-cloudy', 'partly-cloudy',
    'cloudy', 'cloudy', 'rainy', 'rainy',
  ];
  const hourlyTemps = [
    52, 51, 50, 49, 48, 47, 47, 48, 50, 53,
    55, 57, 57, 56, 54, 52, 51, 50, 49, 48,
    47, 47, 46, 46,
  ];
  const hourlyPrecips = [
    20, 25, 35, 65, 80, 75, 55, 40, 20, 5,
    0, 0, 10, 30, 70, 85, 60, 40, 25, 15,
    20, 30, 60, 75,
  ];
  const hourly: HourlyForecast[] = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(today);
    t.setMinutes(0, 0, 0);
    t.setHours(t.getHours() + i);
    return {
      time: t,
      condition: hourlyConditions[i] ?? 'cloudy',
      temp: hourlyTemps[i] ?? 50,
      precipProbability: hourlyPrecips[i] ?? 0,
    };
  });

  // Demo minutely: trace → light rain starting ~20 min in, plateaus, matches screenshot
  const nowSec = Math.floor(Date.now() / 1000);
  const minutely: MinutelyData[] = Array.from({ length: 61 }, (_, i) => {
    let intensity = 0;
    if (i >= 16 && i < 22) {
      intensity = 2.5 * ((i - 16) / 6);   // ramp up to LIGHT
    } else if (i >= 22 && i <= 55) {
      intensity = 2.2 + 0.5 * Math.sin((i - 22) / 8); // plateau near LIGHT
    } else if (i > 55) {
      intensity = 2.5 * ((61 - i) / 6);   // taper off
    }
    return {
      time: nowSec + i * 60,
      precipIntensity: parseFloat(intensity.toFixed(3)),
      precipProbability: intensity > 0 ? 0.8 : 0,
    };
  });

  return {
    location:    location || 'Melrose, MA',
    current: {
      temperature: 52,
      feelsLike:   48,
      condition:   'partly-cloudy',
      humidity:    62,
      windSpeed:   9,
      description: 'Partly cloudy',
    },
    forecast,
    hourly,
    minutely,
    sunrise,
    sunset,
    lastUpdated: new Date(),
  };
}
