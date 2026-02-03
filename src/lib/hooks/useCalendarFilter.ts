'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCalendarSources } from './useCalendarEvents';
import type { CalendarEvent } from '@/types/calendar';

export interface CalendarGroup {
  id: string;
  name: string;
  color: string;
  type?: string;
  userId?: string | null;
}

export interface UseCalendarFilterResult {
  selectedCalendarIds: Set<string>;
  toggleCalendar: (id: string) => void;
  filterEvents: (events: CalendarEvent[]) => CalendarEvent[];
  calendarGroups: CalendarGroup[];
}

export function useCalendarFilter(): UseCalendarFilterResult {
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set(['all']));
  const { calendars: calendarSources } = useCalendarSources();
  const [apiGroups, setApiGroups] = useState<CalendarGroup[]>([]);

  // Fetch calendar groups from API
  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/calendar-groups');
        if (res.ok) {
          const data = await res.json();
          setApiGroups(data.groups || []);
        }
      } catch {
        // Fallback: derive from sources (legacy behavior)
      }
    }
    fetchGroups();
  }, []);

  // Use API groups if available, otherwise fall back to legacy derivation
  const calendarGroups = useMemo(() => {
    if (apiGroups.length > 0) {
      return apiGroups.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        type: g.type,
        userId: g.userId,
      }));
    }

    // Legacy fallback: derive from sources
    const groups: CalendarGroup[] = [];
    const filterableCalendars = calendarSources.filter(
      (cal) => cal.enabled && (cal.user || (cal as { isFamily?: boolean }).isFamily)
    );

    const hasFamilyCalendar = filterableCalendars.some(
      (cal) => (cal as { isFamily?: boolean }).isFamily
    );
    if (hasFamilyCalendar) {
      groups.push({ id: 'FAMILY', name: 'Family', color: '#F59E0B' });
    }

    const seenUsers = new Set<string>();
    for (const cal of filterableCalendars) {
      if (cal.user && cal.user.id !== 'FAMILY' && !seenUsers.has(cal.user.id)) {
        seenUsers.add(cal.user.id);
        groups.push({ id: cal.user.id, name: cal.user.name, color: cal.user.color });
      }
    }

    return groups;
  }, [apiGroups, calendarSources]);

  const toggleCalendar = useCallback((id: string) => {
    setSelectedCalendarIds((prev) => {
      const newSet = new Set(prev);
      if (id === 'all') {
        if (newSet.has('all')) {
          return new Set();
        } else {
          const all = new Set(['all']);
          calendarGroups.forEach((g) => all.add(g.id));
          return all;
        }
      } else {
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
      }
    });
  }, [calendarGroups]);

  // Initialize selected calendars to 'all' when calendar groups load
  useEffect(() => {
    if (calendarGroups.length > 0 && selectedCalendarIds.size === 1 && selectedCalendarIds.has('all')) {
      const all = new Set(['all']);
      calendarGroups.forEach((g) => all.add(g.id));
      setSelectedCalendarIds(all);
    }
  }, [calendarGroups]);

  const filterEvents = useCallback((events: CalendarEvent[]): CalendarEvent[] => {
    return events.filter((event) => {
      if (selectedCalendarIds.has('all')) return true;
      if (selectedCalendarIds.size === 0) return false;

      // Find the calendar source for this event
      const calSource = calendarSources.find((c) => c.id === event.calendarId);
      if (!calSource) return false;

      // If source has a groupId, check if that group is selected
      const sourceWithGroup = calSource as { groupId?: string };
      if (sourceWithGroup.groupId && selectedCalendarIds.has(sourceWithGroup.groupId)) {
        return true;
      }

      // Legacy fallback: check isFamily / user
      if ((calSource as { isFamily?: boolean }).isFamily) {
        // Check if any group named "Family" is selected
        const familyGroup = calendarGroups.find((g) => g.name === 'Family');
        if (familyGroup && selectedCalendarIds.has(familyGroup.id)) return true;
      }
      if (calSource.user && selectedCalendarIds.has(calSource.user.id)) {
        return true;
      }

      return false;
    });
  }, [selectedCalendarIds, calendarSources, calendarGroups]);

  return {
    selectedCalendarIds,
    toggleCalendar,
    filterEvents,
    calendarGroups,
  };
}
