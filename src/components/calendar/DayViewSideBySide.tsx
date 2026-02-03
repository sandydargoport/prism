'use client';

import {
  format,
  isSameDay,
} from 'date-fns';
import type { CalendarEvent } from '@/types/calendar';

export interface DayViewSideBySideProps {
  currentDate: Date;
  events: CalendarEvent[];
  calendarGroups: Array<{ id: string; name: string; color: string }>;
  onEventClick: (event: CalendarEvent) => void;
}

export function DayViewSideBySide({
  currentDate,
  events,
  calendarGroups,
  onEventClick,
}: DayViewSideBySideProps) {
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  const dayEvents = events.filter((event) =>
    isSameDay(event.startTime, currentDate)
  );

  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timedEvents = dayEvents.filter((e) => !e.allDay);

  const getEventsForCalendar = (calendarId: string) => {
    if (calendarId === 'FAMILY') {
      return timedEvents.filter(
        (e) => e.calendarName?.toLowerCase().includes('family')
      );
    }
    return timedEvents.filter((e) => {
      const group = calendarGroups.find((g) => g.id === calendarId);
      if (!group) return false;
      return e.calendarName?.toLowerCase().includes(group.name.toLowerCase());
    });
  };

  const getAllDayEventsForCalendar = (calendarId: string) => {
    if (calendarId === 'FAMILY') {
      return allDayEvents.filter(
        (e) => e.calendarName?.toLowerCase().includes('family')
      );
    }
    const group = calendarGroups.find((g) => g.id === calendarId);
    if (!group) return [];
    return allDayEvents.filter(
      (e) => e.calendarName?.toLowerCase().includes(group.name.toLowerCase())
    );
  };

  if (calendarGroups.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>No calendars configured. Add calendar sources in settings.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* All-day events row */}
      <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm rounded-t-md">
        <div className="flex">
          <div className="w-16 flex-shrink-0" />
          {calendarGroups.map((group) => {
            const calAllDay = getAllDayEventsForCalendar(group.id);
            return (
              <div
                key={group.id}
                className="flex-1 min-w-0 border-l border-border p-1"
              >
                <div
                  className="text-sm font-medium text-center py-1 mb-1 rounded"
                  style={{ backgroundColor: group.color + '20', color: group.color }}
                >
                  {group.name}
                </div>
                {calAllDay.length > 0 && (
                  <div className="space-y-0.5">
                    {calAllDay.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className="w-full text-left text-xs px-1 py-0.5 rounded truncate hover:opacity-80 hover:ring-2 hover:ring-seasonal-accent/50 transition-all"
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
      </div>

      {/* Hourly schedule */}
      <div className="flex-1 overflow-y-auto bg-card/85 backdrop-blur-sm rounded-b-md">
        {hours.map((hour) => (
          <div key={hour} className="flex border-t border-border min-h-[60px]">
            <div className="w-16 flex-shrink-0 pr-2 text-right text-xs text-muted-foreground pt-1">
              {format(new Date().setHours(hour, 0), 'h a')}
            </div>
            {calendarGroups.map((group) => {
              const calEvents = getEventsForCalendar(group.id);
              const hourEvents = calEvents.filter(
                (event) => event.startTime.getHours() === hour
              );

              // Sort by start time, then longest duration first
              const sorted = [...hourEvents].sort((a, b) => {
                const timeDiff = a.startTime.getTime() - b.startTime.getTime();
                if (timeDiff !== 0) return timeDiff;
                const aDur = (a.endTime?.getTime() ?? a.startTime.getTime()) - a.startTime.getTime();
                const bDur = (b.endTime?.getTime() ?? b.startTime.getTime()) - b.startTime.getTime();
                return bDur - aDur;
              });

              // Detect overlaps: if event B starts before event A ends
              const getOverlapIndex = (event: CalendarEvent, idx: number) => {
                for (let i = 0; i < idx; i++) {
                  const prev = sorted[i]!;
                  const prevEnd = prev.endTime ?? new Date(prev.startTime.getTime() + 3600000);
                  if (event.startTime < prevEnd) return 1; // overlapping
                }
                return 0;
              };

              return (
                <div
                  key={group.id}
                  className="flex-1 min-w-0 border-l border-border relative"
                >
                  {sorted.map((event, idx) => {
                    const overlapIdx = getOverlapIndex(event, idx);
                    return (
                      <button
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className="absolute p-1 rounded text-left text-xs z-10 hover:opacity-80 hover:ring-2 hover:ring-seasonal-accent/50 transition-all"
                        style={{
                          backgroundColor: event.color + '20',
                          borderLeft: `2px solid ${event.color}`,
                          top: `${(event.startTime.getMinutes() / 60) * 100}%`,
                          left: overlapIdx > 0 ? '50%' : '2px',
                          width: overlapIdx > 0 ? 'calc(50% - 4px)' : 'calc(100% - 4px)',
                        }}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="text-muted-foreground">
                          {format(event.startTime, 'h:mm a')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
