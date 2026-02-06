'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { useCalendarEvents, useCalendarSources } from '@/lib/hooks';
import type { CalendarEvent } from '@/types/calendar';

export type CalendarViewType = 'day' | 'week' | 'twoWeek' | 'month' | 'threeMonth';

export interface CalendarGroup {
  id: string;
  name: string;
  color: string;
}

export function useCalendarViewData() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set(['all']));

  const { calendars: calendarSources } = useCalendarSources();
  const filterableCalendars = calendarSources.filter((cal) => cal.enabled);

  const [calendarGroups, setCalendarGroups] = useState<CalendarGroup[]>([]);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/calendar-groups');
        if (res.ok) {
          const data = await res.json();
          setCalendarGroups((data.groups || []).map((g: CalendarGroup) => ({
            id: g.id, name: g.name, color: g.color,
          })));
        }
      } catch { /* ignore */ }
    }
    fetchGroups();
  }, [calendarSources]);

  const toggleCalendar = useCallback((id: string) => {
    setSelectedCalendarIds((prev) => {
      const newSet = new Set(prev);
      if (id === 'all') {
        if (newSet.has('all')) return new Set();
        const all = new Set(['all']);
        calendarGroups.forEach((g) => all.add(g.id));
        return all;
      }
      newSet.delete('all');
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      if (newSet.size === calendarGroups.length) {
        newSet.add('all');
      }
      return newSet;
    });
  }, [calendarGroups]);

  // Only expand 'all' on initial load (when calendarGroups first populates)
  const [initializedCalendars, setInitializedCalendars] = useState(false);
  useEffect(() => {
    if (!initializedCalendars && calendarGroups.length > 0) {
      const all = new Set(['all']);
      calendarGroups.forEach((g) => all.add(g.id));
      setSelectedCalendarIds(all);
      setInitializedCalendars(true);
    }
  }, [calendarGroups, initializedCalendars]);

  const { events: apiEvents, loading, error, refresh: refreshEvents } = useCalendarEvents({ daysToShow: 60 });

  const events: CalendarEvent[] = useMemo(() => {
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
        if (calSource.groupId && selectedCalendarIds.has(calSource.groupId)) return true;
        if ((calSource as { isFamily?: boolean }).isFamily) {
          const familyGroup = calendarGroups.find((g) => g.name === 'Family');
          if (familyGroup && selectedCalendarIds.has(familyGroup.id)) return true;
        }
        if (calSource.user && selectedCalendarIds.has(calSource.user.id)) return true;
        return false;
      });
  }, [apiEvents, selectedCalendarIds, filterableCalendars, calendarGroups]);

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  const goToPrevious = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewType) {
        case 'day': return subDays(prev, 1);
        case 'week': return subWeeks(prev, 1);
        case 'twoWeek': return subWeeks(prev, 2);
        case 'month': return subMonths(prev, 1);
        case 'threeMonth': return subMonths(prev, 1);
      }
    });
  }, [viewType]);

  const goToNext = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewType) {
        case 'day': return addDays(prev, 1);
        case 'week': return addWeeks(prev, 1);
        case 'twoWeek': return addWeeks(prev, 2);
        case 'month': return addMonths(prev, 1);
        case 'threeMonth': return addMonths(prev, 1);
      }
    });
  }, [viewType]);

  const getDateRangeTitle = useCallback((): string => {
    switch (viewType) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week': {
        const ws = startOfWeek(currentDate);
        const we = endOfWeek(currentDate);
        return `${format(ws, 'MMM d')} - ${format(we, 'MMM d, yyyy')}`;
      }
      case 'twoWeek': {
        const tws = startOfWeek(currentDate);
        const twe = endOfWeek(addWeeks(currentDate, 1));
        return `${format(tws, 'MMM d')} - ${format(twe, 'MMM d, yyyy')}`;
      }
      case 'month':
      case 'threeMonth':
        return format(currentDate, 'MMMM yyyy');
    }
  }, [viewType, currentDate]);

  return {
    currentDate, setCurrentDate,
    viewType, setViewType,
    selectedEvent, setSelectedEvent,
    showAddEvent, setShowAddEvent,
    editingEvent, setEditingEvent,
    selectedCalendarIds,
    calendarGroups,
    toggleCalendar,
    events, loading, error, refreshEvents,
    goToToday, goToPrevious, goToNext, getDateRangeTitle,
  };
}
