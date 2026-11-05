'use client';

/**
 * Today on a phone (#928), in place of the widget cards when the layout is a
 * Today or Calendar layout. A short photo header with the date and the next
 * event in the display face, then a paper sheet with the coming days as
 * sentences (the wall's builder, #805) and the chores and shopping lines
 * (#911). Tapping the next event opens the shared event sheet (#836).
 */
import { useLocale, useTranslations } from 'next-intl';
import { useTimeFormat } from '@/components/providers';
import { eventOccursOnDisplayDay, formatDisplayTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { useNow } from '@/lib/hooks/useNow';
import { nextEventToday } from '@/lib/today/nextEvent';
import type { CalendarEvent } from '@/types/calendar';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import type { BirthdayLike, ChoreLike } from '@/lib/today/quietLines';
import { ComingDays } from './ComingDays';
import { QuietLines } from './QuietLines';
import { isPartShown } from './TodayScene';

export function PhoneToday({ parts, events, onOpenEvent, household }: {
  parts: WidgetConfig[];
  events: CalendarEvent[];
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
  const t = useTranslations('today');
  const { timeFormat, displayTimezone } = useTimeFormat();
  const today = toDisplayDate(now, displayTimezone);
  const date = today.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const calendar = isPartShown(parts, 'calendar');
  const next = calendar
    ? nextEventToday(events, now, (e) => eventOccursOnDisplayDay(e.startTime, e.endTime, e.allDay, today, displayTimezone))
    : undefined;

  return (
    <div className="flex min-h-[calc(var(--app-vh,100dvh)-var(--nav-bottom,0px))] flex-col" data-phone-today>
      {/* The photo shows through here in the light ink; with no photo the
          header is on the page's paper, in its ink. */}
      <header
        className={[
          'flex min-h-[32dvh] flex-col justify-end gap-1 px-5 pb-6 pt-10',
          'text-white [text-shadow:var(--ds-idle-text-shadow)]',
          '[html:not([data-wallpaper])_&]:min-h-0 [html:not([data-wallpaper])_&]:text-foreground [html:not([data-wallpaper])_&]:[text-shadow:none]',
        ].join(' ')}
        data-phone-today-header
      >
        <time className="text-body font-medium opacity-95" data-phone-today-date>{date}</time>
        {next ? (
          <button
            type="button"
            onClick={() => onOpenEvent(next)}
            className="min-h-[44px] text-left text-title leading-tight [text-wrap:balance]"
            style={{ fontFamily: 'var(--font-display)' }}
            data-phone-today-next
          >
            {next.title}
            {!next.allDay && (
              <span className="ml-2 align-baseline text-body opacity-90" style={{ fontFamily: 'var(--font-sans)' }} data-phone-today-next-time>
                {formatDisplayTime(next.startTime, timeFormat, {}, displayTimezone)}
              </span>
            )}
          </button>
        ) : calendar ? (
          <p className="m-0 text-title" style={{ fontFamily: 'var(--font-display)' }} data-phone-today-next-none>
            {t('nothingElseToday')}
          </p>
        ) : null}
      </header>

      <section className="flex flex-1 flex-col gap-8 rounded-t-3xl bg-background px-5 pb-8 pt-6 text-foreground" data-phone-today-sheet>
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
