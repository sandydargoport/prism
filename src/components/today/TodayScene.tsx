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
import { useEffect, useRef, useState } from 'react';
import { setCellDrift } from '@/components/layout/grid/CssGridDisplay';
import { useLocale, useTranslations } from 'next-intl';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { splitDayHalf } from '@/components/widgets/ClockWidget';
import { formatTemp, weatherSentence, type WeatherData } from '@/components/widgets/WeatherWidget';
import { shownWhenIdle } from '@/components/screensaver/calmMode';
import { TODAY_TEXT_SIZES, type TodayTextSize } from './TodayPartsPanel';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import type { CalendarEvent } from '@/types/calendar';
import { SunArc } from './SunArc';
import { TodayList } from './TodayList';
import { ComingDays } from './ComingDays';
import { QuietLines } from './QuietLines';
import type { BirthdayLike, ChoreLike } from '@/lib/today/quietLines';

/** The parts a Today layout can show, by widget id. */
export const TODAY_PARTS = ['clock', 'weather', 'calendar', 'birthdays', 'chores', 'shopping'] as const;

export function isPartShown(parts: WidgetConfig[], id: string): boolean {
  const part = parts.find((p) => p.i === id);
  return !!part && part.visible !== false;
}

/** Whether a part stays on screen while the wall is idle (#927). */
function staysIdle(parts: WidgetConfig[], id: string): boolean {
  const part = parts.find((p) => p.i === id);
  return !!part && shownWhenIdle(part);
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
  household,
  idle = false,
  topOffset = 0,
  drift = false,
  night = false,
}: {
  parts: WidgetConfig[];
  weather: WeatherData | null;
  /** Calendar events around today, for the arc. */
  events?: CalendarEvent[];
  /** Tap a bead: the event sheet (#836). */
  onOpenEvent?: (event: CalendarEvent) => void;
  /** Chores, the shopping list and birthdays, for the quiet lines (#911). */
  household?: {
    chores: ChoreLike[];
    lists: Array<{ id: string; name: string; items: Array<{ checked: boolean }> }>;
    birthdays: BirthdayLike[];
    onTickChore?: (choreId: string) => void;
    onAddShopping?: () => void;
  };
  /**
   * The wall is idle (#926): the sentences and quiet lines fade, the arc
   * keeps only the next label, and the scene takes no taps, so the first tap
   * only wakes it.
   */
  idle?: boolean;
  /** Height of the bar above the scene, when it shows. */
  topOffset?: number;
  /**
   * Burn-in drift while idle: the same slow 4px figure eight the grid's
   * widgets make, on everything the scene draws, so the clock, weather and
   * Next never sit on the same pixels for hours.
   */
  drift?: boolean;
  /**
   * Night by the dashboard's rule (#1152): warm ink, a veil over the photo
   * and the moon (#926). The caller decides, so the veil, the dim and the
   * night backdrop all go by the one rule.
   */
  night?: boolean;
}) {
  const now = useMinute();
  const driftRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (driftRef.current) setCellDrift(driftRef.current, drift);
  }, [drift]);
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
  const fades = `transition-opacity duration-1000 motion-reduce:duration-0 ${idle ? 'opacity-0' : 'opacity-100'}`;
  // A part set to stay when idle (#927) keeps its place; the rest fade.
  // The arc is an option on the Today scene (#1030), off unless switched on.
  const showArc = parts.find((p) => p.i === 'calendar')?.settings?.arc === true;
  const fadeUnless = (id: string) => `transition-opacity duration-1000 motion-reduce:duration-0 ${idle && !staysIdle(parts, id) ? 'opacity-0' : 'opacity-100'}`;
  const calendarPart = parts.find((p) => p.i === 'calendar');
  const zoom = TODAY_TEXT_SIZES[(calendarPart?.settings?.textSize as TodayTextSize | undefined) ?? 'normal'] ?? 1;

  return (
    <div
      data-today-scene
      className={`relative w-full overflow-hidden ${idle ? 'pointer-events-none' : ''}`}
      style={{
        height: `calc(100dvh - ${topOffset}px)`,
        textShadow: 'var(--ds-idle-text-shadow)',
        color: night ? 'rgb(255 226 190)' : 'white',
      }}
      data-today-idle={idle || undefined}
      data-today-kind="today"
      data-today-night={night || undefined}
    >
      {night && <div className="absolute inset-0 bg-black/60" aria-hidden data-today-veil />}
      {/* A soft shade behind the day on the left (#1186): the photo's own shade
          darkens the corners and the foot, and over a bright sky or fog the
          smaller lines of Next and Later today washed out. Night has its veil. */}
      {!night && (
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          data-today-shade
          style={{ backgroundImage: 'radial-gradient(50% 55% at 0% 45%, rgb(0 0 0 / 0.38), transparent)' }}
        />
      )}
      {/* Everything drawn on the photo, in one layer that drifts while idle. */}
      <div ref={driftRef} className="absolute inset-0 duration-1000" data-today-drift>
      {isPartShown(parts, 'clock') && (
        <div data-today-corner="left" className={`absolute left-[3rem] top-[2.5rem] flex flex-col items-start ${fadeUnless('clock')}`}>
          <time className="text-body font-medium opacity-95" data-today-date>{date}</time>
          <time
            className="font-medium leading-none tabular-nums tracking-[-0.02em] whitespace-nowrap"
            // Smaller on the Calendar layout, to give the board its height (#931).
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
        <div data-today-corner="right" className={`absolute right-[3rem] top-[2.5rem] flex flex-col items-end text-right ${fadeUnless('weather')}`}>
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

      {/* Simple leads with today as a list (#1030): Next, then later today. */}
      {isPartShown(parts, 'calendar') && !showArc && (
        <div
          className={`absolute left-[3rem] w-[min(58%,62rem)] transition-[top,opacity] duration-1000 portrait:right-[3rem] portrait:w-auto ${idle ? 'top-[40%] portrait:top-[22%]' : 'top-[28%] portrait:top-[14%]'} ${idle && !staysIdle(parts, 'calendar') ? 'opacity-0' : ''}`}
          style={{ zoom }}
          data-today-list-wrap
        >
          <TodayList events={events} now={now} onOpenEvent={onOpenEvent} variant="wall" onlyNext={idle} />
        </div>
      )}

      {/* The day as the sun's path (#909), now an option (#1030), margin to margin across the middle. */}
      {isPartShown(parts, 'calendar') && showArc && (
        <div
          className={`absolute left-[3rem] right-[3rem] h-[38%] transition-[top,opacity] duration-1000 portrait:h-[26%] ${idle ? 'top-[44%] portrait:top-[24%]' : 'top-[30%] portrait:top-[14%]'} ${idle && !staysIdle(parts, 'calendar') ? 'opacity-0' : ''}`}
          data-today-arc
        >
          <SunArc events={events} now={now} sunrise={weather?.sunrise} sunset={weather?.sunset} moonrise={weather?.moonrise} moonset={weather?.moonset} moonPhase={weather?.moonPhase} onOpenEvent={onOpenEvent} onlyNext={idle} />
        </div>
      )}

      {/* Quiet lines (#911), bottom right. */}
      {household && (
        <div className="absolute bottom-[3rem] right-[3rem]" style={{ zoom }}>
          <QuietLines
            chores={isPartShown(parts, 'chores') && (!idle || staysIdle(parts, 'chores')) ? household.chores : []}
            lists={isPartShown(parts, 'shopping') && (!idle || staysIdle(parts, 'shopping')) ? household.lists : []}
            birthdays={isPartShown(parts, 'birthdays') && (!idle || staysIdle(parts, 'birthdays')) ? household.birthdays : []}
            now={now}
            onTickChore={household.onTickChore}
            onAddShopping={household.onAddShopping}
          />
        </div>
      )}

      {/* The coming days as sentences (#805), bottom left. */}
      {isPartShown(parts, 'calendar') && (
        <div
          // Portrait (#934): the sentences take the width, below the arc.
          className={`absolute bottom-[3rem] left-[3rem] w-[min(56%,60rem)] portrait:bottom-auto portrait:right-[3rem] portrait:top-[46%] portrait:w-auto ${fades}`}
          aria-hidden={idle || undefined}
          style={{ zoom }}
          data-today-coming-wrap
        >
          <ComingDays
            events={events}
            now={now}
            daysAhead={Number(parts.find((p) => p.i === 'calendar')?.settings?.daysAhead) || undefined}
          />
        </div>
      )}
      </div>
    </div>
  );
}
