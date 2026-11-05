'use client';

/**
 * Today: the front page drawn as one scene over the photo (#907).
 *
 * A Today layout keeps its widgets as a list of parts; this draws the ones
 * that are visible, placed by meaning instead of on a grid. For now that is
 * the date and clock in the top-left corner and the weather in the top-right,
 * straight on the photo in the one light ink. The sun arc, the coming days
 * and the quiet lines arrive in their own issues (#909, #805, #911).
 *
 * The clock and weather share their formatting with the widgets (the same
 * time format, date and weather sentence), so the two cannot drift apart.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { splitDayHalf } from '@/components/widgets/ClockWidget';
import { formatTemp, weatherSentence, type WeatherData } from '@/components/widgets/WeatherWidget';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import type { CalendarEvent } from '@/types/calendar';
import { SunArc } from './SunArc';

/** The parts a Today layout can show, by widget id. */
export const TODAY_PARTS = ['clock', 'weather', 'calendar', 'birthdays', 'chores', 'shopping'] as const;

export function isPartShown(parts: WidgetConfig[], id: string): boolean {
  const part = parts.find((p) => p.i === id);
  return !!part && part.visible !== false;
}

/** The current time, read once a minute on the minute. */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval); };
  }, []);
  return now;
}

export function TodayScene({
  parts,
  weather,
  events = [],
  onOpenEvent,
  topOffset = 0,
}: {
  parts: WidgetConfig[];
  weather: WeatherData | null;
  /** Calendar events around today, for the arc. */
  events?: CalendarEvent[];
  /** Tap a bead: the event sheet (#836). */
  onOpenEvent?: (event: CalendarEvent) => void;
  /** Height of the bar above the scene, when it shows. */
  topOffset?: number;
}) {
  const now = useMinute();
  const locale = useLocale();
  const t = useTranslations('weather');
  const { timeFormat, displayTimezone } = useTimeFormat();

  const { digits, dayHalf, dayHalfFirst } = splitDayHalf(formatDisplayTime(now, timeFormat, {}, displayTimezone));
  const date = toDisplayDate(now, displayTimezone).toLocaleDateString(locale, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const dayHalfSpan = dayHalf && <span className="text-[0.4em] font-medium ml-[0.12em]">{dayHalf}</span>;

  const current = weather?.current;
  const condition = current
    ? (current.descriptionKey && typeof t.has === 'function' && t.has(`conditions.${current.descriptionKey}`)
      ? t(`conditions.${current.descriptionKey}`)
      : current.description)
    : undefined;
  const high = weather?.forecast?.[0]?.high;

  return (
    <div
      data-today-scene
      className="relative w-full overflow-hidden text-white"
      style={{ height: `calc(100dvh - ${topOffset}px)`, textShadow: 'var(--ds-idle-text-shadow)' }}
    >
      {isPartShown(parts, 'clock') && (
        <div data-today-corner="left" className="absolute left-[3rem] top-[2.5rem] flex flex-col items-start">
          <time className="text-body font-medium opacity-95" data-today-date>{date}</time>
          <time
            className="font-medium leading-none tabular-nums tracking-[-0.02em] whitespace-nowrap"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'max(var(--text-floor), min(8rem, 14vw))' }}
            data-today-clock
          >
            {dayHalfFirst && dayHalfSpan}
            {digits}
            {!dayHalfFirst && dayHalfSpan}
          </time>
        </div>
      )}

      {isPartShown(parts, 'weather') && current && weather && (
        <div data-today-corner="right" className="absolute right-[3rem] top-[2.5rem] flex flex-col items-end text-right">
          <div
            className="font-medium leading-none tabular-nums"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'max(var(--text-floor), min(4rem, 7vw))' }}
            data-today-temp
          >
            {formatTemp(current.temperature, weather.units)}
          </div>
          <div className="text-body mt-1 first-letter:uppercase whitespace-nowrap" data-today-weather>
            {weatherSentence(condition, high === undefined ? undefined : t('high', { temp: formatTemp(high, weather.units) }))}
          </div>
        </div>
      )}

      {/* The day as the sun's path (#909), margin to margin across the middle. */}
      {isPartShown(parts, 'calendar') && (
        <div className="absolute left-[3rem] right-[3rem] top-[30%] h-[38%]" data-today-arc>
          <SunArc events={events} now={now} sunrise={weather?.sunrise} sunset={weather?.sunset} onOpenEvent={onOpenEvent} />
        </div>
      )}
    </div>
  );
}
