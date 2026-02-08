'use client';

import {
  format,
  isSameDay,
} from 'date-fns';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHiddenHours } from '@/lib/hooks/useHiddenHours';
import type { CalendarEvent } from '@/types/calendar';

export interface DayViewSideBySideProps {
  currentDate: Date;
  events: CalendarEvent[];
  calendarGroups: Array<{ id: string; name: string; color: string }>;
  selectedCalendarIds?: Set<string>;
  onEventClick: (event: CalendarEvent) => void;
}

export function DayViewSideBySide({
  currentDate,
  events,
  calendarGroups,
  selectedCalendarIds,
  onEventClick,
}: DayViewSideBySideProps) {
  // Hidden hours hook
  const { settings: hiddenSettings, toggleHidden, getVisibleHours } = useHiddenHours();

  // Get visible hours (filtered if hidden mode is enabled)
  const hours = getVisibleHours();

  const dayEvents = events.filter((event) =>
    isSameDay(event.startTime, currentDate)
  );

  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timedEvents = dayEvents.filter((e) => !e.allDay);

  // If there are no calendar groups configured, show all events in a single column
  const showAllInOne = calendarGroups.length === 0;

  // Filter groups to only show selected ones (hide columns when filtered out)
  const filteredGroups = selectedCalendarIds && !selectedCalendarIds.has('all')
    ? calendarGroups.filter((g) => selectedCalendarIds.has(g.id))
    : calendarGroups;

  // For single-column mode or when no groups are selected, create a synthetic group
  const displayGroups = showAllInOne || filteredGroups.length === 0
    ? [{ id: 'all', name: 'All Events', color: '#3B82F6' }]
    : filteredGroups;

  const getEventsForGroup = (groupId: string) => {
    if (showAllInOne || groupId === 'all') {
      return timedEvents;
    }
    // Match events by their color to the group color, or by calendarName containing group name
    const group = calendarGroups.find((g) => g.id === groupId);
    if (!group) return [];
    return timedEvents.filter((e) => {
      // Primary: match by event color to group color
      if (e.color === group.color) return true;
      // Fallback: match by calendar name containing group name
      if (e.calendarName?.toLowerCase().includes(group.name.toLowerCase())) return true;
      return false;
    });
  };

  const getAllDayEventsForGroup = (groupId: string) => {
    if (showAllInOne || groupId === 'all') {
      return allDayEvents;
    }
    const group = calendarGroups.find((g) => g.id === groupId);
    if (!group) return [];
    return allDayEvents.filter((e) => {
      if (e.color === group.color) return true;
      if (e.calendarName?.toLowerCase().includes(group.name.toLowerCase())) return true;
      return false;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* All-day events row */}
      <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm rounded-t-md">
        <div className="flex">
          {/* Time column header with toggle button */}
          <div className="w-16 flex-shrink-0 flex items-center justify-center">
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
          {displayGroups.map((group) => {
            const calAllDay = getAllDayEventsForGroup(group.id);
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

      {/* Hourly schedule - scales to fit available space */}
      <div className="flex-1 flex bg-card/85 backdrop-blur-sm rounded-b-md min-h-0">
        {/* Time column */}
        <div className="w-16 flex-shrink-0 grid min-h-0" style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}>
          {hours.map((hour) => (
            <div key={hour} className="pr-2 text-right text-xs text-muted-foreground border-t border-border flex items-start pt-0.5 min-h-0">
              {format(new Date().setHours(hour, 0), 'h a')}
            </div>
          ))}
        </div>
        {/* Group columns */}
        {displayGroups.map((group) => {
          const calEvents = getEventsForGroup(group.id);

          // Sort by start time, then longest duration first
          const sortEvents = (hourEvents: CalendarEvent[]) => [...hourEvents].sort((a, b) => {
            const timeDiff = a.startTime.getTime() - b.startTime.getTime();
            if (timeDiff !== 0) return timeDiff;
            const aDur = (a.endTime?.getTime() ?? a.startTime.getTime()) - a.startTime.getTime();
            const bDur = (b.endTime?.getTime() ?? b.startTime.getTime()) - b.startTime.getTime();
            return bDur - aDur;
          });

          // Detect overlaps: if event B starts before event A ends
          const getOverlapIndex = (event: CalendarEvent, idx: number, sorted: CalendarEvent[]) => {
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
              className="flex-1 min-w-0 border-l border-border grid min-h-0"
              style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}
            >
              {hours.map((hour) => {
                const hourEvents = calEvents.filter((event) => event.startTime.getHours() === hour);
                const sorted = sortEvents(hourEvents);

                return (
                  <div key={hour} className="border-t border-border relative min-h-0">
                    {sorted.map((event, idx) => {
                      const overlapIdx = getOverlapIndex(event, idx, sorted);
                      return (
                        <button
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className="absolute p-0.5 rounded text-left text-xs z-10 hover:opacity-80 hover:ring-2 hover:ring-seasonal-accent/50 transition-all"
                          style={{
                            backgroundColor: event.color + '20',
                            borderLeft: `2px solid ${event.color}`,
                            top: `${(event.startTime.getMinutes() / 60) * 100}%`,
                            left: overlapIdx > 0 ? '50%' : '2px',
                            width: overlapIdx > 0 ? 'calc(50% - 4px)' : 'calc(100% - 4px)',
                          }}
                        >
                          <div className="font-medium truncate text-[11px]">{event.title}</div>
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
