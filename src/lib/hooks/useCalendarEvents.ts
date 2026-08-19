/**
 *
 * Provides a React hook for fetching and managing calendar events.
 *
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import type { CalendarEvent } from '@/types/calendar';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import { navCacheGet, navCacheSet } from '@/lib/utils/navCache';

interface UseCalendarEventsOptions {
  /** Number of days to fetch events for (used only when rangeStart/rangeEnd are omitted). */
  daysToShow?: number;
  /**
   * Explicit fetch window. When both are provided they override the
   * today-anchored daysToShow window — used by the full calendar page so events
   * far from today (past a rolling horizon) don't disappear from the views.
   */
  rangeStart?: Date;
  rangeEnd?: Date;
  /** Max events to request. Defaults to 500; the calendar page raises this. */
  limit?: number;
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number;
  /** Start with demo data before API loads */
  useDemoFallback?: boolean;
  /** Auto-sync interval in minutes (0 = disabled, default = 10) */
  autoSyncMinutes?: number;
  /** When false, skip initial fetch and polling. Fetch triggers when enabled transitions to true. */
  enabled?: boolean;
}

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  syncCalendars: () => Promise<void>;
}

/**
 * Hook for fetching calendar events from the API
 */
export function useCalendarEvents(
  options: UseCalendarEventsOptions = {}
): UseCalendarEventsResult {
  const { daysToShow = 7, rangeStart, rangeEnd, limit = 500, refreshInterval = 5 * 60 * 1000, useDemoFallback = true, autoSyncMinutes = 10, enabled = true } = options;

  // The request URL doubles as the cache key. When an explicit range is given
  // it wins; otherwise fall back to the today-anchored daysToShow window.
  // Stable across remounts within the same day (deps are primitives).
  const rangeStartMs = rangeStart?.getTime();
  const rangeEndMs = rangeEnd?.getTime();
  const cacheKey = useMemo(() => {
    let startDate: Date;
    let endDate: Date;
    if (rangeStartMs !== undefined && rangeEndMs !== undefined) {
      startDate = new Date(rangeStartMs);
      endDate = new Date(rangeEndMs);
    } else {
      const today = startOfDay(new Date());
      startDate = startOfDay(subDays(today, 30));
      endDate = endOfDay(addDays(today, daysToShow));
    }
    return `/api/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&limit=${limit}`;
  }, [daysToShow, rangeStartMs, rangeEndMs, limit]);

  const cached = navCacheGet<CalendarEvent[]>(cacheKey);
  const [events, setEvents] = useState<CalendarEvent[]>(() => cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncCheck, setLastSyncCheck] = useState<Date | null>(null);

  /**
   * Fetch events from the API
   */
  const fetchEvents = useCallback(async () => {
    if (!navCacheGet(cacheKey)) setLoading(true);
    try {
      setError(null);

      // cacheKey IS the request URL (same window + limit), so the fetch can
      // never diverge from what's cached.
      const response = await fetch(cacheKey);

      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event('prism:auth-expired'));
        }
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();

      // Transform API response to CalendarEvent format
      const transformedEvents: CalendarEvent[] = data.events.map(
        (event: {
          id: string;
          title: string;
          description?: string;
          location?: string;
          startTime: string;
          endTime: string;
          allDay: boolean;
          color?: string;
          recurring?: boolean;
          recurrenceRule?: string | null;
          reminderMinutes?: number | null;
          calendarSource?: {
            id: string;
            name: string;
            color?: string;
          };
        }) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          startTime: new Date(event.startTime),
          endTime: new Date(event.endTime),
          allDay: event.allDay,
          color: event.color || event.calendarSource?.color || '#3B82F6',
          recurring: event.recurring,
          recurrenceRule: event.recurrenceRule,
          reminderMinutes: event.reminderMinutes,
          calendarName: event.calendarSource?.name || 'Local Calendar',
          calendarId: event.calendarSource?.id || 'local',
        })
      );

      navCacheSet(cacheKey, transformedEvents);
      setEvents(transformedEvents);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  /**
   * Trigger calendar sync
   */
  const syncCalendars = useCallback(async () => {
    // Skip sync in guest/display mode — no session cookie means no write access
    if (!document.cookie.includes('prism_session')) return;

    try {
      const response = await fetch('/api/calendars/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Silently ignore auth errors (401/403) - sync requires login
      if (response.status === 401 || response.status === 403) {
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to sync calendars');
      }

      // Refresh events after sync
      await fetchEvents();
    } catch (err) {
      console.error('Error syncing calendars:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync calendars');
    }
  }, [fetchEvents]);

  // Initial fetch (skipped when disabled)
  useEffect(() => {
    if (enabled) fetchEvents();
  }, [fetchEvents, enabled]);

  // Refetch whenever a calendar sync or add completes anywhere in the app
  // (Settings "Sync Now", adding an iCal subscription, the Calendar page's
  // manage modal, …). A global window event keeps every calendar view — the
  // dashboard widget included — in sync without a manual page refresh, no
  // matter which page fired it. Mirrors the existing prism:auth-* events.
  useEffect(() => {
    if (!enabled) return;
    const handler = () => { fetchEvents(); };
    window.addEventListener('prism:calendar-synced', handler);
    return () => window.removeEventListener('prism:calendar-synced', handler);
  }, [enabled, fetchEvents]);

  // Periodic data refresh — pauses when tab is hidden
  useVisibilityPolling(fetchEvents, enabled ? refreshInterval : 0);

  // Auto-sync: check if any Google calendar is stale and trigger sync if needed
  const checkAndSync = useCallback(async () => {
    if (!enabled || autoSyncMinutes <= 0) return;
    try {
      const response = await fetch('/api/calendars');
      if (!response.ok) return;

      const data = await response.json();
      const calendars = data.calendars || [];

      const syncThreshold = new Date(Date.now() - autoSyncMinutes * 60 * 1000);
      const needsSync = calendars.some(
        (cal: { provider: string; enabled: boolean; lastSynced: string | null }) =>
          cal.provider === 'google' &&
          cal.enabled &&
          (!cal.lastSynced || new Date(cal.lastSynced) < syncThreshold)
      );

      if (needsSync) await syncCalendars();
      setLastSyncCheck(new Date());
    } catch (err) {
      console.error('[AutoSync] Error checking sync status:', err);
    }
  }, [enabled, autoSyncMinutes, syncCalendars]);

  // Initial sync check on mount / when enabled changes
  useEffect(() => {
    if (enabled && autoSyncMinutes > 0) checkAndSync();
  }, [checkAndSync, enabled, autoSyncMinutes]);

  // Periodic sync check — pauses when tab is hidden
  useVisibilityPolling(checkAndSync, enabled && autoSyncMinutes > 0 ? autoSyncMinutes * 60 * 1000 : 0);

  return {
    events,
    loading,
    error,
    refresh: fetchEvents,
    syncCalendars,
  };
}

/**
 * Hook for fetching calendar sources
 */
export function useCalendarSources() {
  const [calendars, setCalendars] = useState<
    Array<{
      id: string;
      provider: string;
      dashboardCalendarName: string;
      displayName: string | null;
      color: string | null;
      enabled: boolean;
      showInEventModal: boolean;
      isFamily: boolean;
      groupId: string | null;
      groupName: string | null;
      groupColor: string | null;
      lastSynced: string | null;
      syncErrors: { needsReauth?: boolean; lastError?: string; timestamp?: string } | null;
      providerConfig: Record<string, unknown> | null;
      user: { id: string; name: string; color: string } | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendars = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/calendars');

      if (!response.ok) {
        throw new Error('Failed to fetch calendars');
      }

      const data = await response.json();
      setCalendars(data.calendars);
    } catch (err) {
      console.error('Error fetching calendars:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calendars');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  return {
    calendars,
    loading,
    error,
    refresh: fetchCalendars,
  };
}
