/**
 * ============================================================================
 * PRISM - Calendar View Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * The main interactive calendar component with multiple view options.
 * This is a client component that handles:
 * - View switching (day/week/month)
 * - Date navigation
 * - Event display and interaction
 * - Calendar filtering
 *
 * ARCHITECTURE:
 * The calendar is built with these sub-components:
 * - CalendarHeader: Navigation and view controls
 * - CalendarGrid: The main calendar display
 * - EventModal: Event details/edit dialog
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCalendarEvents, useCalendarSources } from '@/lib/hooks';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  subMonths,
  subWeeks,
  subDays,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  Plus,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { CalendarEvent } from '@/types/calendar';
import { AddEventModal } from '@/components/modals';
import { PageWrapper } from '@/components/layout';


/**
 * VIEW TYPE
 */
type CalendarViewType = 'day' | 'week' | 'twoWeek' | 'month';


/**
 * DEMO EVENT DATA
 * ============================================================================
 * Sample events for demonstration. In production, these would come from
 * the /api/events endpoint.
 * ============================================================================
 */
function getDemoEvents(): CalendarEvent[] {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);

  return [
    {
      id: '1',
      title: 'Team Standup',
      startTime: new Date(today.setHours(9, 0)),
      endTime: new Date(today.setHours(9, 30)),
      allDay: false,
      color: '#3B82F6',
      calendarName: "Alex's Calendar",
      calendarId: 'alex',
    },
    {
      id: '2',
      title: 'Dentist Appointment',
      startTime: new Date(today.setHours(14, 0)),
      endTime: new Date(today.setHours(15, 0)),
      allDay: false,
      color: '#EC4899',
      location: "Dr. Smith's Office",
      calendarName: "Jordan's Calendar",
      calendarId: 'jordan',
    },
    {
      id: '3',
      title: 'Soccer Practice',
      startTime: new Date(today.setHours(16, 0)),
      endTime: new Date(today.setHours(17, 30)),
      allDay: false,
      color: '#10B981',
      location: 'Community Park',
      calendarName: "Emma's Calendar",
      calendarId: 'emma',
    },
    {
      id: '4',
      title: "Grandma's Birthday",
      startTime: tomorrow,
      endTime: tomorrow,
      allDay: true,
      color: '#F59E0B',
      calendarName: 'Family Calendar',
      calendarId: 'family',
    },
    {
      id: '5',
      title: 'Piano Lesson',
      startTime: new Date(tomorrow.setHours(15, 0)),
      endTime: new Date(tomorrow.setHours(15, 45)),
      allDay: false,
      color: '#F59E0B',
      calendarName: "Sophie's Calendar",
      calendarId: 'sophie',
    },
    {
      id: '6',
      title: 'School Assembly',
      startTime: nextWeek,
      endTime: nextWeek,
      allDay: true,
      color: '#10B981',
      location: 'School Auditorium',
      calendarName: "Emma's Calendar",
      calendarId: 'emma',
    },
  ];
}


/**
 * CALENDAR VIEW COMPONENT
 * ============================================================================
 */
export function CalendarView() {
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Calendar filter state - which calendars to show
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set(['all']));

  // Fetch calendar sources for filtering
  const { calendars: calendarSources } = useCalendarSources();

  // Filter to only enabled calendars that are assigned or family
  const filterableCalendars = calendarSources.filter(
    (cal) => cal.enabled && (cal.user || (cal as { isFamily?: boolean }).isFamily)
  );

  // Get unique calendar groups (Family + users)
  const calendarGroups = React.useMemo(() => {
    const groups: Array<{ id: string; name: string; color: string }> = [];

    // Add Family if any family calendars exist
    const hasFamilyCalendar = filterableCalendars.some(
      (cal) => (cal as { isFamily?: boolean }).isFamily
    );
    if (hasFamilyCalendar) {
      groups.push({ id: 'FAMILY', name: 'Family', color: '#F59E0B' });
    }

    // Add each unique user
    const seenUsers = new Set<string>();
    for (const cal of filterableCalendars) {
      if (cal.user && cal.user.id !== 'FAMILY' && !seenUsers.has(cal.user.id)) {
        seenUsers.add(cal.user.id);
        groups.push({
          id: cal.user.id,
          name: cal.user.name,
          color: cal.user.color,
        });
      }
    }

    return groups;
  }, [filterableCalendars]);

  // Toggle calendar selection
  const toggleCalendar = (id: string) => {
    setSelectedCalendarIds((prev) => {
      const newSet = new Set(prev);
      if (id === 'all') {
        // Toggle "All" - either select all or deselect all
        if (newSet.has('all')) {
          return new Set();
        } else {
          const all = new Set(['all']);
          calendarGroups.forEach((g) => all.add(g.id));
          return all;
        }
      } else {
        // Toggle individual calendar
        newSet.delete('all');
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        // If all are selected, add 'all' back
        if (newSet.size === calendarGroups.length) {
          newSet.add('all');
        }
        return newSet;
      }
    });
  };

  // Initialize selected calendars to 'all' when calendar groups load
  useEffect(() => {
    if (calendarGroups.length > 0 && selectedCalendarIds.size === 1 && selectedCalendarIds.has('all')) {
      const all = new Set(['all']);
      calendarGroups.forEach((g) => all.add(g.id));
      setSelectedCalendarIds(all);
    }
  }, [calendarGroups]);

  // Fetch events from API (60 days to cover full month views)
  const { events: apiEvents, loading, error, refresh: refreshEvents } = useCalendarEvents({ daysToShow: 60 });

  // Transform and filter API events
  const events: CalendarEvent[] = React.useMemo(() => {
    return apiEvents
      .map((event) => ({
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
        color: event.color,
        location: event.location,
        calendarName: event.calendarName,
        calendarId: event.calendarId,
      }))
      .filter((event) => {
        // If "all" is selected, show everything
        if (selectedCalendarIds.has('all')) return true;
        // If no filters selected, show nothing
        if (selectedCalendarIds.size === 0) return false;

        // Find the calendar source for this event
        const calSource = filterableCalendars.find((c) => c.id === event.calendarId);
        if (!calSource) return false;

        // Check if this calendar's user/family is selected
        if ((calSource as { isFamily?: boolean }).isFamily && selectedCalendarIds.has('FAMILY')) {
          return true;
        }
        if (calSource.user && selectedCalendarIds.has(calSource.user.id)) {
          return true;
        }

        return false;
      });
  }, [apiEvents, selectedCalendarIds, filterableCalendars]);

  // Navigation handlers
  const goToToday = () => setCurrentDate(new Date());

  const goToPrevious = () => {
    switch (viewType) {
      case 'day':
        setCurrentDate(subDays(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case 'twoWeek':
        setCurrentDate(subWeeks(currentDate, 2));
        break;
      case 'month':
        setCurrentDate(subMonths(currentDate, 1));
        break;
    }
  };

  const goToNext = () => {
    switch (viewType) {
      case 'day':
        setCurrentDate(addDays(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'twoWeek':
        setCurrentDate(addWeeks(currentDate, 2));
        break;
      case 'month':
        setCurrentDate(addMonths(currentDate, 1));
        break;
    }
  };

  // Get the date range title
  const getDateRangeTitle = (): string => {
    switch (viewType) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'twoWeek':
        const twoWeekStart = startOfWeek(currentDate);
        const twoWeekEnd = endOfWeek(addWeeks(currentDate, 1));
        return `${format(twoWeekStart, 'MMM d')} - ${format(twoWeekEnd, 'MMM d, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
    }
  };

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* ================================================================ */}
        {/* HEADER */}
        {/* ================================================================ */}
        <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          {/* Left: Back button and title */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="Back to dashboard">
                <Home className="h-5 w-5" />
              </Link>
            </Button>

            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">{getDateRangeTitle()}</h1>
            </div>
          </div>

          {/* Right: View controls */}
          <div className="flex items-center gap-2">
            {/* Today button */}
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
            >
              Today
            </Button>

            {/* Navigation */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevious}
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNext}
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* View switcher */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewType === 'day' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewType('day')}
                className="rounded-r-none"
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                Day
              </Button>
              <Button
                variant={viewType === 'week' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewType('week')}
                className="rounded-none border-x"
              >
                <CalendarRange className="h-4 w-4 mr-1" />
                Week
              </Button>
              <Button
                variant={viewType === 'twoWeek' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewType('twoWeek')}
                className="rounded-none border-r"
              >
                <CalendarRange className="h-4 w-4 mr-1" />
                2 Weeks
              </Button>
              <Button
                variant={viewType === 'month' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewType('month')}
                className="rounded-l-none"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Month
              </Button>
            </div>

            {/* Add event button */}
            <Button size="sm" onClick={() => setShowAddEvent(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Event
            </Button>
          </div>
        </div>

        {/* Calendar filter chips */}
        {calendarGroups.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Show:</span>
            {/* All button */}
            <button
              onClick={() => toggleCalendar('all')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                selectedCalendarIds.has('all')
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              All
            </button>
            {/* Individual calendar buttons */}
            {calendarGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => toggleCalendar(group.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5',
                  selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all')
                    ? 'text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                )}
                style={
                  selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all')
                    ? { backgroundColor: group.color }
                    : undefined
                }
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                {group.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ================================================================== */}
      {/* CALENDAR CONTENT */}
      {/* ================================================================== */}
      <div className="flex-1 overflow-hidden p-4">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="h-full flex items-center justify-center">
            <p className="text-destructive">Failed to load calendar: {error}</p>
          </div>
        )}

        {!loading && !error && viewType === 'month' && (
          <MonthView
            currentDate={currentDate}
            events={events}
            onEventClick={setSelectedEvent}
            onDateClick={(date) => {
              setCurrentDate(date);
              setViewType('day');
            }}
          />
        )}

        {!loading && !error && viewType === 'week' && (
          <WeekView
            currentDate={currentDate}
            events={events}
            onEventClick={setSelectedEvent}
          />
        )}

        {!loading && !error && viewType === 'twoWeek' && (
          <TwoWeekView
            currentDate={currentDate}
            events={events}
            onEventClick={setSelectedEvent}
          />
        )}

        {!loading && !error && viewType === 'day' && (
          <DayViewSideBySide
            currentDate={currentDate}
            events={events}
            calendarGroups={calendarGroups}
            onEventClick={setSelectedEvent}
          />
        )}
      </div>

      {/* Event detail modal would go here */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full h-2 rounded-t-lg -mt-6 -mx-6 mb-4"
              style={{ backgroundColor: selectedEvent.color }}
            />
            <h2 className="text-xl font-bold mb-2">{selectedEvent.title}</h2>
            <p className="text-sm text-muted-foreground mb-1">
              {selectedEvent.allDay
                ? format(selectedEvent.startTime, 'EEEE, MMMM d')
                : `${format(selectedEvent.startTime, 'EEEE, MMMM d')} at ${format(selectedEvent.startTime, 'h:mm a')}`
              }
            </p>
            {selectedEvent.location && (
              <p className="text-sm text-muted-foreground mb-4">
                📍 {selectedEvent.location}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {selectedEvent.calendarName}
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
              <Button onClick={() => {
                setEditingEvent(selectedEvent);
                setSelectedEvent(null);
              }}>
                Edit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Event Modal */}
      <AddEventModal
        open={showAddEvent || editingEvent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddEvent(false);
            setEditingEvent(null);
          }
        }}
        event={editingEvent ? {
          id: editingEvent.id,
          title: editingEvent.title,
          description: editingEvent.description,
          location: editingEvent.location,
          startTime: editingEvent.startTime,
          endTime: editingEvent.endTime,
          allDay: editingEvent.allDay,
          color: editingEvent.color,
          recurring: false,
          recurrenceRule: undefined,
          reminderMinutes: undefined,
        } : undefined}
        onEventCreated={() => {
          refreshEvents();
          setShowAddEvent(false);
          setEditingEvent(null);
        }}
      />
      </div>
    </PageWrapper>
  );
}


/**
 * MONTH VIEW COMPONENT
 * ============================================================================
 */
function MonthView({
  currentDate,
  events,
  onEventClick,
  onDateClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  // Generate all days in the calendar view
  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  // Day names
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-full flex flex-col">
      {/* Day headers */}
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

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 gap-1 auto-rows-fr">
        {days.map((date, index) => {
          const dayEvents = events.filter((event) =>
            isSameDay(event.startTime, date)
          );

          return (
            <div
              key={index}
              onClick={() => onDateClick(date)}
              className={cn(
                'border border-border rounded-md p-1 cursor-pointer',
                'hover:bg-accent/50 transition-colors',
                'flex flex-col min-h-0',
                !isSameMonth(date, currentDate) && 'bg-muted/30 text-muted-foreground',
                isToday(date) && 'border-primary border-2'
              )}
            >
              {/* Date number */}
              <div
                className={cn(
                  'text-sm font-medium mb-1',
                  isToday(date) && 'text-primary'
                )}
              >
                {format(date, 'd')}
              </div>

              {/* Events */}
              <div className="flex-1 overflow-hidden space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className="w-full text-left text-xs px-1 py-0.5 rounded truncate"
                    style={{ backgroundColor: event.color + '20', color: event.color }}
                  >
                    {event.allDay ? event.title : `${format(event.startTime, 'h:mm')} ${event.title}`}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayEvents.length - 3} more
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


/**
 * WEEK VIEW COMPONENT
 * ============================================================================
 */
function WeekView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const weekStart = startOfWeek(currentDate);

  // Generate week days
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="h-full flex flex-col">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {days.map((date) => (
          <div
            key={date.toISOString()}
            className={cn(
              'text-center py-2 rounded-md',
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
        ))}
      </div>

      {/* Events for each day */}
      <div className="flex-1 grid grid-cols-7 gap-2 overflow-y-auto">
        {days.map((date) => {
          const dayEvents = events.filter((event) =>
            isSameDay(event.startTime, date)
          );

          return (
            <div key={date.toISOString()} className="space-y-1">
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="w-full text-left p-2 rounded-md hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: event.color + '20', borderLeft: `3px solid ${event.color}` }}
                >
                  <div className="text-xs text-muted-foreground">
                    {event.allDay ? 'All day' : format(event.startTime, 'h:mm a')}
                  </div>
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


/**
 * TWO WEEK VIEW COMPONENT
 * ============================================================================
 * Shows 2 weeks (Sunday-Saturday) in a calendar grid format
 */
function TwoWeekView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const weekStart = startOfWeek(currentDate);
  const twoWeekEnd = addDays(weekStart, 13); // 14 days total (0-13)

  // Generate all 14 days
  const days: Date[] = [];
  let day = weekStart;
  while (day <= twoWeekEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  // Day names
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-full flex flex-col">
      {/* Day headers */}
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

      {/* Calendar grid - 2 rows of 7 days */}
      <div className="flex-1 grid grid-cols-7 grid-rows-2 gap-1">
        {days.map((date, index) => {
          const dayEvents = events.filter((event) =>
            isSameDay(event.startTime, date)
          );

          return (
            <div
              key={index}
              className={cn(
                'border border-border rounded-md p-1 cursor-pointer',
                'hover:bg-accent/50 transition-colors',
                'flex flex-col min-h-0 overflow-hidden',
                isToday(date) && 'border-primary border-2'
              )}
            >
              {/* Date number */}
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

              {/* Events */}
              <div className="flex-1 overflow-hidden space-y-0.5">
                {dayEvents.slice(0, 4).map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className="w-full text-left text-xs px-1 py-0.5 rounded truncate"
                    style={{ backgroundColor: event.color + '20', color: event.color }}
                  >
                    {event.allDay ? event.title : `${format(event.startTime, 'h:mm')} ${event.title}`}
                  </button>
                ))}
                {dayEvents.length > 4 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayEvents.length - 4} more
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


/**
 * DAY VIEW SIDE-BY-SIDE COMPONENT
 * ============================================================================
 * Shows each family member's calendar in separate columns,
 * aligned by hour vertically.
 */
function DayViewSideBySide({
  currentDate,
  events,
  calendarGroups,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  calendarGroups: Array<{ id: string; name: string; color: string }>;
  onEventClick: (event: CalendarEvent) => void;
}) {
  // Generate hourly time slots (6 AM - 10 PM)
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  const dayEvents = events.filter((event) =>
    isSameDay(event.startTime, currentDate)
  );

  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timedEvents = dayEvents.filter((e) => !e.allDay);

  // Group events by calendar (person)
  const getEventsForCalendar = (calendarId: string) => {
    if (calendarId === 'FAMILY') {
      // Family events don't have a specific user
      return timedEvents.filter(
        (e) => e.calendarName?.toLowerCase().includes('family')
      );
    }
    return timedEvents.filter((e) => {
      // Match by calendar name containing the person's name
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

  // If no calendar groups, show a simple message
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
      <div className="flex-shrink-0 border-b border-border">
        <div className="flex">
          {/* Time column spacer */}
          <div className="w-16 flex-shrink-0" />

          {/* Calendar columns */}
          {calendarGroups.map((group) => {
            const calAllDay = getAllDayEventsForCalendar(group.id);
            return (
              <div
                key={group.id}
                className="flex-1 min-w-0 border-l border-border p-1"
              >
                {/* Calendar header */}
                <div
                  className="text-sm font-medium text-center py-1 mb-1 rounded"
                  style={{ backgroundColor: group.color + '20', color: group.color }}
                >
                  {group.name}
                </div>

                {/* All-day events for this calendar */}
                {calAllDay.length > 0 && (
                  <div className="space-y-0.5">
                    {calAllDay.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className="w-full text-left text-xs px-1 py-0.5 rounded truncate"
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
      <div className="flex-1 overflow-y-auto">
        {hours.map((hour) => (
          <div key={hour} className="flex border-t border-border min-h-[60px]">
            {/* Time label */}
            <div className="w-16 flex-shrink-0 pr-2 text-right text-xs text-muted-foreground pt-1">
              {format(new Date().setHours(hour, 0), 'h a')}
            </div>

            {/* Calendar columns */}
            {calendarGroups.map((group) => {
              const calEvents = getEventsForCalendar(group.id);
              const hourEvents = calEvents.filter(
                (event) => event.startTime.getHours() === hour
              );

              return (
                <div
                  key={group.id}
                  className="flex-1 min-w-0 border-l border-border relative"
                >
                  {hourEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      className="absolute left-0 right-0 mx-0.5 p-1 rounded text-left text-xs"
                      style={{
                        backgroundColor: event.color + '20',
                        borderLeft: `2px solid ${event.color}`,
                        top: `${(event.startTime.getMinutes() / 60) * 100}%`,
                      }}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      <div className="text-muted-foreground">
                        {format(event.startTime, 'h:mm a')}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
