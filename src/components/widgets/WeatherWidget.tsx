/**
 *
 * Displays current weather conditions, a multi-day forecast summary,
 * and an 8-hour hourly forecast (one card per hour with icon, temp, and
 * chance-of-precipitation).
 *
 * FEATURES:
 * - Current temperature and conditions
 * - "Feels like" temperature, humidity, wind
 * - Multi-day forecast summary (day name, hi/lo, icon)
 * - Hourly forecast cards (Apple/Google-Weather style)
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
import SunCalc from 'suncalc';
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  CloudSun,
  Sunrise,
  Sunset,
  Wind,
  Droplets,
  Zap,
} from 'lucide-react';
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

/**
 * Display units carried in every weather response. Determined by the user's
 * Display settings (Imperial vs Metric); falls back to imperial on legacy
 * installs that don't have the setting saved. Each field controls which
 * suffix the display components render — components don't convert values
 * themselves, so what you see is what the provider returned.
 */
export interface WeatherUnits {
  /** 'F' (default) or 'C'. Affects current.temperature, forecast hi/lo, hourly.temp, periods.temp, feelsLike. */
  temperature: 'F' | 'C';
  /** 'mph' (default) or 'km/h'. Affects current.windSpeed. */
  windSpeed: 'mph' | 'km/h';
  /** 'in' (default) or 'mm'. Affects current.precipitation, hourly.precipIntensity, minutely.precipIntensity. */
  precipitation: 'in' | 'mm';
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
  /** Moonrise for today in the location's timezone (computed locally via suncalc). */
  moonrise?: Date;
  /** Moonset for today in the location's timezone (computed locally via suncalc). */
  moonset?: Date;
  /** Phase angle 0..1 — 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
  moonPhase?: number;
  /** Illuminated fraction 0..1 — independent of waxing vs waning. */
  moonIllumination?: number;
  /** Human-readable phase label, e.g. "Waning Gibbous". */
  moonPhaseName?: string;
  /** Latitude of the weather location — used client-side by suncalc to draw
   *  the sun/moon arcs at their true altitudes. */
  lat?: number;
  /** Longitude of the weather location. Pair with lat. */
  lon?: number;
  /** Units that the temperature/wind/precip fields are reported in. */
  units: WeatherUnits;
  lastUpdated: Date;
}


/**
 * WEATHER WIDGET PROPS
 */
export interface WeatherWidgetProps {
  location?: string;
  /**
   * @deprecated Display units are now driven by `data.units` (server-side,
   * from the user's Display setting). The prop is still accepted for backward
   * compatibility but ignored. To show Celsius, change the Display setting.
   */
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
 * MOON PHASE GLYPH GEOMETRY (shared)
 *
 * Returns an SVG path string for the illuminated portion of the moon at the
 * given phase: a half-circle on the lit side plus an elliptical arc whose
 * x-radius shrinks toward zero at the quarter phases. At new moon (phase=0)
 * the two arcs overlap and the closed path has zero area — caller should
 * combine with an outlined disc so new moon reads as an empty circle.
 *
 * Used in two places: inline in the SunriseSunsetArc SVG, and as the body
 * of the standalone <MoonGlyph> component (forecast day rows).
 */
function moonPhasePath(cx: number, cy: number, r: number, phase: number): string {
  const ph = ((phase % 1) + 1) % 1;
  const rxAbs = Math.abs(Math.cos(2 * Math.PI * ph)) * r;
  const outerSweep = ph < 0.5 ? 1 : 0;
  const innerSweep = Math.floor(ph * 4) % 2 === 1 ? 1 : 0;
  return `M ${cx},${cy - r} A ${r},${r} 0 0 ${outerSweep} ${cx},${cy + r} A ${rxAbs},${r} 0 0 ${innerSweep} ${cx},${cy - r} Z`;
}

/**
 * Small standalone moon glyph — outlined disc + lit fraction. Used next to
 * each forecast day to show the night's moon phase at a glance.
 */
function MoonGlyph({
  phase,
  size = 14,
  color = '#60A5FA',
}: {
  phase: number;
  size?: number;
  color?: string;
}) {
  const r = size / 2 - 0.5;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={c} cy={c} r={r} fill="none" stroke={color}
        strokeOpacity={0.5} strokeWidth={0.8} />
      <path d={moonPhasePath(c, c, r, phase)} fill={color} opacity={0.9} />
    </svg>
  );
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


function formatTemp(value: number, units: WeatherUnits): string {
  return `${Math.round(value)}°${units.temperature}`;
}

/** Convert a temperature value (in either F or C) to the F scale tempToColor expects. */
function toFahrenheitForColor(value: number, units: WeatherUnits): number {
  return units.temperature === 'C' ? value * 9 / 5 + 32 : value;
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
  const units = weatherData.units;

  const isVertical = gridH > gridW;

  // Clamp forecast days: default 7, max 7, min 1
  const resolvedDays = forecastDays ?? Math.min(7, Math.max(1, weatherData.forecast.length));

  // Pre-filter to today-or-future so the label count matches what renders.
  // Provider stores forecast.date as UTC-midnight of the location's calendar
  // day (see openmeteo.ts comment), so read via getUTC* to compare against
  // the viewer's local-today calendar string.
  const now = new Date();
  const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const visibleForecast = weatherData.forecast.slice(0, resolvedDays).filter((day) => {
    const d = new Date(day.date);
    const s = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    return s >= todayLocalStr;
  });

  const hasDays = weatherData.forecast.length > 0;

  // Show precipitation chart only for real rain (≥ 0.1 mm/hr); 0.01 caught drizzle/trace amounts
  const hasImminentRain = (weatherData.minutely ?? []).some((m) => m.precipIntensity >= 0.1);
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
          units={units}
          sunrise={weatherData.sunrise}
          sunset={weatherData.sunset}
          moonPhase={weatherData.moonPhase}
          moonPhaseName={weatherData.moonPhaseName}
        />

        {/* HOURLY FORECAST */}
        {showForecast && weatherData.hourly && weatherData.hourly.length > 0 && (
          <div className="border-t border-border pt-3">
            <HourlyTimeline hourly={weatherData.hourly} units={units} />
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
                units={units}
              />
            </div>

            {/* Sun + moon arc — replaced by precip chart when rain is imminent.
                Sunrise/sunset times + moon phase now live in the header
                row (CurrentConditions), so the arc renders without a
                duplicate label strip. */}
            {showSunArc && (
              <div className="flex flex-col gap-1">
                <SunriseSunsetArc
                  sunrise={weatherData.sunrise!}
                  sunset={weatherData.sunset!}
                  lat={weatherData.lat}
                  lon={weatherData.lon}
                  moonrise={weatherData.moonrise}
                  moonset={weatherData.moonset}
                  moonPhase={weatherData.moonPhase}
                />
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
  units,
  sunrise,
  sunset,
  moonPhase,
  moonPhaseName,
}: {
  weather: CurrentWeather;
  location: string;
  units: WeatherUnits;
  sunrise?: Date;
  sunset?: Date;
  moonPhase?: number;
  moonPhaseName?: string;
}) {
  const temp  = formatTemp(weather.temperature, units);
  const feels = formatTemp(weather.feelsLike, units);
  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

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
          <span>{weather.windSpeed} {units.windSpeed}</span>
        </div>
        {moonPhase !== undefined && (
          <div className="flex items-center justify-end gap-1 pt-0.5">
            <MoonGlyph phase={moonPhase} size={12} />
            {moonPhaseName && <span>{moonPhaseName}</span>}
          </div>
        )}
        {(sunrise || sunset) && (
          <div className="flex items-center justify-end gap-2 tabular-nums">
            {sunrise && (
              <span className="flex items-center gap-0.5" title="Sunrise">
                <Sunrise className="h-3 w-3" style={{ color: '#FBBF24' }} />
                {fmtTime(sunrise)}
              </span>
            )}
            {sunset && (
              <span className="flex items-center gap-0.5" title="Sunset">
                <Sunset className="h-3 w-3" style={{ color: '#F97316' }} />
                {fmtTime(sunset)}
              </span>
            )}
          </div>
        )}
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
  units,
}: {
  days: ForecastDay[];
  units: WeatherUnits;
}) {
  const now = new Date();
  const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const globalMin = Math.min(...days.map((d) => d.low));
  const globalMax = Math.max(...days.map((d) => d.high));
  const span = globalMax - globalMin || 1;

  // Values come in `units.temperature`; the gradient palette is keyed on °F
  // (TEMP_COLOR_STOPS), so convert only for color lookup. Display values pass
  // through unmodified — what the server returned is what we show.
  const fmt = (v: number) => Math.round(v);
  const colorFor = (v: number) => tempToColor(toFahrenheitForColor(v, units));

  return (
    <div className="flex flex-col mt-1">
      {days.map((day, i) => {
        // Provider anchors forecast.date at UTC midnight of the location's
        // calendar day; getUTC* avoids TZ slippage between server + viewer.
        const d = new Date(day.date);
        const dayLocalStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        const isToday = dayLocalStr === todayLocalStr;
        const label = isToday ? 'TODAY' : day.dayName.toUpperCase();

        const leftPct  = ((day.low  - globalMin) / span) * 100;
        const widthPct = ((day.high - day.low)   / span) * 100;

        // Moon phase for this calendar day — global (no lat/lon needed since
        // phase is the same anywhere on Earth at a given instant). Sampled at
        // local noon to avoid edge-of-day phase rollover artifacts.
        const dayNoon = new Date(day.date);
        dayNoon.setHours(12, 0, 0, 0);
        const dayPhase = SunCalc.getMoonIllumination(dayNoon).phase;

        return (
          <div key={i} className="flex items-center gap-2 py-1">

            {/* Day label + precip % + weather icon + moon phase glyph */}
            <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
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
              <MoonGlyph phase={dayPhase} size={14} />
            </div>

            {/* Unified pill track (Apple Weather style): every day's track is the
                same width across the week, with the colored day-range positioned
                inside. Low and high temps sit at fixed left/right positions so
                they line up across days too. */}
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] text-muted-foreground tabular-nums w-7 text-right flex-shrink-0">
                {fmt(day.low)}°
              </span>
              <div className="flex-1 relative h-4 rounded-full bg-black/10 dark:bg-white/15 ring-1 ring-inset ring-black/10 dark:ring-white/15 overflow-hidden min-w-0">
                <div
                  className="absolute top-0 bottom-0 rounded-full"
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 4)}%`,
                    background: `linear-gradient(to right, ${colorFor(day.low)}, ${colorFor(day.high)})`,
                  }}
                />
              </div>
              <span className="text-[11px] font-semibold tabular-nums w-7 text-left flex-shrink-0">
                {fmt(day.high)}°
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
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
 * HOURLY FORECAST
 * Apple/Google-Weather-style row of cards. One card per hour showing the
 * time, a condition icon, temperature, and chance-of-precipitation when it
 * meaningfully matters (≥10%). The first card is labeled "Now". Replaces the
 * earlier merry-timeline color strip, which read as a 1995-era band chart.
 */
function HourlyTimeline({ hourly, units }: { hourly: HourlyForecast[]; units: WeatherUnits }) {
  // Start at the hour whose endTime is still in the future ("Now" card).
  // Take 8 hours so the row stays readable at the default widget width.
  const nowMs = Date.now();
  const upcoming = hourly
    .filter((h) => h.time.getTime() + 60 * 60_000 >= nowMs)
    .slice(0, 8);

  if (upcoming.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Next {upcoming.length} Hours
      </span>
      <div className="flex gap-1.5">
        {upcoming.map((h, i) => {
          const isNow = i === 0;
          const timeLabel = isNow
            ? 'Now'
            : h.time
                .toLocaleTimeString([], { hour: 'numeric', hour12: true })
                .replace(/\s/g, '')
                .toLowerCase();
          const precipPct = Math.round(h.precipProbability ?? 0);
          const showPrecip = precipPct >= 10;
          return (
            <div
              key={h.time.toISOString()}
              className={cn(
                'flex flex-1 min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-center',
                isNow ? 'bg-primary/10' : 'bg-muted/40',
              )}
            >
              <span className={cn(
                'text-[10px] font-medium tabular-nums',
                isNow ? 'text-primary' : 'text-muted-foreground',
              )}>
                {timeLabel}
              </span>
              <WeatherIcon condition={h.condition} className="h-5 w-5 text-foreground/80" />
              <span className="text-xs font-semibold tabular-nums">
                {Math.round(h.temp)}°
              </span>
              <span className={cn(
                'text-[10px] tabular-nums',
                showPrecip ? 'text-blue-500 font-medium' : 'text-transparent',
              )}>
                {showPrecip ? `${precipPct}%` : '0%'}
              </span>
            </div>
          );
        })}
      </div>
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

  const PAD_LEFT  = 4;
  const PAD_RIGHT = 4;
  const PAD_TOP   = 4;
  const CHART_H   = 56;
  const AXIS_H    = 14;
  const totalH    = PAD_TOP + CHART_H + AXIS_H;
  const chartW    = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const baseY     = PAD_TOP + CHART_H;

  // 5 mm/hr = top of chart; heavy rain clips, common events fill lower zones
  const MAX_MM = 5;

  // Three equal intensity zones
  const ZONE_H        = CHART_H / 3;
  const HEAVY_LINE_Y  = PAD_TOP + ZONE_H;
  const MED_LINE_Y    = PAD_TOP + ZONE_H * 2;
  const HEAVY_LABEL_Y = PAD_TOP + ZONE_H * 0.5;
  const MED_LABEL_Y   = PAD_TOP + ZONE_H * 1.5;
  const LIGHT_LABEL_Y = PAD_TOP + ZONE_H * 2.5;

  // One bar per minute — tight packing with a 0.5 px gap
  const n = minutely.length;
  const slotW = chartW / Math.max(n, 60);
  const barW  = Math.max(slotW - 0.5, 0.5);

  const xTicks = [10, 20, 30, 40, 50].map((min) => ({
    min,
    x: PAD_LEFT + (min / 60) * chartW,
  }));

  const RAIN_THRESHOLD = 0.1;
  const firstRainMinute = minutely.findIndex((m) => m.precipIntensity >= RAIN_THRESHOLD);
  const currentlyRaining = firstRainMinute === 0;

  const rainMessage = (() => {
    if (currentlyRaining) {
      const stopMinute = minutely.findIndex((m, i) => i > 0 && m.precipIntensity < RAIN_THRESHOLD);
      if (stopMinute === -1) return 'Raining through the hour';
      const resumeMinute = minutely.findIndex((m, i) => i > stopMinute && m.precipIntensity >= RAIN_THRESHOLD);
      return resumeMinute === -1
        ? `Stops in ${stopMinute} min`
        : `Stops in ${stopMinute} min · returns in ${resumeMinute} min`;
    }
    return firstRainMinute > 0 ? `Rain expected in ${firstRainMinute} min` : 'Rain starting now';
  })();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <CloudRain className="h-3 w-3 text-blue-400" />
          Rain next hour
        </span>
        <span className="text-[10px] text-blue-400 font-medium">{rainMessage}</span>
      </div>
      <div ref={containerRef} className="w-full">
        <svg width={width} height={totalH} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="precip-bar-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#3B82F6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.55" />
            </linearGradient>
          </defs>

          {/* Zone boundary lines */}
          <line x1={PAD_LEFT} y1={HEAVY_LINE_Y} x2={PAD_LEFT + chartW} y2={HEAVY_LINE_Y}
            stroke="currentColor" strokeOpacity={0.25} strokeWidth={0.75} strokeDasharray="3 3" />
          <line x1={PAD_LEFT} y1={MED_LINE_Y} x2={PAD_LEFT + chartW} y2={MED_LINE_Y}
            stroke="currentColor" strokeOpacity={0.25} strokeWidth={0.75} strokeDasharray="3 3" />

          {/* Zone labels */}
          <text x={PAD_LEFT + 4} y={HEAVY_LABEL_Y} textAnchor="start" fontSize={7.5}
            fill="currentColor" fillOpacity={0.5} dominantBaseline="middle">HEAVY</text>
          <text x={PAD_LEFT + 4} y={MED_LABEL_Y} textAnchor="start" fontSize={7.5}
            fill="currentColor" fillOpacity={0.5} dominantBaseline="middle">MED</text>
          <text x={PAD_LEFT + 4} y={LIGHT_LABEL_Y} textAnchor="start" fontSize={7.5}
            fill="currentColor" fillOpacity={0.5} dominantBaseline="middle">LIGHT</text>

          {/* Bars — one per minute, skip trace amounts */}
          {minutely.map((m, i) => {
            const intensity = Math.min(m.precipIntensity, MAX_MM);
            if (intensity <= 0) return null;
            const barH = (intensity / MAX_MM) * CHART_H;
            const barX = PAD_LEFT + i * slotW;
            return (
              <rect
                key={i}
                x={barX}
                y={baseY - barH}
                width={barW}
                height={barH}
                fill="url(#precip-bar-gradient)"
                rx={barW > 2 ? 1 : 0}
              />
            );
          })}

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


/**
 * SUN + MOON ARC
 *
 * Plots true celestial altitudes for both the sun and (optionally) the moon
 * across a 24-hour timeline (left edge = today's local midnight, right edge
 * = next midnight). Altitudes come from suncalc, so the visual peak height
 * of each arc reflects how high the body actually reaches in the sky on
 * the given day and latitude — summer sun arcs higher than winter sun,
 * and the moon arc varies with declination.
 *
 * Scale: π/2 (90°, the zenith) maps to `ryTop` pixels above the horizon;
 * sub-zenith altitudes shrink proportionally. Same scale below the horizon
 * capped at `ryBot`.
 *
 * Sun: amber for the elapsed portion of today (matches the prior look —
 * dashed background for future positions, slate-gray for elapsed below-
 * horizon nighttime).
 * Moon: blue for the entire above-horizon arc, with a phase-glyph dot at
 * the moon's current position. Below-horizon segments use the dashed
 * background only.
 */
function SunriseSunsetArc({
  sunrise,
  sunset,
  lat,
  lon,
  moonrise,
  moonset,
  moonPhase,
}: {
  sunrise: Date;
  sunset: Date;
  lat?: number;
  lon?: number;
  moonrise?: Date;
  moonset?: Date;
  moonPhase?: number;
}) {
  const [width, setWidth] = React.useState(220);
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Unique gradient ID so multiple weather widgets on a page (e.g., dashboard
  // + lite mode) don't share a single <defs> entry.
  const gradientId = `sun-grad-${React.useId()}`;

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H        = 110;
  const horizonY = 66;
  const pad      = 8;
  const arcWidth = width - 2 * pad;
  const ryTop    = horizonY - 10;      // pixels representing zenith (alt = π/2)
  const ryBot    = H - horizonY - 10;  // pixels representing antizenith (alt = -π/2)
  const dayMs    = 24 * 3_600_000;

  const today = React.useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const midnightMs = today.getTime();
  const nowMs = Date.now();

  // X helper — frac 0..1 of today's 24h window maps to the SVG width.
  const xOf = (frac: number) => pad + frac * arcWidth;
  const nowFrac = Math.max(0, Math.min(1, (nowMs - midnightMs) / dayMs));

  // Map a celestial altitude (radians, -π/2..π/2) to a Y pixel.
  // FIXED scale: zenith = ryTop above horizonY. Sub-zenith altitudes shrink
  // proportionally so winter sun visibly arcs lower than summer sun.
  const altToY = React.useCallback((altRad: number): number => {
    if (altRad >= 0) return horizonY - ryTop * Math.min(1, altRad / (Math.PI / 2));
    return horizonY + ryBot * Math.min(1, -altRad / (Math.PI / 2));
  }, [horizonY, ryTop, ryBot]);

  // Resolve coords: fall back to Chicago for demo data without lat/lon.
  const useLat = lat ?? 41.8781;
  const useLon = lon ?? -87.6298;

  // 96 samples = every 15 min. Memoize on (date, lat, lon) so we don't
  // recompute 192 suncalc calls on every render (e.g., width resize).
  const STEPS = 96;
  const samples = React.useMemo(() => {
    const sun: { frac: number; alt: number; y: number }[] = [];
    const moon: { frac: number; alt: number; y: number }[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const frac = i / STEPS;
      const t = new Date(midnightMs + frac * dayMs);
      const sAlt = SunCalc.getPosition(t, useLat, useLon).altitude;
      const mAlt = SunCalc.getMoonPosition(t, useLat, useLon).altitude;
      sun.push({ frac, alt: sAlt, y: altToY(sAlt) });
      moon.push({ frac, alt: mAlt, y: altToY(mAlt) });
    }
    return { sun, moon };
  }, [midnightMs, dayMs, useLat, useLon, altToY]);

  // Generic helpers — convert a sample list into one or more SVG paths,
  // optionally filtering by above/below horizon and elapsed/future.
  const samplesToPath = (pts: { frac: number; y: number }[]): string =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.frac).toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const segmentBy = (
    pts: { frac: number; alt: number; y: number }[],
    keep: (s: { alt: number; frac: number }) => boolean,
  ): string[] => {
    const out: string[] = [];
    let buf: { frac: number; y: number }[] = [];
    for (const s of pts) {
      if (keep(s)) buf.push({ frac: s.frac, y: s.y });
      else if (buf.length > 1) { out.push(samplesToPath(buf)); buf = []; }
      else buf = [];
    }
    if (buf.length > 1) out.push(samplesToPath(buf));
    return out;
  };

  // Sun arc segments. "Elapsed" portions (frac ≤ nowFrac) get the bright
  // amber / slate treatment; future portions sit on the dashed background.
  const sunFullPath = samplesToPath(samples.sun);
  const sunElapsedAbove = segmentBy(samples.sun, s => s.frac <= nowFrac && s.alt >= 0);
  const sunElapsedBelow = segmentBy(samples.sun, s => s.frac <= nowFrac && s.alt < 0);

  // Moon: light up the whole above-horizon portion in blue (we don't track
  // elapsed/future for moon — the curve is short enough that it reads as a
  // single "moon-up" highlight).
  const moonSamples = moonrise || moonset || moonPhase !== undefined ? samples.moon : null;
  const moonFullPath = moonSamples ? samplesToPath(moonSamples) : null;
  const moonAbovePaths = moonSamples ? segmentBy(moonSamples, s => s.alt >= 0) : [];

  // Current positions (uses suncalc directly rather than interpolating
  // samples — accurate to the second instead of the 15-min sample grid).
  const sunPos = SunCalc.getPosition(new Date(nowMs), useLat, useLon);
  const sunX = xOf(nowFrac);
  const sunY = altToY(sunPos.altitude);
  const isDay = sunPos.altitude >= 0;

  const moonPos = moonSamples ? SunCalc.getMoonPosition(new Date(nowMs), useLat, useLon) : null;
  const moonX = moonPos ? xOf(nowFrac) : 0;
  const moonY = moonPos ? altToY(moonPos.altitude) : 0;
  const isMoonUp = moonPos ? moonPos.altitude >= 0 : false;

  // Rise/set fractions, clamped to [0,1] today. Suncalc rises/sets can
  // straddle midnight, in which case we just hide the off-screen tick.
  const sunRiseFrac = (sunrise.getTime() - midnightMs) / dayMs;
  const sunSetFrac  = (sunset.getTime()  - midnightMs) / dayMs;
  const moonRiseRaw = moonrise ? (moonrise.getTime() - midnightMs) / dayMs : null;
  const moonSetRaw  = moonset  ? (moonset.getTime()  - midnightMs) / dayMs : null;
  const inWindow = (f: number | null): f is number => f !== null && f >= 0 && f <= 1;


  const SUN_COLOR = '#FBBF24';   // amber-400 — sun at zenith
  const SUN_LOW   = '#F97316';   // orange-500 — sun at low altitude
  const SUN_HORIZON = '#EF4444'; // red-500 — sun at the horizon
  const MOON_COLOR = '#60A5FA';

  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  // Pick a sun-dot color that matches where it sits on the altitude gradient
  // — red near the horizon, amber high in the sky. Bucketed (rather than
  // smoothly interpolated) for legibility against a small dot.
  const sunDotColor = isDay
    ? sunPos.altitude < 0.087 // ~5°
      ? SUN_HORIZON
      : sunPos.altitude < 0.314 // ~18°
        ? SUN_LOW
        : SUN_COLOR
    : '#94A3B8';

  return (
    <div ref={containerRef} className="flex flex-col gap-1 w-full">
      <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {/* Altitude-based color gradient for the sun arc — red at the
            horizon, orange at low altitude, amber at zenith. Matches the
            atmospheric-scattering color shift you'd actually see in the sky. */}
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse"
            x1={0} y1={horizonY} x2={0} y2={horizonY - ryTop}>
            <stop offset="0" stopColor={SUN_HORIZON} />
            <stop offset="0.3" stopColor={SUN_LOW} />
            <stop offset="1" stopColor={SUN_COLOR} />
          </linearGradient>
        </defs>

        {/* Horizon line */}
        <line
          x1={pad - 4} y1={horizonY} x2={width - pad + 4} y2={horizonY}
          stroke="currentColor" strokeOpacity={0.12} strokeWidth={1}
        />

        {/* Sun: full 24h arc — dashed background */}
        <path d={sunFullPath} fill="none" stroke="currentColor"
          strokeOpacity={0.2} strokeWidth={2} strokeDasharray="4 3" />

        {/* Sun: elapsed above-horizon — gradient by altitude (red→orange→amber) */}
        {sunElapsedAbove.map((d, i) => (
          <path key={`sun-up-${i}`} d={d} fill="none" stroke={`url(#${gradientId})`}
            strokeOpacity={0.85} strokeWidth={2.5} strokeLinecap="round" />
        ))}

        {/* Sun: elapsed below-horizon — slate */}
        {sunElapsedBelow.map((d, i) => (
          <path key={`sun-down-${i}`} d={d} fill="none" stroke="#94A3B8"
            strokeOpacity={0.45} strokeWidth={2.5} strokeLinecap="round" />
        ))}

        {/* Sunrise / sunset ticks */}
        {inWindow(sunRiseFrac) && (
          <line x1={xOf(sunRiseFrac)} y1={horizonY - 5} x2={xOf(sunRiseFrac)} y2={horizonY + 5}
            stroke={SUN_COLOR} strokeOpacity={0.55} strokeWidth={1.5} />
        )}
        {inWindow(sunSetFrac) && (
          <line x1={xOf(sunSetFrac)} y1={horizonY - 5} x2={xOf(sunSetFrac)} y2={horizonY + 5}
            stroke={SUN_COLOR} strokeOpacity={0.55} strokeWidth={1.5} />
        )}

        {/* Moon arc (full + above-horizon highlight) */}
        {moonFullPath && (
          <path d={moonFullPath} fill="none" stroke="currentColor"
            strokeOpacity={0.15} strokeWidth={1.5} strokeDasharray="2 4" />
        )}
        {moonAbovePaths.map((d, i) => (
          <path key={`moon-up-${i}`} d={d} fill="none" stroke={MOON_COLOR}
            strokeOpacity={0.75} strokeWidth={2} strokeLinecap="round" />
        ))}

        {/* Moonrise / moonset ticks */}
        {inWindow(moonRiseRaw) && (
          <line x1={xOf(moonRiseRaw)} y1={horizonY - 4} x2={xOf(moonRiseRaw)} y2={horizonY + 4}
            stroke={MOON_COLOR} strokeOpacity={0.55} strokeWidth={1.5} />
        )}
        {inWindow(moonSetRaw) && (
          <line x1={xOf(moonSetRaw)} y1={horizonY - 4} x2={xOf(moonSetRaw)} y2={horizonY + 4}
            stroke={MOON_COLOR} strokeOpacity={0.55} strokeWidth={1.5} />
        )}

        {/* Sun glow + dot — color tracks altitude so a low sun glows red/orange */}
        {isDay && <circle cx={sunX} cy={sunY} r={16} fill={sunDotColor} opacity={0.2} />}
        <circle
          cx={sunX} cy={sunY}
          r={isDay ? 7 : 4}
          fill={sunDotColor}
          opacity={isDay ? 1 : 0.55}
        />

        {/* Moon glyph at current position — blue when above, muted when below.
            Disc outline is drawn unfilled so a new moon (lit area collapses to
            zero) reads as an empty circle rather than a faint disc. */}
        {moonSamples && moonPhase !== undefined && (
          <g>
            {isMoonUp && <circle cx={moonX} cy={moonY} r={11} fill={MOON_COLOR} opacity={0.18} />}
            <circle cx={moonX} cy={moonY} r={6}
              fill="none"
              stroke={isMoonUp ? MOON_COLOR : '#94A3B8'}
              strokeOpacity={isMoonUp ? 0.65 : 0.4}
              strokeWidth={1} />
            <path d={moonPhasePath(moonX, moonY, 6, moonPhase)}
              fill={isMoonUp ? MOON_COLOR : '#94A3B8'}
              opacity={isMoonUp ? 1 : 0.55} />
          </g>
        )}
      </svg>

      {/* Sunrise / duration / sunset label strip — sunrise on the left at its
          X, duration in the middle (amber to match the arc), sunset on the
          right. The header row above duplicates the rise/set times, which is
          deliberate: this row anchors them to the arc itself. */}
      <div className="relative text-[11px] text-muted-foreground/70 select-none" style={{ height: 14 }}>
        <div className="relative h-3.5">
          {inWindow(sunRiseFrac) && (
            <span className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums" style={{ left: xOf(sunRiseFrac) }}>
              {fmtTime(sunrise)}
            </span>
          )}
          {inWindow(sunRiseFrac) && inWindow(sunSetFrac) && (() => {
            const dayMsSpan = sunset.getTime() - sunrise.getTime();
            const h = Math.floor(dayMsSpan / 3_600_000);
            const m = Math.round((dayMsSpan % 3_600_000) / 60_000);
            return (
              <span className="absolute -translate-x-1/2 whitespace-nowrap font-medium"
                style={{ left: (xOf(sunRiseFrac) + xOf(sunSetFrac)) / 2, color: SUN_COLOR, opacity: 0.85 }}>
                {h}h {m}m
              </span>
            );
          })()}
          {inWindow(sunSetFrac) && (
            <span className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums" style={{ left: xOf(sunSetFrac) }}>
              {fmtTime(sunset)}
            </span>
          )}
        </div>
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
    units: { temperature: 'F', windSpeed: 'mph', precipitation: 'in' },
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
    // Synthetic moon fixture: waning gibbous — easy to eyeball in dev.
    moonrise: (() => { const d = new Date(today); d.setHours(20, 14, 0, 0); return d; })(),
    moonset:  (() => { const d = new Date(today); d.setHours(8, 47, 0, 0); d.setDate(d.getDate() + 1); return d; })(),
    moonPhase: 0.62,
    moonIllumination: 0.78,
    moonPhaseName: 'Waning Gibbous',
    // Default to the same Chicago coords used by the server providers so
    // suncalc can plot real altitude curves in demo mode.
    lat: 41.8781,
    lon: -87.6298,
    lastUpdated: new Date(),
  };
}
