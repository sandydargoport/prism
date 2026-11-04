'use client';

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  getMonth,
} from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { DAYS_SINGLE_ARRAY } from '@/lib/constants/days';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import type { CalendarEvent } from '@/types/calendar';
import { seasonalPalettes } from '@/lib/themes/seasonalThemes';
import { useTimeFormat } from '@/components/providers';
import { InlineCalendarEvent, SpanningEventRows, DayOverflowPopover } from './cells';
import { useCardCapacity } from '@/lib/hooks/useCardCapacity';
import { eventOccursOnDisplayDay, eventSpansMultipleDisplayDays, toDisplayDate } from '@/lib/utils/timeFormat';
import { eventsOverlappingRange } from '@/lib/utils/calendarRange';
import { useDateLabels } from '@/lib/hooks/useDateLabels';

// Get the accent color for a month (1-12)
function getMonthColor(month: Date): string {
  const monthNum = getMonth(month) + 1; // getMonth returns 0-11
  const palette = seasonalPalettes[monthNum];
  return palette ? `hsl(${palette.light.accent})` : '#3B82F6';
}

export interface ThreeMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  bordered?: boolean;
}

const ALL_DAY_NAMES = DAYS_SINGLE_ARRAY;

/** Height of one compact event chip and the gap between two, as rendered. */
type ChipMetrics = { height: number; gap: number };

const PROBE_EVENT: CalendarEvent = {
  id: '__three-month-probe',
  title: 'Probe',
  startTime: new Date(2000, 0, 1, 9),
  endTime: new Date(2000, 0, 1, 10),
  allDay: false,
  color: '#888888',
} as CalendarEvent;

/**
 * Two invisible chips, stacked the way a day's list stacks them, so a day knows
 * how tall a chip is at the current text floor, zoom and theme spacing. A fixed
 * number here went stale every time one of those changed.
 */
function ChipProbe({ onMeasure }: { onMeasure: (m: ChipMetrics) => void }) {
  const ref = useRef<HTMLUListElement | null>(null);
  const measure = useCallback(() => {
    const items = ref.current?.children;
    if (!items || items.length < 2) return;
    const a = items[0]!.getBoundingClientRect();
    const b = items[1]!.getBoundingClientRect();
    if (a.height > 0) onMeasure({ height: a.height, gap: Math.max(0, b.top - a.bottom) });
  }, [onMeasure]);
  useEffect(() => {
    measure();
    const node = ref.current;
    if (!node) return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [measure]);
  return (
    <ul
      ref={ref}
      aria-hidden
      className="pointer-events-none invisible absolute left-0 top-0 w-16 list-none m-0 p-0 flex flex-col gap-(--event-gap)"
    >
      <li><InlineCalendarEvent event={PROBE_EVENT} onClick={() => {}} compact showTime={false} /></li>
      <li><InlineCalendarEvent event={PROBE_EVENT} onClick={() => {}} compact showTime={false} /></li>
    </ul>
  );
}

/**
 * A day's own events, as many as fit at the text floor. The rest fold into a
 * "+N" trigger rather than shrinking or scrolling inside a cell too small to
 * scroll on a wall.
 */
function DayEventList({
  date,
  events,
  chip,
  onEventClick,
}: {
  date: Date;
  events: CalendarEvent[];
  chip: ChipMetrics | undefined;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const { cellRef, fitWithOverflow, fitWithoutOverflow } = useCardCapacity({
    cardHeight: chip?.height,
    popoverHeight: chip?.height,
    gap: chip?.gap ?? 0,
    minVisible: 0,
  });
  // Until the first measurement, show nothing rather than a guess that spills.
  const visibleCount = fitWithoutOverflow === null || fitWithOverflow === null
    ? 0
    : events.length <= fitWithoutOverflow ? events.length : fitWithOverflow;
  const visible = events.slice(0, visibleCount);
  const hidden = events.slice(visible.length);

  return (
    <div ref={cellRef} className="mt-0.5 flex min-h-0 flex-1 flex-col gap-(--event-gap) overflow-hidden">
      {visible.length > 0 && (
        <ul className="list-none m-0 p-0 flex flex-col gap-(--event-gap)">
          {visible.map((event) => (
            <li key={event.id}>
              <InlineCalendarEvent event={event} onClick={onEventClick} compact showTime={false} />
            </li>
          ))}
        </ul>
      )}
      {chip && hidden.length > 0 && (
        <div onClick={(e) => e.stopPropagation()}>
          <DayOverflowPopover
            date={date}
            hiddenEvents={hidden}
            onEventClick={onEventClick}
            short
            triggerClassName="min-h-0 justify-center px-0.5 py-px text-4xs leading-tight"
          />
        </div>
      )}
    </div>
  );
}

function MiniMonth({
  month,
  events,
  onEventClick,
  onDateClick,
  isCenter,
  bordered = false,
  chip,
}: {
  chip: ChipMetrics | undefined;
  month: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  isCenter: boolean;
  bordered?: boolean;
}) {
  const { displayTimezone } = useTimeFormat();
  const d = useDateLabels();
  const displayNow = toDisplayDate(new Date(), displayTimezone);
  const { weekStartsOn } = useWeekStartsOn();
  // Sunday-first indices rotated to the configured week start; the initials
  // themselves come from the interface language.
  const dayIndices = Array.from({ length: ALL_DAY_NAMES.length }, (_, i) => (i + weekStartsOn) % ALL_DAY_NAMES.length);
  const bgOverride = useWidgetBgOverride();
  const transparentMode = bgOverride?.hasCustomBg === true;
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });
  const monthColor = getMonthColor(month);

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  // Scope the wide event list to this mini-month's visible grid once, so the
  // spanning filter and the per-day filter below iterate ~40 events, not thousands.
  const scopedEvents = eventsOverlappingRange(events, calendarStart, calendarEnd);
  // Every all-day event goes in the lane band, not just the multi-day ones, so
  // a single-day event can take a lane a multi-day one leaves free above
  // itself. Same rule as MonthView; see the note there.
  const spanningEvents = scopedEvents
    .filter((event) => event.allDay || eventSpansMultipleDisplayDays(
      event.startTime,
      event.endTime,
      event.allDay,
      displayTimezone,
    ))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime() || a.title.localeCompare(b.title));
  const spanningEventSet = new Set(spanningEvents);

  return (
    <div className={cn(
      'flex flex-col flex-1 rounded-lg overflow-hidden',
      !transparentMode && 'bg-card/85 backdrop-blur-xs',
      isCenter && 'ring-2 ring-primary/30'
    )}>
      {/* Month header with themed color — compact band so the three minis
          can use more vertical space for actual day cells. */}
      <div
        className="text-center py-1 font-semibold text-sm shrink-0 text-white shadow-xs"
        style={{ backgroundColor: monthColor }}
      >
        {d.monthYear(month)}
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-px px-1 shrink-0">
        {dayIndices.map((index) => (
          <div key={index} className="text-center text-3xs font-medium text-muted-foreground py-1">
            {d.weekdayByIndex(index, 'weekdayNarrow')}
          </div>
        ))}
      </div>

      {/* Day grid — fills remaining space */}
      <div className="flex-1 flex flex-col gap-px px-1 pb-1">
        {weeks.map((week, weekIndex) => {
          const visibleRowDates = week.filter((date) => isSameMonth(date, month));
          const rowSpanningEvents = spanningEvents.filter((event) => visibleRowDates.some((rowDate) =>
            eventOccursOnDisplayDay(
              event.startTime,
              event.endTime,
              event.allDay,
              rowDate,
              displayTimezone,
            )));

          return (
            <div key={weekIndex} className="flex-1 grid grid-cols-7 gap-px min-h-0">
              {week.map((date, dayIndex) => {
              const inMonth = isSameMonth(date, month);
              const today = isSameDay(date, displayNow);
              const dayEvents = scopedEvents
                .filter((event) => !spanningEventSet.has(event))
                .filter((event) => eventOccursOnDisplayDay(
                  event.startTime,
                  event.endTime,
                  event.allDay,
                  date,
                  displayTimezone,
                ))
                .sort((a, b) => {
                  if (a.allDay && !b.allDay) return -1;
                  if (!a.allDay && b.allDay) return 1;
                  return a.startTime.getTime() - b.startTime.getTime();
                });

              return (
                <div
                  key={dayIndex}
                  data-three-month-day={format(date, 'yyyy-MM-dd')}
                  onClick={() => onDateClick(date)}
                  className={cn(
                    'relative flex min-h-0 flex-col rounded text-xs cursor-pointer overflow-visible p-0.5',
                    bordered && 'border border-border',
                    !inMonth && 'text-muted-foreground/40',
                  )}
                >
                  <div className="flex h-4 shrink-0 items-center justify-center">
                    <span className={cn(
                      'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-3xs leading-tight',
                      today && 'bg-primary font-bold text-primary-foreground',
                    )}>
                      {format(date, 'd')}
                    </span>
                  </div>
                  {inMonth && (
                    <SpanningEventRows
                      date={date}
                      rowDates={visibleRowDates}
                      events={rowSpanningEvents}
                      onEventClick={onEventClick}
                      compact
                    />
                  )}
                  {inMonth && dayEvents.length > 0 && (
                    <DayEventList date={date} events={dayEvents} chip={chip} onEventClick={onEventClick} />
                  )}
                </div>
              );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ThreeMonthView({
  currentDate,
  events,
  onEventClick,
  onDateClick,
  bordered = false,
}: ThreeMonthViewProps) {
  const prevMonth = subMonths(currentDate, 1);
  const nextMonth = addMonths(currentDate, 1);
  const orientation = useOrientation();
  const isPortrait = orientation === 'portrait';
  const [chip, setChip] = useState<ChipMetrics | undefined>(undefined);
  const onMeasure = useCallback((m: ChipMetrics) => {
    setChip((prev) => (prev && prev.height === m.height && prev.gap === m.gap ? prev : m));
  }, []);

  return (
    <div className={cn(
      "relative h-full gap-2 overflow-y-auto pb-4 md:pb-20",
      isPortrait ? "flex flex-col" : "flex flex-row"
    )}>
      <ChipProbe onMeasure={onMeasure} />
      <MiniMonth month={prevMonth} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={false} bordered={bordered} chip={chip} />
      <MiniMonth month={currentDate} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={true} bordered={bordered} chip={chip} />
      <MiniMonth month={nextMonth} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={false} bordered={bordered} chip={chip} />
    </div>
  );
}
