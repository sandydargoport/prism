/**
 * ============================================================================
 * PRISM - useCalendarEvents Hook
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides a React hook for fetching and managing calendar events.
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import type { CalendarEvent } from '@/types/calendar';

interface UseCalendarEventsOptions {
  /** Number of days to fetch events for */
  daysToShow?: number;
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number;
  /** Start with demo data before API loads */
  useDemoFallback?: boolean;
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
  const { daysToShow = 7, refreshInterval = 5 * 60 * 1000, useDemoFallback = true } = options;

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch events from the API
   */
  const fetchEvents = useCallback(async () => {
    try {
      setError(null);

      const today = startOfDay(new Date());
      const endDate = endOfDay(addDays(today, daysToShow));

      const response = await fetch(
        `/api/events?startDate=${today.toISOString()}&endDate=${endDate.toISOString()}`
      );

      if (!response.ok) {
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
          calendarName: event.calendarSource?.name || 'Local Calendar',
          calendarId: event.calendarSource?.id || 'local',
        })
      );

      setEvents(transformedEvents);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');

      // If we have no events and demo fallback is enabled, don't clear existing events
      if (useDemoFallback && events.length === 0) {
        // Events will remain empty, widget should show demo data
      }
    } finally {
      setLoading(false);
    }
  }, [daysToShow, useDemoFallback]);

  /**
   * Trigger calendar sync
   */
  const syncCalendars = useCallback(async () => {
    try {
      const response = await fetch('/api/calendars/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

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

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(fetchEvents, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchEvents]);

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
      isFamily: boolean;
      lastSynced: string | null;
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
