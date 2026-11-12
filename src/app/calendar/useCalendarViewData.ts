'use client';

import { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import {
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  subMonths,
  subWeeks,
  subDays,
} from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCalendarEvents, useCalendarFilter } from '@/lib/hooks';
import { useDateLabels } from '@/lib/hooks/useDateLabels';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { deduplicateEvents } from '@/lib/utils/calendarDedup';
import { getCalendarWindow, MAX_CALENDAR_EVENTS } from '@/lib/utils/calendarRange';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import { useFollowToday } from '@/lib/hooks/useFollowToday';
import { useResetOn } from '@/lib/hooks/useResetOn';
import { toDisplayDate } from '@/lib/utils/timeFormat';
import { migrateSubpageView, type SubpageView } from '@/lib/utils/retiredCalendarViews';

export type CalendarViewType = SubpageView;

export type { CalendarGroup } from '@/lib/hooks';

export function useCalendarViewData() {
  const t = useTranslations('calendar');
  const d = useDateLabels();
  const { weekStartsOn } = useWeekStartsOn();
  const { displayTimezone } = useTimeFormat();
  // View/date changes trigger a heavy re-bucket + grid re-render. Running those
  // as a transition keeps the switcher/nav responsive (and lets us show a subtle
  // pending state) instead of freezing while the new view computes.
  const [isNavPending, startTransition] = useTransition();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Back to today in the display zone whenever the zone changes, including
  // when the household's zone arrives after the first render. Done during
  // render, so the old zone's date is never painted.
  useResetOn(displayTimezone, () => setCurrentDate(toDisplayDate(new Date(), displayTimezone)));
  useFollowToday(currentDate, setCurrentDate, displayTimezone);
  const [viewType, setViewTypeState] = useState<CalendarViewType>(() => {
    if (typeof window === 'undefined') return 'month';
    return migrateSubpageView(
      localStorage.getItem('prism-calendar-view-type'),
      localStorage.getItem('prism-calendar-week-count'),
    );
  });
  const setViewType = useCallback(
    (next: CalendarViewType) => startTransition(() => setViewTypeState(next)),
    [],
  );

  useEffect(() => {
    localStorage.setItem('prism-calendar-view-type', viewType);
    // The week count only chose between the retired 1W/3W/4W grids.
    localStorage.removeItem('prism-calendar-week-count');
  }, [viewType]);
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
  // The window around the date shown (#1082), not four years: one request per
  // quarter, so paging within it is instant. Agenda always lists from today.
  const windowDate = viewType === 'agenda' ? new Date() : currentDate;
  const windowKey = getCalendarWindow(windowDate).start.getTime();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchRange = useMemo(() => getCalendarWindow(windowDate), [windowKey]);
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
      // Carried, not dropped. This map rebuilds each event field by field, and
      // description was missing from the list while location was present — so a
      // synced event arrived at the edit modal with empty notes and no clue
      // why. Everything upstream had it: Google, the row, the API and
      // useCalendarEvents all carry description; it died here.
      description: event.description,
      location: event.location,
      recurring: event.recurring,
      recurrenceRule: event.recurrenceRule,
      reminderMinutes: event.reminderMinutes,
      // The event detail offers "every event in the series" only on this.
      inSeries: event.inSeries,
      calendarName: event.calendarName,
      calendarId: event.calendarId,
      // The same event on other people's calendars (#1066).
      alsoIds: event.alsoIds,
      alsoCalendarIds: event.alsoCalendarIds,
      alsoCalendarNames: event.alsoCalendarNames,
      alsoColors: event.alsoColors,
    }));
    return deduplicateEvents(filterEvents(mapped));
  }, [apiEvents, filterEvents]);

  const goToToday = useCallback(
    () => startTransition(() => setCurrentDate(toDisplayDate(new Date(), displayTimezone))),
    [displayTimezone],
  );

  const goToPrevious = useCallback(() => {
    startTransition(() => setCurrentDate(prev => {
      switch (viewType) {
        case 'agenda': return prev; // no navigation
        case 'day': return subDays(prev, 1);
        case 'week': return subWeeks(prev, 1);
        case 'weekVertical': return subWeeks(prev, 1);
        case 'multiWeek': return subWeeks(prev, 2);
        case 'month': return subMonths(prev, 1);
        case 'threeMonth': return subMonths(prev, 1);
      }
    }));
  }, [viewType]);

  const goToNext = useCallback(() => {
    startTransition(() => setCurrentDate(prev => {
      switch (viewType) {
        case 'agenda': return prev; // no navigation
        case 'day': return addDays(prev, 1);
        case 'week': return addWeeks(prev, 1);
        case 'weekVertical': return addWeeks(prev, 1);
        case 'multiWeek': return addWeeks(prev, 2);
        case 'month': return addMonths(prev, 1);
        case 'threeMonth': return addMonths(prev, 1);
      }
    }));
  }, [viewType]);

  // The header reads in the interface language: Intl picks the field order as
  // well as the names, so German gets "4. September 2026", not "September 4".
  const getDateRangeTitle = useCallback((): string => {
    switch (viewType) {
      case 'agenda':
        return t('upcoming');
      case 'day':
        return d.fullDate(currentDate);
      case 'week':
      case 'weekVertical':
        return d.range(
          startOfWeek(currentDate, { weekStartsOn }),
          endOfWeek(currentDate, { weekStartsOn }),
        );
      case 'multiWeek':
        return d.range(
          startOfWeek(currentDate, { weekStartsOn }),
          endOfWeek(addWeeks(currentDate, 1), { weekStartsOn }),
        );
      case 'month':
      case 'threeMonth':
        return d.monthYear(currentDate);
    }
  }, [viewType, currentDate, weekStartsOn, t, d]);

  return {
    currentDate, setCurrentDate,
    viewType, setViewType,
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
    isNavPending,
  };
}
