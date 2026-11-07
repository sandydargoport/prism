'use client';

/**
 * Today on a phone (#928, #1030), in place of the widget cards when the
 * layout is a Today or Calendar layout: the time and the weather on top, then
 * a paper sheet with today as a list (Next, then later today), the coming
 * days as sentences (#805), and the chores and shopping lines (#911).
 * Tapping an event opens the shared event sheet (#836).
 */
import { useLocale } from 'next-intl';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { useNow } from '@/lib/hooks/useNow';
import { useEffect } from 'react';
import type { CalendarEvent } from '@/types/calendar';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import type { BirthdayLike, ChoreLike } from '@/lib/today/quietLines';
import { formatTemp, type WeatherData } from '@/components/widgets/WeatherWidget';
import { ComingDays } from './ComingDays';
import { QuietLines } from './QuietLines';
import { TodayList } from './TodayList';
import { isPartShown } from './TodayScene';

export function PhoneToday({ parts, events, weather, onOpenEvent, household }: {
  parts: WidgetConfig[];
  events: CalendarEvent[];
  weather?: WeatherData | null;
  onOpenEvent: (event: CalendarEvent) => void;
  household: {
    chores: ChoreLike[];
    lists: Array<{ id: string; name: string; items: Array<{ checked: boolean }> }>;
    birthdays: BirthdayLike[];
    onTickChore?: (choreId: string) => void;
    onAddShopping?: () => void;
  };
}) {
  const now = useNow();
  const locale = useLocale();
  const { timeFormat, displayTimezone } = useTimeFormat();
  const today = toDisplayDate(now, displayTimezone);
  const date = today.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const calendar = isPartShown(parts, 'calendar');
  const current = weather?.current;
  // No rubber-band bounce while the phone's Today is showing. Set on body as
  // well as the root: some iOS versions bounce the body, so with only the
  // root set the page still dragged and sprang back.
  useEffect(() => {
    const els = [document.documentElement, document.body];
    const before = els.map((el) => el.style.overscrollBehaviorY);
    for (const el of els) el.style.overscrollBehaviorY = 'none';
    return () => els.forEach((el, i) => { el.style.overscrollBehaviorY = before[i]!; });
  }, []);

  return (
    // Exactly one screen when it fits (#1034): the notch area is part of the
    // screen, and the page does not bounce when there is nothing below.
    <div className="flex min-h-[calc(var(--app-vh,100dvh)-var(--nav-bottom,0px)-env(safe-area-inset-top,0px))] flex-col" data-phone-today>
      {/* The photo shows through here in the light ink; with no photo the
          header is on the page's paper, in its ink. */}
      <header
        className={[
          // Two aligned rows (#1034): the time and the temperature share a
          // baseline, and so do the date and the condition below them.
          // Below the iPhone's status bar, which Safari draws frosted over
          // whatever is under it (#1036).
          'grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 px-5 pb-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]',
          'text-white [text-shadow:var(--ds-idle-text-shadow)]',
          '[html:not([data-wallpaper])_&]:text-foreground [html:not([data-wallpaper])_&]:[text-shadow:none]',
        ].join(' ')}
        data-phone-today-header
      >
        <time className="text-display leading-none tabular-nums" style={{ fontFamily: 'var(--font-display)' }} data-phone-today-time>
          {isPartShown(parts, 'clock') ? formatDisplayTime(now, timeFormat, {}, displayTimezone) : null}
        </time>
        <span className="text-display text-right leading-none" style={{ fontFamily: 'var(--font-display)' }} data-phone-today-temp>
          {isPartShown(parts, 'weather') && current && weather ? formatTemp(current.temperature, weather.units) : null}
        </span>
        <span className="text-body opacity-90" data-phone-today-date>{date}</span>
        <span className="text-body text-right opacity-90" data-phone-today-condition>
          {isPartShown(parts, 'weather') && current ? current.description : null}
        </span>
      </header>

      <section className="flex flex-1 flex-col gap-8 rounded-t-3xl bg-background px-5 pb-8 pt-6 text-foreground" data-phone-today-sheet>
        {calendar && <TodayList events={events} now={now} onOpenEvent={onOpenEvent} variant="phone" />}
        {calendar && <ComingDays events={events} now={now} />}
        <QuietLines
          onPaper
          chores={isPartShown(parts, 'chores') ? household.chores : []}
          lists={isPartShown(parts, 'shopping') ? household.lists : []}
          birthdays={isPartShown(parts, 'birthdays') ? household.birthdays : []}
          now={now}
          onTickChore={household.onTickChore}
          onAddShopping={household.onAddShopping}
        />
      </section>
    </div>
  );
}
