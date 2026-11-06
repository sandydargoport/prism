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

  return (
    <div className="flex min-h-[calc(var(--app-vh,100dvh)-var(--nav-bottom,0px))] flex-col" data-phone-today>
      {/* The photo shows through here in the light ink; with no photo the
          header is on the page's paper, in its ink. */}
      <header
        className={[
          'flex items-start justify-between gap-4 px-5 pb-6 pt-10',
          'text-white [text-shadow:var(--ds-idle-text-shadow)]',
          '[html:not([data-wallpaper])_&]:text-foreground [html:not([data-wallpaper])_&]:[text-shadow:none]',
        ].join(' ')}
        data-phone-today-header
      >
        <div className="flex min-w-0 flex-col gap-1">
          {isPartShown(parts, 'clock') && (
            <time className="text-display leading-none tabular-nums" style={{ fontFamily: 'var(--font-display)' }} data-phone-today-time>
              {formatDisplayTime(now, timeFormat, {}, displayTimezone)}
            </time>
          )}
          <span className="text-body opacity-90" data-phone-today-date>{date}</span>
        </div>
        {isPartShown(parts, 'weather') && current && weather && (
          <div className="flex shrink-0 flex-col items-end gap-1" data-phone-today-weather>
            <span className="text-title leading-none" style={{ fontFamily: 'var(--font-display)' }}>{formatTemp(current.temperature, weather.units)}</span>
            <span className="text-caption opacity-90">{current.description}</span>
          </div>
        )}
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
