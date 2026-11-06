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
import { isTodayNight } from '@/lib/today/night';
import { shownWhenIdle } from '@/components/screensaver/calmMode';
import { TODAY_TEXT_SIZES, type TodayTextSize } from './TodayPartsPanel';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import type { CalendarEvent } from '@/types/calendar';
import { SunArc } from './SunArc';
import { TodayList } from './TodayList';
import { ComingDays } from './ComingDays';
import { QuietLines } from './QuietLines';
import { CalendarBoard } from './CalendarBoard';
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
  kind = 'today',
  topOffset = 0,
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
  /** Today's arc and sentences, or the Calendar layout's board (#931). */
  kind?: 'today' | 'calendar';
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
  // After dusk: warm ink, a veil over the photo and the moon (#926).
  const night = isTodayNight(now, weather?.sunrise, weather?.sunset);
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
      data-today-night={night || undefined}
    >
      {night && <div className="absolute inset-0 bg-black/60" aria-hidden data-today-veil />}
      {isPartShown(parts, 'clock') && (
        <div data-today-corner="left" className={`absolute left-[3rem] top-[2.5rem] flex flex-col items-start ${fadeUnless('clock')}`}>
          <time className="text-body font-medium opacity-95" data-today-date>{date}</time>
          <time
            className="font-medium leading-none tabular-nums tracking-[-0.02em] whitespace-nowrap"
            // Smaller on the Calendar layout, to give the board its height (#931).
            style={{ fontFamily: 'var(--font-display)', fontSize: kind === 'calendar' ? 'max(var(--text-floor), min(6rem, 10vw))' : 'max(var(--text-floor), min(8rem, 14vw))' }}
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

      {/* The Calendar layout (#931): the board under the corners. */}
      {kind === 'calendar' && isPartShown(parts, 'calendar') && (
        <div className={`absolute bottom-[4.5rem] left-[3rem] right-[3rem] top-[11.5rem] ${fades}`} style={{ zoom }} data-calendar-layout>
          <CalendarBoard
            events={events}
            now={now}
            onOpenEvent={onOpenEvent}
            headingEnd={household && (
              <QuietLines
                inline
                chores={isPartShown(parts, 'chores') ? household.chores : []}
                lists={isPartShown(parts, 'shopping') ? household.lists : []}
                birthdays={[]}
                now={now}
                onTickChore={household.onTickChore}
                onAddShopping={household.onAddShopping}
              />
            )}
          />
        </div>
      )}

      {/* Simple leads with today as a list (#1030): Next, then later today. */}
      {kind === 'today' && isPartShown(parts, 'calendar') && !showArc && (
        <div
          className={`absolute left-[3rem] w-[min(58%,62rem)] transition-[top,opacity] duration-1000 portrait:right-[3rem] portrait:w-auto ${idle ? 'top-[40%] portrait:top-[22%]' : 'top-[28%] portrait:top-[14%]'} ${idle && !staysIdle(parts, 'calendar') ? 'opacity-0' : ''}`}
          style={{ zoom }}
          data-today-list-wrap
        >
          <TodayList events={events} now={now} onOpenEvent={onOpenEvent} variant="wall" onlyNext={idle} />
        </div>
      )}

      {/* The day as the sun's path (#909), now an option (#1030), margin to margin across the middle. */}
      {kind === 'today' && isPartShown(parts, 'calendar') && showArc && (
        <div
          className={`absolute left-[3rem] right-[3rem] h-[38%] transition-[top,opacity] duration-1000 portrait:h-[26%] ${idle ? 'top-[44%] portrait:top-[24%]' : 'top-[30%] portrait:top-[14%]'} ${idle && !staysIdle(parts, 'calendar') ? 'opacity-0' : ''}`}
          data-today-arc
        >
          <SunArc events={events} now={now} sunrise={weather?.sunrise} sunset={weather?.sunset} moonrise={weather?.moonrise} moonset={weather?.moonset} moonPhase={weather?.moonPhase} onOpenEvent={onOpenEvent} onlyNext={idle} />
        </div>
      )}

      {/* Quiet lines (#911), bottom right. */}
      {kind === 'today' && household && (
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
      {kind === 'today' && isPartShown(parts, 'calendar') && (
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
  );
}
