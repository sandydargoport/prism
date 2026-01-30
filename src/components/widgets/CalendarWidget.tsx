/**
 * ============================================================================
 * PRISM - Calendar Widget
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Displays upcoming calendar events from all family members.
 * This is the primary feature of Prism - seeing everyone's schedule at a glance.
 *
 * FEATURES:
 * - Today's events list
 * - Color-coded by calendar/person
 * - Time display for timed events
 * - "All day" events shown at top
 * - Multi-day events supported
 *
 * VIEWS:
 * - Compact: Just today's events (for widget)
 * - Expanded: Full calendar view (separate page)
 *
 * USAGE:
 *   <CalendarWidget />
 *   <CalendarWidget daysToShow={7} />
 *   <CalendarWidget showAllCalendars={false} selectedCalendarIds={['alex']} />
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  format,
  isToday,
  isTomorrow,
  isSameDay,
  addDays,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import {
  ScrollArea,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';


/**
 * CALENDAR EVENT TYPE
 * ============================================================================
 * Represents a single calendar event.
 * Imported from shared types for consistency across the application.
 * ============================================================================
 */
import type { CalendarEvent } from '@/types/calendar';
export type { CalendarEvent }; // Re-export for backwards compatibility


/**
 * CALENDAR VIEW OPTIONS
 * ============================================================================
 * The available view options for the calendar widget.
 * ============================================================================
 */
export type CalendarView = '3days' | '1week' | '2weeks' | 'month';

const VIEW_OPTIONS: { value: CalendarView; label: string; days: number }[] = [
  { value: '3days', label: '3 Days', days: 3 },
  { value: '1week', label: '1 Week', days: 7 },
  { value: '2weeks', label: '2 Weeks', days: 14 },
  { value: 'month', label: 'Month', days: 30 },
];


/**
 * CALENDAR WIDGET PROPS
 * ============================================================================
 */
export interface CalendarWidgetProps {
  /** Events to display (if provided externally) */
  events?: CalendarEvent[];
  /** Initial number of days to show events for (can be changed via selector) */
  daysToShow?: number;
  /** Initial view selection */
  initialView?: CalendarView;
  /** Whether to show the view selector */
  showViewSelector?: boolean;
  /** Maximum events per day to display */
  maxEventsPerDay?: number;
  /** Show events from all calendars */
  showAllCalendars?: boolean;
  /** Specific calendar IDs to show */
  selectedCalendarIds?: string[];
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Callback when event is clicked */
  onEventClick?: (event: CalendarEvent) => void;
  /** URL for the full calendar page (makes title clickable) */
  titleHref?: string;
  /** Additional CSS classes */
  className?: string;
}


/**
 * CALENDAR WIDGET COMPONENT
 * ============================================================================
 * Displays upcoming calendar events grouped by day.
 *
 * @example Basic usage
 * <CalendarWidget />
 *
 * @example Show more days
 * <CalendarWidget daysToShow={7} />
 *
 * @example With click handlers
 * <CalendarWidget
 *   onEventClick={(event) => showEventDetails(event)}
 *   onViewAllClick={() => router.push('/calendar')}
 * />
 * ============================================================================
 */
export function CalendarWidget({
  events: externalEvents,
  daysToShow: initialDaysToShow = 3,
  initialView,
  showViewSelector = true,
  maxEventsPerDay = 5,
  showAllCalendars = true,
  selectedCalendarIds,
  loading = false,
  error = null,
  onEventClick,
  titleHref,
  className,
}: CalendarWidgetProps) {
  // Determine initial view from props
  const getInitialView = (): CalendarView => {
    if (initialView) return initialView;
    const match = VIEW_OPTIONS.find(v => v.days === initialDaysToShow);
    return match?.value || '3days';
  };

  // View state
  const [currentView, setCurrentView] = useState<CalendarView>(getInitialView());

  // Get days to show based on current view
  const daysToShow = VIEW_OPTIONS.find(v => v.value === currentView)?.days || 3;

  // Use provided events or demo data
  const allEvents = externalEvents || getDemoEvents();

  // Filter events by calendar if specified
  let filteredEvents = allEvents;
  if (!showAllCalendars && selectedCalendarIds) {
    filteredEvents = allEvents.filter((event) =>
      selectedCalendarIds.includes(event.calendarId)
    );
  }

  // Get date range
  // For 2-week view, start from the beginning of the current week (Sunday)
  // For other views, start from today
  const today = startOfDay(new Date());
  const startDate = currentView === '2weeks'
    ? startOfWeek(today, { weekStartsOn: 0 }) // Start on Sunday
    : today;
  const endDate = addDays(startDate, daysToShow);

  // Filter to date range and sort
  filteredEvents = filteredEvents
    .filter((event) => {
      const eventDate = startOfDay(event.startTime);
      return eventDate >= startDate && eventDate < endDate;
    })
    .sort((a, b) => {
      // Sort by date, then by all-day (all-day first), then by time
      const dateCompare = startOfDay(a.startTime).getTime() - startOfDay(b.startTime).getTime();
      if (dateCompare !== 0) return dateCompare;
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.startTime.getTime() - b.startTime.getTime();
    });

  // Group events by day
  const eventsByDay = groupEventsByDay(filteredEvents, daysToShow, startDate);

  return (
    <WidgetContainer
      title="Calendar"
      titleHref={titleHref}
      icon={<Calendar className="h-4 w-4" />}
      size="large"
      loading={loading}
      error={error}
      actions={
        showViewSelector && (
          <Select value={currentView} onValueChange={(v) => setCurrentView(v as CalendarView)}>
            <SelectTrigger className="h-7 w-[90px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEW_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
      className={className}
    >
      {filteredEvents.length === 0 ? (
        <WidgetEmpty
          icon={<Calendar className="h-8 w-8" />}
          message="No upcoming events"
        />
      ) : (
        <ScrollArea className="h-full -mr-2 pr-2">
          <div className="space-y-4">
            {eventsByDay.map(({ date, events }) => (
              <DaySection
                key={date.toISOString()}
                date={date}
                events={events}
                maxEvents={maxEventsPerDay}
                onEventClick={onEventClick}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </WidgetContainer>
  );
}


/**
 * DAY SECTION
 * ============================================================================
 * Shows events for a single day with a date header.
 * ============================================================================
 */
function DaySection({
  date,
  events,
  maxEvents,
  onEventClick,
}: {
  date: Date;
  events: CalendarEvent[];
  maxEvents: number;
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const displayEvents = events.slice(0, maxEvents);
  const remainingCount = events.length - maxEvents;

  return (
    <div>
      {/* Day header */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'text-sm font-semibold',
            isToday(date) && 'text-primary'
          )}
        >
          {formatDayHeader(date)}
        </span>
        {isToday(date) && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            Today
          </Badge>
        )}
      </div>

      {/* Events list */}
      <div className="space-y-1.5 pl-2 border-l-2 border-border">
        {displayEvents.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            onClick={() => onEventClick?.(event)}
          />
        ))}

        {/* Show remaining count */}
        {remainingCount > 0 && (
          <div className="text-xs text-muted-foreground pl-2">
            +{remainingCount} more events
          </div>
        )}
      </div>
    </div>
  );
}


/**
 * EVENT ROW
 * ============================================================================
 * A single event item showing time, title, and color indicator.
 * ============================================================================
 */
function EventRow({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-start gap-2 p-1.5 rounded',
        'hover:bg-accent/50 transition-colors',
        'touch-action-manipulation'
      )}
    >
      {/* Color indicator */}
      <div
        className="w-1 h-full min-h-[24px] rounded-full flex-shrink-0"
        style={{ backgroundColor: event.color }}
      />

      <div className="flex-1 min-w-0">
        {/* Time */}
        <div className="text-xs text-muted-foreground">
          {event.allDay ? (
            'All day'
          ) : (
            format(event.startTime, 'h:mm a')
          )}
        </div>

        {/* Title */}
        <div className="text-sm font-medium truncate">
          {event.title}
        </div>

        {/* Location (if present) */}
        {event.location && (
          <div className="text-xs text-muted-foreground truncate">
            {event.location}
          </div>
        )}
      </div>
    </button>
  );
}


/**
 * FORMAT DAY HEADER
 * ============================================================================
 * Formats a date for the day section header.
 * ============================================================================
 */
function formatDayHeader(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEEE, MMM d'); // e.g., "Wednesday, Jan 22"
}


/**
 * GROUP EVENTS BY DAY
 * ============================================================================
 * Groups events into arrays by day.
 * ============================================================================
 */
function groupEventsByDay(
  events: CalendarEvent[],
  daysToShow: number,
  startDate: Date = startOfDay(new Date())
): Array<{ date: Date; events: CalendarEvent[] }> {
  const result: Array<{ date: Date; events: CalendarEvent[] }> = [];

  for (let i = 0; i < daysToShow; i++) {
    const date = addDays(startDate, i);
    const dayEvents = events.filter((event) =>
      isSameDay(event.startTime, date)
    );

    if (dayEvents.length > 0) {
      result.push({ date, events: dayEvents });
    }
  }

  return result;
}


/**
 * GET DEMO EVENTS
 * ============================================================================
 * Returns demo calendar events for development/testing.
 * ============================================================================
 */
function getDemoEvents(): CalendarEvent[] {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  // Create specific times for today
  const today9am = new Date(today);
  today9am.setHours(9, 0, 0, 0);

  const today10am = new Date(today);
  today10am.setHours(10, 0, 0, 0);

  const today2pm = new Date(today);
  today2pm.setHours(14, 0, 0, 0);

  const today4pm = new Date(today);
  today4pm.setHours(16, 0, 0, 0);

  const tomorrow9am = new Date(tomorrow);
  tomorrow9am.setHours(9, 0, 0, 0);

  const tomorrow3pm = new Date(tomorrow);
  tomorrow3pm.setHours(15, 0, 0, 0);

  return [
    {
      id: '1',
      title: 'Team Standup',
      startTime: today9am,
      endTime: new Date(today9am.getTime() + 30 * 60000),
      allDay: false,
      color: '#3B82F6',
      calendarName: "Alex's Calendar",
      calendarId: 'alex',
    },
    {
      id: '2',
      title: 'Dentist Appointment',
      location: 'Dr. Smith\'s Office',
      startTime: today10am,
      endTime: new Date(today10am.getTime() + 60 * 60000),
      allDay: false,
      color: '#EC4899',
      calendarName: "Jordan's Calendar",
      calendarId: 'jordan',
    },
    {
      id: '3',
      title: 'Soccer Practice',
      location: 'Community Park',
      startTime: today4pm,
      endTime: new Date(today4pm.getTime() + 90 * 60000),
      allDay: false,
      color: '#10B981',
      calendarName: "Emma's Calendar",
      calendarId: 'emma',
    },
    {
      id: '4',
      title: "Grandma's Birthday",
      startTime: tomorrow,
      endTime: tomorrow,
      allDay: true,
      color: '#F59E0B', // Family calendar color
      calendarName: 'Family Calendar',
      calendarId: 'family',
    },
    {
      id: '5',
      title: 'Piano Lesson',
      startTime: tomorrow3pm,
      endTime: new Date(tomorrow3pm.getTime() + 45 * 60000),
      allDay: false,
      color: '#F59E0B',
      calendarName: "Sophie's Calendar",
      calendarId: 'sophie',
    },
    {
      id: '6',
      title: 'School Assembly',
      location: 'School Auditorium',
      startTime: dayAfter,
      endTime: dayAfter,
      allDay: true,
      color: '#10B981',
      calendarName: "Emma's Calendar",
      calendarId: 'emma',
    },
  ];
}
