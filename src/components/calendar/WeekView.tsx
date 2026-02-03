'use client';

import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';

export interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export function WeekView({
  currentDate,
  events,
  onEventClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 gap-2 mb-2">
        {days.map((date) => {
          const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);
          return (
          <div
            key={date.toISOString()}
            className={cn(
              'text-center py-2 rounded-md bg-card/85 backdrop-blur-sm',
              isPast && 'bg-muted/60 dark:bg-muted/40',
              isToday(date) && 'bg-primary text-primary-foreground'
            )}
          >
            <div className="text-sm font-medium">
              {format(date, 'EEE')}
            </div>
            <div className="text-2xl font-bold">
              {format(date, 'd')}
            </div>
          </div>
          );
        })}
      </div>

      <div className="flex-1 grid grid-cols-7 gap-2 overflow-y-auto">
        {days.map((date) => {
          const dayEvents = events.filter((event) =>
            isSameDay(event.startTime, date)
          );
          // All-day events first, then timed events sorted by start time
          const sorted = [...dayEvents].sort((a, b) => {
            if (a.allDay && !b.allDay) return -1;
            if (!a.allDay && b.allDay) return 1;
            return a.startTime.getTime() - b.startTime.getTime();
          });
          const isPastDay = isBefore(date, startOfDay(new Date())) && !isToday(date);

          return (
            <div key={date.toISOString()} className={cn("space-y-1 bg-card/85 backdrop-blur-sm rounded-md p-1", isPastDay && "bg-muted/60 dark:bg-muted/40")}>
              {sorted.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={cn(
                    'w-full text-left rounded-md hover:opacity-80 hover:ring-2 hover:ring-seasonal-accent/50 transition-all',
                    event.allDay ? 'px-2 py-1' : 'p-2'
                  )}
                  style={{ backgroundColor: event.color + '20', borderLeft: `3px solid ${event.color}` }}
                >
                  {!event.allDay && (
                    <div className="text-xs text-muted-foreground">
                      {format(event.startTime, 'h:mm a')}
                    </div>
                  )}
                  <div className="text-sm font-medium truncate">
                    {event.title}
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
