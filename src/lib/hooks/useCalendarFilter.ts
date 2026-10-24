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

const ALL_ONLY = new Set(['all']);

function expandAll(ids: Set<string>, groups: CalendarGroup[]): Set<string> {
  if (groups.length === 0 || ids.size !== 1 || !ids.has('all')) return ids;
  return new Set(['all', ...groups.map((g) => g.id)]);
}

export function useCalendarFilter(): UseCalendarFilterResult {
  const [chosenIds, setChosenIds] = useState<Set<string>>(ALL_ONLY);
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

  // The starting 'all' alone means every group, whichever groups have loaded
  // by the time it is read.
  const selectedCalendarIds = useMemo(
    () => expandAll(chosenIds, calendarGroups),
    [chosenIds, calendarGroups],
  );

  const toggleCalendar = useCallback((id: string) => {
    setChosenIds((prev) => {
      const newSet = new Set(expandAll(prev, calendarGroups));
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

  // Build a lookup from calendarId → groupId
  const sourceGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const src of calendarSources) {
      const s = src as { id: string; groupId?: string | null; isFamily?: boolean; user?: { id: string } };
      if (s.groupId) {
        map.set(s.id, s.groupId);
      } else if (s.isFamily) {
        const familyGroup = calendarGroups.find((g) => g.name === 'Family');
        if (familyGroup) map.set(s.id, familyGroup.id);
      } else if (s.user) {
        map.set(s.id, s.user.id);
      }
    }
    return map;
  }, [calendarSources, calendarGroups]);

  const filterEvents = useCallback((events: CalendarEvent[]): CalendarEvent[] => {
    return events
      .filter((event) => {
        if (selectedCalendarIds.has('all')) return true;
        if (selectedCalendarIds.size === 0) return false;

        const gid = sourceGroupMap.get(event.calendarId);
        if (gid && selectedCalendarIds.has(gid)) return true;

        // Legacy fallback
        const calSource = calendarSources.find((c) => c.id === event.calendarId);
        if (!calSource) return false;
        if ((calSource as { isFamily?: boolean }).isFamily) {
          const familyGroup = calendarGroups.find((g) => g.name === 'Family');
          if (familyGroup && selectedCalendarIds.has(familyGroup.id)) return true;
        }
        if (calSource.user && selectedCalendarIds.has(calSource.user.id)) return true;

        return false;
      })
      // Enrich events with groupId for split-column views
      .map((event) => {
        const gid = sourceGroupMap.get(event.calendarId);
        return gid && gid !== event.groupId ? { ...event, groupId: gid } : event;
      });
  }, [selectedCalendarIds, calendarSources, calendarGroups, sourceGroupMap]);

  return {
    selectedCalendarIds,
    toggleCalendar,
    filterEvents,
    calendarGroups,
  };
}
