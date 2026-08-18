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
import { useCalendarEvents, useCalendarFilter } from '@/lib/hooks';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { deduplicateEvents } from '@/lib/utils/calendarDedup';
import { getFullCalendarRange, MAX_CALENDAR_EVENTS } from '@/lib/utils/calendarRange';
import type { CalendarEvent } from '@/types/calendar';

export type CalendarViewType = 'agenda' | 'day' | 'week' | 'weekVertical' | 'multiWeek' | 'month' | 'threeMonth';
export type MultiWeekCount = 1 | 2 | 3 | 4;

export type { CalendarGroup } from '@/lib/hooks';

export function useCalendarViewData() {
  const { weekStartsOn } = useWeekStartsOn();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<CalendarViewType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('prism-calendar-view-type') as CalendarViewType | null;
      const valid: CalendarViewType[] = ['agenda', 'day', 'week', 'weekVertical', 'multiWeek', 'month', 'threeMonth'];
      if (saved && valid.includes(saved)) return saved;
    }
    return 'month';
  });

  useEffect(() => {
    localStorage.setItem('prism-calendar-view-type', viewType);
  }, [viewType]);
  const [weekCount, setWeekCount] = useState<MultiWeekCount>(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('prism-calendar-week-count');
      const n = raw ? Number(raw) : NaN;
      if (n === 1 || n === 2 || n === 3 || n === 4) return n as MultiWeekCount;
    }
    return 2;
  });
  useEffect(() => {
    localStorage.setItem('prism-calendar-week-count', String(weekCount));
  }, [weekCount]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [mergedView, setMergedView] = useState(false);
  const [weeksBordered, setWeeksBordered] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('prism-calendar-bordered') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('prism-calendar-bordered', String(weeksBordered));
  }, [weeksBordered]);

  const [hideWeekends, setHideWeekends] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('prism-calendar-hide-weekends') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('prism-calendar-hide-weekends', String(hideWeekends));
  }, [hideWeekends]);

  const [displayMode, setDisplayMode] = useState<'inline' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('prism-calendar-display-mode') === 'cards' ? 'cards' : 'inline';
    }
    return 'inline';
  });

  useEffect(() => {
    localStorage.setItem('prism-calendar-display-mode', displayMode);
  }, [displayMode]);

  const [overlays, setOverlays] = useState<{ events: boolean; meals: boolean; chores: boolean; tasks: boolean }>(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('prism-calendar-overlays');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return {
            events: parsed.events !== false,
            meals: parsed.meals !== false,
            chores: parsed.chores !== false,
            tasks: parsed.tasks !== false,
          };
        } catch { /* fall through */ }
      }
    }
    return { events: true, meals: true, chores: true, tasks: true };
  });

  useEffect(() => {
    localStorage.setItem('prism-calendar-overlays', JSON.stringify(overlays));
  }, [overlays]);

  const { selectedCalendarIds, toggleCalendar, filterEvents, calendarGroups } = useCalendarFilter();
  // Fetch a wide, static window (Jan 1 last year … Dec 31 +2yr) rather than a
  // rolling today-anchored one, so events don't vanish from the views once
  // they're more than a couple months out (#250). Fixed window => navigation
  // reuses one cached dataset instead of refetching on every prev/next.
  const fetchRange = useMemo(() => getFullCalendarRange(new Date()), []);
  const { events: apiEvents, loading, error, refresh: refreshEvents } = useCalendarEvents({
    rangeStart: fetchRange.start,
    rangeEnd: fetchRange.end,
    limit: MAX_CALENDAR_EVENTS,
  });

  const events: CalendarEvent[] = useMemo(() => {
    const mapped = apiEvents.map((event) => ({
      id: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.allDay,
      color: event.color,
      location: event.location,
      recurring: event.recurring,
      recurrenceRule: event.recurrenceRule,
      reminderMinutes: event.reminderMinutes,
      calendarName: event.calendarName,
      calendarId: event.calendarId,
    }));
    return deduplicateEvents(filterEvents(mapped));
  }, [apiEvents, filterEvents]);

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  const goToPrevious = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewType) {
        case 'agenda': return prev; // no navigation
        case 'day': return subDays(prev, 1);
        case 'week': return subWeeks(prev, 1);
        case 'weekVertical': return subWeeks(prev, 1);
        case 'multiWeek': return subWeeks(prev, weekCount);
        case 'month': return subMonths(prev, 1);
        case 'threeMonth': return subMonths(prev, 1);
      }
    });
  }, [viewType, weekCount]);

  const goToNext = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewType) {
        case 'agenda': return prev; // no navigation
        case 'day': return addDays(prev, 1);
        case 'week': return addWeeks(prev, 1);
        case 'weekVertical': return addWeeks(prev, 1);
        case 'multiWeek': return addWeeks(prev, weekCount);
        case 'month': return addMonths(prev, 1);
        case 'threeMonth': return addMonths(prev, 1);
      }
    });
  }, [viewType, weekCount]);

  const getDateRangeTitle = useCallback((): string => {
    switch (viewType) {
      case 'agenda':
        return 'Upcoming Events';
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
      case 'weekVertical': {
        const ws = startOfWeek(currentDate, { weekStartsOn });
        const we = endOfWeek(currentDate, { weekStartsOn });
        return `${format(ws, 'MMM d')} - ${format(we, 'MMM d, yyyy')}`;
      }
      case 'multiWeek': {
        const tws = startOfWeek(currentDate, { weekStartsOn });
        const twe = endOfWeek(addWeeks(currentDate, weekCount - 1), { weekStartsOn });
        return `${format(tws, 'MMM d')} - ${format(twe, 'MMM d, yyyy')}`;
      }
      case 'month':
      case 'threeMonth':
        return format(currentDate, 'MMMM yyyy');
    }
  }, [viewType, weekCount, currentDate, weekStartsOn]);

  return {
    currentDate, setCurrentDate,
    viewType, setViewType,
    weekCount, setWeekCount,
    selectedEvent, setSelectedEvent,
    showAddEvent, setShowAddEvent,
    editingEvent, setEditingEvent,
    selectedCalendarIds,
    calendarGroups,
    toggleCalendar,
    mergedView, setMergedView,
    weeksBordered, setWeeksBordered,
    displayMode, setDisplayMode,
    hideWeekends, setHideWeekends,
    overlays, setOverlays,
    events, loading, error, refreshEvents,
    goToToday, goToPrevious, goToNext, getDateRangeTitle,
  };
}
