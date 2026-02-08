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
  isToday,
  isBefore,
  startOfDay,
  getMonth,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useOrientation } from '@/lib/hooks/useOrientation';
import type { CalendarEvent } from '@/types/calendar';
import { seasonalPalettes } from '@/lib/themes/seasonalThemes';

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
}

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function MiniMonth({
  month,
  events,
  onEventClick,
  onDateClick,
  isCenter,
}: {
  month: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  isCenter: boolean;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
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

  return (
    <div className={cn(
      'flex flex-col flex-1 bg-card/85 backdrop-blur-sm rounded-lg overflow-hidden',
      isCenter && 'ring-2 ring-primary/30'
    )}>
      {/* Month header with themed color */}
      <div
        className="text-center py-3 font-bold text-base flex-shrink-0 text-white shadow-sm"
        style={{ backgroundColor: monthColor }}
      >
        {format(month, 'MMMM yyyy')}
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-px px-1 flex-shrink-0">
        {DAY_NAMES.map((name, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Day grid — fills remaining space */}
      <div className="flex-1 flex flex-col gap-px px-1 pb-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex-1 grid grid-cols-7 gap-px min-h-0">
            {week.map((date, dayIndex) => {
              const inMonth = isSameMonth(date, month);
              const today = isToday(date);
              const isPast = isBefore(date, startOfDay(new Date())) && !today;
              const dayEvents = events
                .filter((e) => isSameDay(e.startTime, date))
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
                    'flex flex-col rounded text-xs cursor-pointer overflow-hidden p-0.5',
                    !inMonth && 'text-muted-foreground/40',
                    isPast && inMonth && 'bg-gray-200 text-gray-600 dark:bg-muted/30 dark:text-muted-foreground',
                    today && 'bg-seasonal-highlight/20',
                  )}
                >
                  <span className={cn(
                    'text-center text-[10px] leading-tight flex-shrink-0',
                    today && 'font-bold text-seasonal-accent',
                  )}>
                    {format(date, 'd')}
                  </span>
                  {/* Event list — scrollable within day cell */}
                  {inMonth && dayEvents.length > 0 && (
                    <ul className="flex-1 overflow-y-auto space-y-px mt-0.5 scrollbar-thin list-none m-0 p-0">
                      {dayEvents.map((event) => (
                        <li
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          className="text-[8px] leading-tight px-0.5 rounded truncate cursor-pointer hover:opacity-80 hover:ring-1 hover:ring-seasonal-accent/50 transition-all"
                          style={event.allDay
                            ? { backgroundColor: event.color + '20', borderLeft: `2px solid ${event.color}` }
                            : { color: event.color }
                          }
                        >
                          {event.allDay ? event.title : `• ${event.title}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThreeMonthView({
  currentDate,
  events,
  onEventClick,
  onDateClick,
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
      <MiniMonth month={prevMonth} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={false} />
      <MiniMonth month={currentDate} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={true} />
      <MiniMonth month={nextMonth} events={events} onEventClick={onEventClick} onDateClick={onDateClick} isCenter={false} />
    </div>
  );
}
