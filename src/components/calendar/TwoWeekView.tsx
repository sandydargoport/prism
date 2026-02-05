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

export interface TwoWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  maxEventsPerDay?: number;
}

export function TwoWeekView({
  currentDate,
  events,
  onEventClick,
  maxEventsPerDay = 8,
}: TwoWeekViewProps) {
  const weekStart = startOfWeek(currentDate);
  const twoWeekEnd = addDays(weekStart, 13);

  const days: Date[] = [];
  let day = weekStart;
  while (day <= twoWeekEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((name) => (
          <div
            key={name}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {name}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-2 gap-1">
        {days.map((date, index) => {
          const dayEvents = events.filter((event) =>
            isSameDay(event.startTime, date)
          );
          // All-day events first, then timed events sorted by start time
          const sorted = [...dayEvents].sort((a, b) => {
            if (a.allDay && !b.allDay) return -1;
            if (!a.allDay && b.allDay) return 1;
            return a.startTime.getTime() - b.startTime.getTime();
          });

          const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);

          return (
            <div
              key={index}
              className={cn(
                'border border-border rounded-md p-1 cursor-pointer bg-card/85 backdrop-blur-sm',
                'flex flex-col min-h-0 overflow-hidden',
                isPast && 'bg-gray-200 text-gray-600 dark:bg-muted/40 dark:text-muted-foreground',
                isToday(date) && 'border-primary border-2'
              )}
            >
              <div
                className={cn(
                  'text-sm font-medium mb-1 flex items-center gap-1',
                  isToday(date) && 'text-primary'
                )}
              >
                <span>{format(date, 'd')}</span>
                {index < 7 || index === 7 ? (
                  <span className="text-xs text-muted-foreground">
                    {format(date, 'MMM')}
                  </span>
                ) : null}
              </div>

              <div className="flex-1 overflow-hidden space-y-0.5">
                {sorted.slice(0, maxEventsPerDay).map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className={cn(
                      'w-full text-left text-xs px-1 rounded truncate hover:opacity-80 hover:ring-2 hover:ring-seasonal-accent/50 transition-all',
                      event.allDay ? 'py-px' : 'py-0.5'
                    )}
                    style={event.allDay
                      ? { backgroundColor: event.color + '20', borderLeft: `2px solid ${event.color}` }
                      : { color: event.color }
                    }
                  >
                    {event.allDay ? event.title : `• ${format(event.startTime, 'h:mm')} ${event.title}`}
                  </button>
                ))}
                {dayEvents.length > maxEventsPerDay && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayEvents.length - maxEventsPerDay} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
