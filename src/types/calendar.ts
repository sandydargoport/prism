/**
 * Shared type definitions for calendar events.
 * Used by widgets, hooks, and API routes.
 */

/**
 * Calendar event as used in the UI
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  color: string;
  calendarName: string;
  calendarId: string;
}

/**
 * Calendar event as returned from API (dates as ISO strings)
 */
export interface CalendarEventResponse {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  recurring: boolean;
  recurrenceRule: string | null;
  color: string | null;
  reminderMinutes: number | null;
  calendarSource: {
    id: string;
    name: string;
    color: string | null;
    provider: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Calendar source (connected external calendar)
 */
export interface CalendarSource {
  id: string;
  provider: 'google' | 'apple' | 'microsoft' | 'caldav';
  dashboardCalendarName: string;
  displayName: string | null;
  color: string | null;
  enabled: boolean;
  lastSynced: Date | null;
  userId: string | null;
}
