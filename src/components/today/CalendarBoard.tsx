'use client';

/**
 * The Calendar layout's board (#931): a light calendar straight on the photo.
 * One heading line (the range, a Week and Month word switch, the arrows),
 * then either a rolling week, today the widest column, or a month for
 * planning up close. Hairlines instead of boxes; a person's colour only as a
 * thin bar. Tapping an event opens the event sheet (#836); tapping a busy day
 * in the month opens a day sheet.
 */
import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { addDays, addMonths, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { eventOccursOnDisplayDay, formatBareTime, getDisplayDateKey, toDisplayDate } from '@/lib/utils/timeFormat';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export type BoardMode = 'week' | 'month';

/** The days a board shows: seven from today (shifted by whole weeks), or the month's weeks. */
export function boardDays(today: Date, mode: BoardMode, offset: number, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6): Date[] {
  if (mode === 'week') {
    const first = addDays(today, offset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(first, i));
  }
  const month = addMonths(startOfMonth(today), offset);
  const first = startOfWeek(month, { weekStartsOn });
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  // Drop a last week that is wholly next month.
  return days[35]!.getMonth() !== month.getMonth() ? days.slice(0, 35) : days;
}

export function CalendarBoard({ events, now, onOpenEvent, headingEnd }: {
  events: CalendarEvent[];
  now: Date;
  onOpenEvent?: (event: CalendarEvent) => void;
  /** At the end of the heading line: the chores and shopping lines. */
  headingEnd?: ReactNode;
}) {
  const t = useTranslations('today');
  const locale = useLocale();
  const { timeFormat, displayTimezone } = useTimeFormat();
  const { weekStartsOn } = useWeekStartsOn();
  const [mode, setMode] = useState<BoardMode>('week');
  const [offset, setOffset] = useState(0);
  const [dayOpen, setDayOpen] = useState<Date | null>(null);

  const today = toDisplayDate(now, displayTimezone);
  const todayKey = getDisplayDateKey(now, displayTimezone);
  const days = boardDays(today, mode, offset, (weekStartsOn ?? 0) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  const key = (d: Date) => getDisplayDateKey(d, undefined);
  const onDay = (d: Date) => events
    .filter((e) => eventOccursOnDisplayDay(e.startTime, e.endTime, e.allDay, d, displayTimezone))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startTime.getTime() - b.startTime.getTime());
  const time = (d: Date) => formatBareTime(d, timeFormat, displayTimezone);
  const month = mode === 'month' ? addMonths(startOfMonth(today), offset) : null;

  const range = mode === 'week'
    ? t('weekRange', {
      from: days[0]!.toLocaleDateString(locale, { month: 'long', day: 'numeric' }),
      to: days[6]!.toLocaleDateString(locale, days[0]!.getMonth() === days[6]!.getMonth() ? { day: 'numeric' } : { month: 'long', day: 'numeric' }),
    })
    : month!.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const eventRow = (e: CalendarEvent, compact = false) => {
    const past = e.endTime.getTime() <= now.getTime();
    return (
      <button
        key={e.id}
        type="button"
        onClick={() => onOpenEvent?.(e)}
        className={`flex min-h-[44px] w-full items-start gap-2 text-left ${past ? 'opacity-60' : ''}`}
        data-board-event
      >
        <span className="mt-1 h-[1.1em] w-[3px] shrink-0 rounded-full" style={{ backgroundColor: e.color }} aria-hidden />
        <span className={`min-w-0 ${compact ? 'truncate text-caption' : 'text-body'}`}>
          {!e.allDay && <span className="mr-1.5 tabular-nums opacity-80">{time(e.startTime)}</span>}
          {e.title}
        </span>
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col gap-3" data-calendar-board data-board-mode={mode}>
      {/* The heading line: the range, the Week and Month words, the arrows. */}
      <div className="flex min-h-[48px] flex-wrap items-center gap-x-6 gap-y-1" data-board-heading>
        <h2 className="m-0 text-title font-medium" style={{ fontFamily: 'var(--font-display)' }} data-board-range>{range}</h2>
        <div className="flex items-center gap-1" role="radiogroup" aria-label={t('view')}>
          {(['week', 'month'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => { setMode(m); setOffset(0); }}
              className={`min-h-[44px] px-3 text-body ${mode === m ? 'font-semibold underline decoration-2 underline-offset-8' : 'opacity-75'}`}
              data-board-switch={m}
            >
              {t(m)}
            </button>
          ))}
        </div>
        <div className="flex items-center">
          <button type="button" className="flex h-[44px] w-[44px] items-center justify-center rounded-full hover:bg-white/10" onClick={() => setOffset((o) => o - 1)} aria-label={t('earlier')}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" className="flex h-[44px] w-[44px] items-center justify-center rounded-full hover:bg-white/10" onClick={() => setOffset((o) => o + 1)} aria-label={t('later')}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        {headingEnd && <div className="ml-auto">{headingEnd}</div>}
      </div>

      {mode === 'week' ? (
        <div className="flex min-h-0 flex-1" data-board-week>
          {days.map((d, i) => {
            const isToday = key(d) === todayKey;
            const list = onDay(d);
            return (
              <section
                key={key(d)}
                className={`flex min-w-0 flex-col gap-1 px-3 ${i ? 'border-l border-white/25' : ''} ${isToday ? 'flex-[1.6]' : 'flex-1'}`}
                data-board-day={key(d)}
                data-board-today={isToday || undefined}
              >
                <header className="flex items-baseline gap-2 pb-1">
                  <span className="text-caption font-medium uppercase tracking-wide opacity-85">{d.toLocaleDateString(locale, { weekday: 'short' })}</span>
                  <span
                    className={`flex items-center justify-center tabular-nums ${isToday ? 'h-9 w-9 rounded-full bg-white text-title font-semibold text-black [text-shadow:none]' : 'text-title'}`}
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {d.getDate()}
                  </span>
                </header>
                <div className="flex min-h-0 flex-col overflow-hidden">
                  {list.map((e) => eventRow(e))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-7 [grid-auto-rows:minmax(0,1fr)]" data-board-month>
          {days.map((d, i) => {
            const inMonth = d.getMonth() === month!.getMonth();
            const isToday = key(d) === todayKey;
            const list = onDay(d);
            // Past weeks go compact so every event from today on fits in full.
            const pastWeek = key(addDays(d, 6 - (i % 7))) < todayKey;
            const shown = pastWeek ? [] : list.slice(0, 3);
            return (
              <button
                key={key(d)}
                type="button"
                onClick={() => (list.length === 1 ? onOpenEvent?.(list[0]!) : list.length > 1 ? setDayOpen(d) : undefined)}
                className={`flex min-h-[44px] min-w-0 flex-col items-stretch gap-0.5 overflow-hidden border-t border-white/25 px-2 py-1 text-left ${inMonth ? '' : 'opacity-50'}`}
                data-board-day={key(d)}
                data-board-today={isToday || undefined}
              >
                <span className={`tabular-nums ${isToday ? 'flex h-7 w-7 items-center justify-center rounded-full bg-white font-semibold text-black [text-shadow:none]' : ''}`}>{d.getDate()}</span>
                {pastWeek && list.length > 0 && (
                  <span className="flex gap-1" aria-hidden>{list.slice(0, 5).map((e) => <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: e.color }} />)}</span>
                )}
                {shown.map((e) => (
                  <span key={e.id} className="flex min-w-0 items-center gap-1.5 text-caption">
                    <span className="h-[0.9em] w-[3px] shrink-0 rounded-full" style={{ backgroundColor: e.color }} aria-hidden />
                    <span className="truncate">{e.allDay ? e.title : `${time(e.startTime)} ${e.title}`}</span>
                  </span>
                ))}
                {!pastWeek && list.length > 3 && <span className="text-caption opacity-80">{t('more', { count: list.length - 3 })}</span>}
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={dayOpen !== null} onOpenChange={(o) => { if (!o) setDayOpen(null); }}>
        <DialogContent className="max-w-md" data-board-day-sheet>
          <DialogTitle>{dayOpen?.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}</DialogTitle>
          <div className="flex flex-col">
            {dayOpen && onDay(dayOpen).map((e) => (
              <button
                key={e.id}
                type="button"
                className="flex min-h-[52px] items-center gap-3 text-left text-body"
                onClick={() => { setDayOpen(null); onOpenEvent?.(e); }}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: e.color }} aria-hidden />
                <span className="tabular-nums text-muted-foreground">{e.allDay ? t('allDayShort') : time(e.startTime)}</span>
                <span>{e.title}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
