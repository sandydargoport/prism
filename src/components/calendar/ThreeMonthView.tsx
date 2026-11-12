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
import { cn } from '@/lib/utils';
import { DAYS_SINGLE_ARRAY } from '@/lib/constants/days';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import type { CalendarEvent } from '@/types/calendar';
import { seasonalPalettes } from '@/lib/themes/seasonalThemes';
import { useTimeFormat } from '@/components/providers';
import { InlineCalendarEvent, SpanningEventRows, ChipProbe, DayEventList, useChipMetrics, type ChipMetrics } from './cells';
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
                    <DayEventList
                      date={date}
                      events={dayEvents}
                      chip={chip}
                      onEventClick={onEventClick}
                      compact
                      showTime={false}
                      short
                      className="mt-0.5"
                      triggerClassName="min-h-0 justify-center px-0.5 py-px text-4xs leading-tight"
                    />
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
  const [chip, onMeasure] = useChipMetrics();

  return (
    <div className={cn(
      "relative h-full gap-2 overflow-y-auto pb-4 md:pb-20",
      isPortrait ? "flex flex-col" : "flex flex-row"
    )}>
      <ChipProbe onMeasure={onMeasure} compact showTime={false} />
      <MiniMonth month={prevMonth} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={false} bordered={bordered} chip={chip} />
      <MiniMonth month={currentDate} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={true} bordered={bordered} chip={chip} />
      <MiniMonth month={nextMonth} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={false} bordered={bordered} chip={chip} />
    </div>
  );
}
