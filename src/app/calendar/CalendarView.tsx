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
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  subMonths,
  subWeeks,
  subDays,
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
import { MonthView, WeekView, TwoWeekView, ThreeMonthView, DayViewSideBySide } from '@/components/calendar';


/**
 * VIEW TYPE
 */
type CalendarViewType = 'day' | 'week' | 'twoWeek' | 'month' | 'threeMonth';


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

  // Include all enabled calendars
  const filterableCalendars = calendarSources.filter((cal) => cal.enabled);

  // Get calendar groups from API
  const [calendarGroups, setCalendarGroups] = React.useState<Array<{ id: string; name: string; color: string }>>([]);
  React.useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/calendar-groups');
        if (res.ok) {
          const data = await res.json();
          setCalendarGroups((data.groups || []).map((g: { id: string; name: string; color: string }) => ({
            id: g.id,
            name: g.name,
            color: g.color,
          })));
        }
      } catch { /* ignore */ }
    }
    fetchGroups();
  }, [calendarSources]);

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
        if (selectedCalendarIds.has('all')) return true;
        if (selectedCalendarIds.size === 0) return false;

        const calSource = filterableCalendars.find((c) => c.id === event.calendarId);
        if (!calSource) return false;

        // Check groupId first (new system)
        if (calSource.groupId && selectedCalendarIds.has(calSource.groupId)) {
          return true;
        }

        // Legacy fallback
        if ((calSource as { isFamily?: boolean }).isFamily) {
          const familyGroup = calendarGroups.find((g) => g.name === 'Family');
          if (familyGroup && selectedCalendarIds.has(familyGroup.id)) return true;
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
      case 'threeMonth':
        setCurrentDate(subMonths(currentDate, 3));
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
      case 'threeMonth':
        setCurrentDate(addMonths(currentDate, 3));
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
      case 'threeMonth':
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
                className="rounded-none border-r"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Month
              </Button>
              <Button
                variant={viewType === 'threeMonth' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewType('threeMonth')}
                className="rounded-l-none"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                3 Mo
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
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors leading-none',
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
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 leading-none',
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

        {!loading && !error && viewType === 'threeMonth' && (
          <ThreeMonthView
            currentDate={currentDate}
            events={events}
            onEventClick={setSelectedEvent}
            onDateClick={(date) => {
              setCurrentDate(date);
              setViewType('day');
            }}
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


