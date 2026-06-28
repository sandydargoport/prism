/**
 *
 * Provides Google Calendar API integration for syncing calendar events.
 *
 * FEATURES:
 * - OAuth 2.0 authentication flow
 * - Fetch calendar list
 * - Fetch and sync events
 * - Create, update, delete events
 *
 */

/**
 * Google OAuth configuration
 */
const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/**
 * Required scopes for Google Calendar access
 */
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  // Identify which Google account authorized, for the "Connected as <email>"
  // label on the Integrations card (#100). Read-only identity scopes.
  'openid',
  'email',
].join(' ');

/**
 * Google Calendar Event from API
 */
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  colorId?: string;
  recurrence?: string[];
  recurringEventId?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

/**
 * Google Calendar from API
 */
export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  accessRole: string;
}

/**
 * Token response from Google OAuth
 */
export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Get credentials — checks DB credential store first, falls back to env vars.
 */
async function getConfig() {
  const { getGoogleCredentials } = await import('@/lib/integrations/credentialStore');
  const creds = await getGoogleCredentials();
  if (!creds) {
    throw new Error(
      'Missing Google OAuth configuration. Configure in Settings → Setup Wizard or set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env'
    );
  }
  return creds;
}

/**
 * Generate the Google OAuth authorization URL
 */
export async function getGoogleAuthUrl(state?: string, redirectUriOverride?: string): Promise<string> {
  const { clientId, redirectUri } = await getConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUriOverride || redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Force consent to get refresh token
  });

  if (state) {
    params.set('state', state);
  }

  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string, redirectUriOverride?: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = await getConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUriOverride || redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * Error thrown when a refresh token has been revoked or expired
 */
export class TokenRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenRevokedError';
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = await getConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Detect revoked/expired tokens
    if (errorText.includes('invalid_grant') || errorText.includes('Token has been expired or revoked')) {
      throw new TokenRevokedError(`Token expired or revoked: ${errorText}`);
    }
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch list of calendars
 */
export async function fetchCalendarList(accessToken: string): Promise<GoogleCalendar[]> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch calendar list: ${error}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Fetch events from a calendar
 */
export async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  options: {
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
    singleEvents?: boolean;
    orderBy?: 'startTime' | 'updated';
  } = {}
): Promise<GoogleCalendarEvent[]> {
  const {
    timeMin = new Date(),
    timeMax,
    maxResults = 250,
    singleEvents = true,
    orderBy = 'startTime',
  } = options;

  // Default timeMax to 30 days from now if not specified
  const effectiveTimeMax = timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const allEvents: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: effectiveTimeMax.toISOString(),
      maxResults: maxResults.toString(),
      singleEvents: singleEvents.toString(),
      orderBy,
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch events: ${error}`);
    }

    const data = await response.json();
    const items = data.items || [];
    allEvents.push(...items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allEvents;
}

/**
 * Create an event in a calendar
 */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
  }
): Promise<GoogleCalendarEvent> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 404) {
      throw new Error(
        `Calendar not found (404). The calendar may have been deleted or unsubscribed in Google. ` +
        `Please remove it in Settings and re-sync your calendars.`
      );
    }
    throw new Error(`Failed to create event: ${error}`);
  }

  return response.json();
}

/**
 * Update an event in a calendar
 */
export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<{
    summary: string;
    description: string;
    location: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
  }>
): Promise<GoogleCalendarEvent> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update event: ${error}`);
  }

  return response.json();
}

/**
 * Delete an event from a calendar
 */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 204) {
    const error = await response.text();
    throw new Error(`Failed to delete event: ${error}`);
  }
}

/**
 * Convert Google Calendar event to internal format
 */
export function convertGoogleEventToInternal(
  googleEvent: GoogleCalendarEvent,
  calendarSourceId: string
): {
  externalEventId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  recurring: boolean;
  recurrenceRule: string | null;
  calendarSourceId: string;
} {
  const isAllDay = !googleEvent.start.dateTime;

  let startTime: Date;
  let endTime: Date;

  if (isAllDay) {
    // All-day events use date strings (YYYY-MM-DD)
    startTime = new Date(googleEvent.start.date + 'T00:00:00');
    endTime = new Date(googleEvent.end.date + 'T00:00:00');
  } else {
    startTime = new Date(googleEvent.start.dateTime!);
    endTime = new Date(googleEvent.end.dateTime!);
  }

  return {
    externalEventId: googleEvent.id,
    title: googleEvent.summary || 'Untitled Event',
    description: googleEvent.description || null,
    location: googleEvent.location || null,
    startTime,
    endTime,
    allDay: isAllDay,
    recurring: Boolean(googleEvent.recurrence || googleEvent.recurringEventId),
    recurrenceRule: googleEvent.recurrence?.[0] || null,
    calendarSourceId,
  };
}
