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
} from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';

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
  onDateClick,
  isCenter,
}: {
  month: Date;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  isCenter: boolean;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  return (
    <div className={cn('flex flex-col', isCenter && 'ring-1 ring-primary/20 rounded-lg')}>
      {/* Month header */}
      <div className="text-center py-2 font-semibold text-sm">
        {format(month, 'MMMM yyyy')}
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-px px-1">
        {DAY_NAMES.map((name, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px px-1 pb-1">
        {days.map((date, index) => {
          const inMonth = isSameMonth(date, month);
          const today = isToday(date);
          const dayEvents = events.filter((e) => isSameDay(e.startTime, date));
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              key={index}
              onClick={() => onDateClick(date)}
              className={cn(
                'relative flex flex-col items-center py-1 rounded text-xs',
                'hover:bg-accent/50 transition-colors',
                !inMonth && 'text-muted-foreground/40',
                today && 'bg-seasonal-highlight/20 font-bold text-seasonal-accent',
              )}
            >
              <span>{format(date, 'd')}</span>
              {/* Event dots */}
              {hasEvents && inMonth && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((e, i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: e.color }}
                    />
                  ))}
                </div>
              )}
            </button>
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
}: ThreeMonthViewProps) {
  const prevMonth = subMonths(currentDate, 1);
  const nextMonth = addMonths(currentDate, 1);

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-fr">
      <MiniMonth month={prevMonth} events={events} onDateClick={onDateClick} isCenter={false} />
      <MiniMonth month={currentDate} events={events} onDateClick={onDateClick} isCenter={true} />
      <MiniMonth month={nextMonth} events={events} onDateClick={onDateClick} isCenter={false} />
    </div>
  );
}
