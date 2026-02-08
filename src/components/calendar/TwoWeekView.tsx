'use client';

import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
  getWeek,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useOrientation } from '@/lib/hooks/useOrientation';
import type { CalendarEvent } from '@/types/calendar';

export interface TwoWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export function TwoWeekView({
  currentDate,
  events,
  onEventClick,
}: TwoWeekViewProps) {
  const weekStart = startOfWeek(currentDate);
  const orientation = useOrientation();
  const isPortrait = orientation === 'portrait';

  const days: Date[] = [];
  for (let i = 0; i < 14; i++) {
    days.push(addDays(weekStart, i));
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const week1 = days.slice(0, 7);
  const week2 = days.slice(7, 14);
  const week1Num = getWeek(week1[0]!);
  const week2Num = getWeek(week2[0]!);

  const renderDayCell = (date: Date, compact: boolean = false) => {
    const dayEvents = events.filter((event) => isSameDay(event.startTime, date));
    const sorted = [...dayEvents].sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.startTime.getTime() - b.startTime.getTime();
    });
    const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);

    return (
      <div
        className={cn(
          'border border-border rounded-md bg-card/85 backdrop-blur-sm h-full',
          'flex flex-col overflow-hidden',
          isPast && 'bg-gray-200 text-gray-600 dark:bg-muted/40 dark:text-muted-foreground',
          isToday(date) && 'border-primary border-2'
        )}
      >
        {/* Date header */}
        <div
          className={cn(
            'shrink-0 px-1',
            compact ? 'py-0.5' : 'py-1',
            isToday(date) && 'bg-primary/10'
          )}
        >
          <div className={cn(
            'font-medium flex items-center gap-1',
            compact ? 'text-sm' : 'text-sm',
            isToday(date) && 'text-primary'
          )}>
            <span className="font-bold">{format(date, 'd')}</span>
            <span className="text-xs text-muted-foreground">{format(date, 'MMM')}</span>
          </div>
        </div>

        {/* Events - scrollable, no limit */}
        <div className={cn('flex-1 overflow-y-auto space-y-0.5', compact ? 'px-0.5 pb-0.5' : 'px-1 pb-1')}>
          {sorted.map((event) => (
            <button
              key={event.id}
              onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
              className={cn(
                'w-full text-left rounded truncate hover:opacity-80 hover:ring-1 hover:ring-seasonal-accent/50 transition-all',
                compact ? 'text-[10px] px-0.5 py-px' : 'text-xs px-1 py-0.5'
              )}
              style={event.allDay
                ? { backgroundColor: event.color + '20', borderLeft: `2px solid ${event.color}` }
                : { color: event.color }
              }
            >
              {event.allDay ? event.title : `• ${format(event.startTime, 'h:mm')} ${event.title}`}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Portrait: 2 columns (Week 1, Week 2) x 7 rows (days of week)
  if (isPortrait) {
    return (
      <div className="h-full flex flex-col gap-1 overflow-hidden">
        {/* Header row with week numbers */}
        <div className="flex shrink-0 gap-1">
          <div className="w-10 shrink-0" /> {/* Day label spacer */}
          <div className="flex-1 text-center text-sm font-bold text-muted-foreground py-1 bg-card/50 rounded-md">
            Week {week1Num}
          </div>
          <div className="flex-1 text-center text-sm font-bold text-muted-foreground py-1 bg-card/50 rounded-md">
            Week {week2Num}
          </div>
        </div>

        {/* Day rows - each row takes equal space, scales to fit */}
        <div
          className="flex-1 grid gap-1 min-h-0"
          style={{ gridTemplateRows: 'repeat(7, 1fr)' }}
        >
          {dayNames.map((dayName, dayIndex) => (
            <div key={dayIndex} className="flex gap-1 min-h-0 h-full">
              {/* Day label */}
              <div className="w-10 shrink-0 flex items-center justify-center">
                <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                  {dayName}
                </span>
              </div>
              {/* Week 1 day */}
              <div className="flex-1 min-w-0 min-h-0">
                {renderDayCell(week1[dayIndex]!, true)}
              </div>
              {/* Week 2 day */}
              <div className="flex-1 min-w-0 min-h-0">
                {renderDayCell(week2[dayIndex]!, true)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Landscape: 7 columns x 2 rows
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1 shrink-0">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-sm font-medium text-muted-foreground py-2">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid - equal sized cells */}
      <div className="flex-1 grid grid-cols-7 grid-rows-2 gap-1">
        {days.map((date, index) => (
          <div key={index} className="min-h-0">
            {renderDayCell(date)}
          </div>
        ))}
      </div>
    </div>
  );
}
