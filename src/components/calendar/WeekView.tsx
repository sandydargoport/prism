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
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useHiddenHours } from '@/lib/hooks/useHiddenHours';
import type { CalendarEvent } from '@/types/calendar';

export interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

// Calculate horizontal position for overlapping events (cycles: 0, 50%, 0, 50%, ...)
function getEventPosition(index: number): { left: string; width: string } {
  const position = index % 2;
  if (position === 0) {
    return { left: '2px', width: 'calc(100% - 4px)' };
  }
  return { left: '50%', width: 'calc(50% - 4px)' };
}

export function WeekView({
  currentDate,
  events,
  onEventClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const orientation = useOrientation();
  const isPortrait = orientation === 'portrait';

  // Hidden hours hook
  const { settings: hiddenSettings, toggleHidden, getVisibleHours } = useHiddenHours();

  // Get visible hours (filtered if hidden mode is enabled)
  const hours = getVisibleHours();

  // Get all-day events for a day
  const getAllDayEvents = (date: Date) =>
    events.filter((e) => isSameDay(e.startTime, date) && e.allDay);

  // Get timed events for a specific day and hour
  const getHourEvents = (date: Date, hour: number) =>
    events.filter(
      (e) =>
        isSameDay(e.startTime, date) &&
        !e.allDay &&
        e.startTime.getHours() === hour
    );

  // For portrait, split into two rows
  const row1Days = days.slice(0, 4); // Sun-Wed
  const nextSunday = addDays(weekStart, 7);
  const row2Days = [...days.slice(4, 7), nextSunday]; // Thu-Sat + next Sun

  const renderDayColumn = (date: Date, compact: boolean = false) => {
    const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);
    const allDayEvents = getAllDayEvents(date);

    return (
      <div key={date.toISOString()} className="flex flex-col min-w-0 flex-1">
        {/* Day header */}
        <div
          className={cn(
            'text-center py-1 shrink-0 rounded-t-md',
            isPast && 'bg-gray-200 text-gray-600 dark:bg-muted/40 dark:text-muted-foreground',
            isToday(date) && 'bg-primary text-primary-foreground'
          )}
        >
          <div className={cn('font-bold uppercase tracking-wide', compact ? 'text-xs' : 'text-sm')}>
            {format(date, 'EEE')}
          </div>
          <div className={cn('font-bold', compact ? 'text-lg' : 'text-xl')}>
            {format(date, 'd')}
          </div>
        </div>

        {/* All-day events - scrollable */}
        {allDayEvents.length > 0 && (
          <div className={cn('shrink-0 border-b border-border p-0.5 bg-card/50 max-h-16 overflow-y-auto', isPast && 'bg-gray-100 dark:bg-muted/30')}>
            {allDayEvents.map((event, idx) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className="w-full text-left text-xs px-1 py-px rounded truncate hover:opacity-80 transition-all"
                style={{ backgroundColor: event.color + '20', borderLeft: `2px solid ${event.color}` }}
              >
                {event.title}
              </button>
            ))}
          </div>
        )}

        {/* Hourly grid - scales to fit available space */}
        <div
          className={cn('flex-1 grid min-h-0', isPast && 'bg-gray-100 dark:bg-muted/20')}
          style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}
        >
          {hours.map((hour) => {
            const hourEvents = getHourEvents(date, hour);
            return (
              <div key={hour} className="border-t border-border/50 relative min-h-0">
                {hourEvents.map((event, idx) => {
                  const pos = getEventPosition(idx);
                  return (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      className="absolute text-left text-xs px-0.5 rounded truncate hover:opacity-80 hover:ring-1 hover:ring-seasonal-accent/50 transition-all z-10"
                      style={{
                        backgroundColor: event.color + '20',
                        borderLeft: `2px solid ${event.color}`,
                        top: `${(event.startTime.getMinutes() / 60) * 100}%`,
                        left: pos.left,
                        width: pos.width,
                      }}
                    >
                      <span className="text-[10px] text-muted-foreground mr-1">
                        {format(event.startTime, 'h:mm')}
                      </span>
                      {event.title}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Portrait: 2 rows of 4 days each (compact) - grid ensures equal split
  if (isPortrait) {
    return (
      <div className="h-full grid grid-rows-2 gap-1 overflow-hidden">
        <div className="flex gap-px bg-card/85 backdrop-blur-sm rounded-md overflow-hidden min-h-0">
          {/* Time column */}
          <div className="w-8 shrink-0 flex flex-col min-h-0">
            {/* Header with toggle button */}
            <div className="h-12 shrink-0 flex items-center justify-center">
              <button
                onClick={toggleHidden}
                className={cn(
                  'p-1 rounded-full transition-colors',
                  hiddenSettings.enabled
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                )}
                title={hiddenSettings.enabled ? 'Show all hours' : 'Hide time block'}
              >
                <Clock className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 grid min-h-0" style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="text-[9px] text-muted-foreground text-right pr-0.5 border-t border-transparent flex items-start min-h-0"
                >
                  {format(new Date().setHours(hour, 0), 'ha')}
                </div>
              ))}
            </div>
          </div>
          {row1Days.map((date) => renderDayColumn(date, true))}
        </div>
        <div className="flex gap-px bg-card/85 backdrop-blur-sm rounded-md overflow-hidden min-h-0">
          {/* Time column */}
          <div className="w-8 shrink-0 flex flex-col min-h-0">
            <div className="h-12 shrink-0" /> {/* Header spacer */}
            <div className="flex-1 grid min-h-0" style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="text-[9px] text-muted-foreground text-right pr-0.5 border-t border-transparent flex items-start min-h-0"
                >
                  {format(new Date().setHours(hour, 0), 'ha')}
                </div>
              ))}
            </div>
          </div>
          {row2Days.map((date) => renderDayColumn(date, true))}
        </div>
      </div>
    );
  }

  // Landscape: 7-column hourly grid
  return (
    <div className="h-full flex flex-col bg-card/85 backdrop-blur-sm rounded-md overflow-hidden">
      {/* Day headers row */}
      <div className="flex shrink-0">
        {/* Time column spacer with toggle button */}
        <div className="w-14 shrink-0 flex items-center justify-center">
          <button
            onClick={toggleHidden}
            className={cn(
              'p-1.5 rounded-full transition-colors',
              hiddenSettings.enabled
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground'
            )}
            title={hiddenSettings.enabled ? 'Show all hours' : 'Hide time block'}
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>
        {days.map((date) => {
          const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);
          const allDayEvents = getAllDayEvents(date);
          return (
            <div key={date.toISOString()} className="flex-1 min-w-0 border-l border-border">
              <div
                className={cn(
                  'text-center py-2',
                  isPast && 'bg-gray-200 text-gray-600 dark:bg-muted/40 dark:text-muted-foreground',
                  isToday(date) && 'bg-primary text-primary-foreground'
                )}
              >
                <div className="text-sm font-bold uppercase">{format(date, 'EEE')}</div>
                <div className="text-2xl font-bold">{format(date, 'd')}</div>
              </div>
              {/* All-day events - scrollable */}
              {allDayEvents.length > 0 && (
                <div className="px-1 py-0.5 border-b border-border bg-card/50 max-h-20 overflow-y-auto">
                  {allDayEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      className="w-full text-left text-xs px-1 py-px rounded truncate hover:opacity-80 transition-all"
                      style={{ backgroundColor: event.color + '20', borderLeft: `2px solid ${event.color}` }}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hourly schedule - scales to fit available space */}
      <div className="flex-1 flex min-h-0">
        {/* Time column */}
        <div className="w-14 shrink-0 grid min-h-0" style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}>
          {hours.map((hour) => (
            <div key={hour} className="pr-1 text-right text-xs text-muted-foreground border-t border-border flex items-start pt-0.5 min-h-0">
              {format(new Date().setHours(hour, 0), 'h a')}
            </div>
          ))}
        </div>
        {/* Day columns */}
        {days.map((date) => {
          const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);
          return (
            <div
              key={date.toISOString()}
              className={cn('flex-1 min-w-0 border-l border-border grid min-h-0', isPast && 'bg-gray-50 dark:bg-muted/10')}
              style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}
            >
              {hours.map((hour) => {
                const hourEvents = getHourEvents(date, hour);
                return (
                  <div key={hour} className="border-t border-border relative min-h-0">
                    {hourEvents.map((event, idx) => {
                      const pos = getEventPosition(idx);
                      return (
                        <button
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className="absolute p-0.5 rounded text-left text-xs z-10 hover:opacity-80 hover:ring-2 hover:ring-seasonal-accent/50 transition-all"
                          style={{
                            backgroundColor: event.color + '20',
                            borderLeft: `2px solid ${event.color}`,
                            top: `${(event.startTime.getMinutes() / 60) * 100}%`,
                            left: pos.left,
                            width: pos.width,
                          }}
                        >
                          <div className="font-medium truncate text-[10px]">{event.title}</div>
                        </button>
                      );
                    })}
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
