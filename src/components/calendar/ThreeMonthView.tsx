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
import { InlineCalendarEvent, SpanningEventRows } from './cells';
import { eventOccursOnDisplayDay, eventSpansMultipleDisplayDays, toDisplayDate } from '@/lib/utils/timeFormat';

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
}: {
  month: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  isCenter: boolean;
  bordered?: boolean;
}) {
  const { displayTimezone } = useTimeFormat();
  const displayNow = toDisplayDate(new Date(), displayTimezone);
  const { weekStartsOn } = useWeekStartsOn();
  const dayNames = [...ALL_DAY_NAMES.slice(weekStartsOn), ...ALL_DAY_NAMES.slice(0, weekStartsOn)];
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
  const spanningEvents = events
    .filter((event) => eventSpansMultipleDisplayDays(
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
      !transparentMode && 'bg-card/85 backdrop-blur-sm',
      isCenter && 'ring-2 ring-primary/30'
    )}>
      {/* Month header with themed color — compact band so the three minis
          can use more vertical space for actual day cells. */}
      <div
        className="text-center py-1 font-semibold text-sm flex-shrink-0 text-white shadow-sm"
        style={{ backgroundColor: monthColor }}
      >
        {format(month, 'MMMM yyyy')}
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-px px-1 flex-shrink-0">
        {dayNames.map((name, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {name}
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
              const dayEvents = events
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
                  onClick={() => onDateClick(date)}
                  className={cn(
                    'relative flex flex-col rounded text-xs cursor-pointer overflow-visible p-0.5',
                    bordered && 'border border-border',
                    !inMonth && 'text-muted-foreground/40',
                  )}
                >
                  <div className="flex h-4 flex-shrink-0 items-center justify-center">
                    <span className={cn(
                      'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] leading-tight',
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
                      gap="1px"
                    />
                  )}
                  {/* Event list — scrollable within day cell */}
                  {inMonth && dayEvents.length > 0 && (
                    <ul className="flex-1 overflow-y-auto space-y-px mt-0.5 scrollbar-thin list-none m-0 p-0">
                      {dayEvents.map((event) => (
                        <li key={event.id}>
                          <InlineCalendarEvent
                            event={event}
                            onClick={onEventClick}
                            compact
                            showTime={false}
                          />
                        </li>
                      ))}
                    </ul>
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

  return (
    <div className={cn(
      "h-full gap-2 overflow-y-auto pb-4 md:pb-20",
      isPortrait ? "flex flex-col" : "flex flex-row"
    )}>
      <MiniMonth month={prevMonth} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={false} bordered={bordered} />
      <MiniMonth month={currentDate} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={true} bordered={bordered} />
      <MiniMonth month={nextMonth} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={false} bordered={bordered} />
    </div>
  );
}
