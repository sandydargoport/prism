/**
 * Tests for calendar-sync service.
 *
 * The service is heavily dependent on DB and external APIs, so we mock
 * all external dependencies and test the orchestration logic:
 * - tokenNeedsRefresh timing logic (tested indirectly through syncGoogleCalendarSource)
 * - Source validation (missing source, wrong provider, no access token)
 * - Token refresh flow
 * - Error isolation per-source in syncAllGoogleCalendars
 * - Deleted event cleanup logic
 */

// --- Mocks ---

const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

const mockOnConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
const mockInsertValues = jest.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
mockInsert.mockReturnValue({ values: mockInsertValues });

const mockUpdateSet = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
mockUpdate.mockReturnValue({ set: mockUpdateSet });

const mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
// db.select(...).from(...).where(...) — used to load dismissed-event tombstones.
const mockSelect = jest.fn().mockReturnValue({
  from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
});
mockDelete.mockReturnValue({ where: mockDeleteWhere });

jest.mock('@/lib/db/client', () => ({
  db: {
    query: {
      calendarSources: { findFirst: (...args: unknown[]) => mockFindFirst(...args), findMany: (...args: unknown[]) => mockFindMany(...args) },
      events: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  calendarSources: { id: 'id', provider: 'provider', enabled: 'enabled' },
  events: { calendarSourceId: 'calendarSourceId', externalEventId: 'externalEventId', startTime: 'startTime', id: 'id', pendingDeletion: 'pendingDeletion' },
  dismissedEvents: { calendarSourceId: 'calendarSourceId', externalEventId: 'externalEventId' },
}));

const mockFetchCalendarEvents = jest.fn();
const mockRefreshAccessToken = jest.fn();
const mockConvertEvent = jest.fn();

jest.mock('@/lib/integrations/google-calendar', () => ({
  fetchCalendarEvents: (...args: unknown[]) => mockFetchCalendarEvents(...args),
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
  convertGoogleEventToInternal: (...args: unknown[]) => mockConvertEvent(...args),
}));

jest.mock('@/lib/utils/crypto', () => ({
  decrypt: (val: string) => `decrypted_${val}`,
  encrypt: (val: string) => `encrypted_${val}`,
}));

const mockIcalFromURL = jest.fn();

jest.mock('node-ical', () => ({
  async: {
    fromURL: (...args: unknown[]) => mockIcalFromURL(...args),
  },
}));

// Suppress console.log/error from sync logging
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import {
  syncGoogleCalendarSource,
  syncAllGoogleCalendars,
  syncIcalCalendarSource,
} from '../calendar-sync';

// --- Helpers ---

function makeSource(overrides: Record<string, unknown> = {}) {
  return {
    id: 'source-1',
    provider: 'google',
    accessToken: 'encrypted-access-token',
    refreshToken: 'encrypted-refresh-token',
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    sourceCalendarId: 'primary',
    dashboardCalendarName: 'Test Calendar',
    enabled: true,
    ...overrides,
  };
}

// --- Tests ---

describe('syncGoogleCalendarSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchCalendarEvents.mockResolvedValue([]);
    // Return no prism events for cleanup check
    mockFindMany.mockResolvedValue([]);
  });

  it('returns error when source is not found', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await syncGoogleCalendarSource('nonexistent');

    expect(result.synced).toBe(0);
    expect(result.errors).toContain('Calendar source not found');
  });

  it('returns error when provider is not google', async () => {
    mockFindFirst.mockResolvedValue(makeSource({ provider: 'ical' }));

    const result = await syncGoogleCalendarSource('source-1');

    expect(result.synced).toBe(0);
    expect(result.errors).toContain('Not a Google Calendar source');
  });

  it('returns error when no access token available', async () => {
    mockFindFirst.mockResolvedValue(makeSource({ accessToken: null }));

    const result = await syncGoogleCalendarSource('source-1');

    expect(result.synced).toBe(0);
    expect(result.errors).toContain('No access token available');
  });

  it('refreshes token when expired', async () => {
    // Token expired 10 minutes ago
    const expiredSource = makeSource({
      tokenExpiresAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    mockFindFirst.mockResolvedValue(expiredSource);
    mockRefreshAccessToken.mockResolvedValue({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
    });

    await syncGoogleCalendarSource('source-1');

    expect(mockRefreshAccessToken).toHaveBeenCalledWith('decrypted_encrypted-refresh-token');
  });

  it('refreshes token when within 5-minute window', async () => {
    // Token expires in 3 minutes (within 5-minute refresh window)
    const soonExpiring = makeSource({
      tokenExpiresAt: new Date(Date.now() + 3 * 60 * 1000),
    });
    mockFindFirst.mockResolvedValue(soonExpiring);
    mockRefreshAccessToken.mockResolvedValue({
      access_token: 'new-token',
      expires_in: 3600,
    });

    await syncGoogleCalendarSource('source-1');

    expect(mockRefreshAccessToken).toHaveBeenCalled();
  });

  it('does not refresh token when well within validity', async () => {
    // Token expires in 30 minutes (well outside 5-minute window)
    const validSource = makeSource({
      tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    mockFindFirst.mockResolvedValue(validSource);

    await syncGoogleCalendarSource('source-1');

    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes token when tokenExpiresAt is null', async () => {
    const noExpiry = makeSource({ tokenExpiresAt: null });
    mockFindFirst.mockResolvedValue(noExpiry);
    mockRefreshAccessToken.mockResolvedValue({
      access_token: 'new-token',
      expires_in: 3600,
    });

    await syncGoogleCalendarSource('source-1');

    expect(mockRefreshAccessToken).toHaveBeenCalled();
  });

  it('returns error when refresh token is missing and token expired', async () => {
    const noRefresh = makeSource({
      tokenExpiresAt: new Date(Date.now() - 10 * 60 * 1000),
      refreshToken: null,
    });
    mockFindFirst.mockResolvedValue(noRefresh);

    const result = await syncGoogleCalendarSource('source-1');

    expect(result.synced).toBe(0);
    expect(result.errors).toContain('Token expired and no refresh token available');
  });

  it('syncs events and returns count', async () => {
    mockFindFirst.mockResolvedValue(makeSource());
    mockFetchCalendarEvents.mockResolvedValue([
      { id: 'event-1', summary: 'Meeting' },
      { id: 'event-2', summary: 'Lunch' },
    ]);
    mockConvertEvent.mockImplementation((event: { id: string; summary: string }) => ({
      externalEventId: event.id,
      title: event.summary,
      startTime: new Date(),
      endTime: new Date(),
    }));

    const result = await syncGoogleCalendarSource('source-1');

    expect(result.synced).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('continues syncing other events when one fails', async () => {
    mockFindFirst.mockResolvedValue(makeSource());
    mockFetchCalendarEvents.mockResolvedValue([
      { id: 'event-1', summary: 'Good Event' },
      { id: 'event-2', summary: 'Bad Event' },
      { id: 'event-3', summary: 'Another Good Event' },
    ]);

    let callCount = 0;
    mockConvertEvent.mockImplementation((event: { id: string; summary: string }) => {
      callCount++;
      if (callCount === 2) throw new Error('Conversion failed');
      return {
        externalEventId: event.id,
        title: event.summary,
        startTime: new Date(),
        endTime: new Date(),
      };
    });

    const result = await syncGoogleCalendarSource('source-1');

    expect(result.synced).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('event-2');
  });

  it('flags (pending deletion) events no longer in Google instead of deleting them', async () => {
    mockFindFirst.mockResolvedValue(makeSource());
    // Google only has event-1
    mockFetchCalendarEvents.mockResolvedValue([
      { id: 'event-1', summary: 'Still exists' },
    ]);
    mockConvertEvent.mockReturnValue({
      externalEventId: 'event-1',
      title: 'Still exists',
      startTime: new Date(),
      endTime: new Date(),
    });
    // Prism has event-1 and event-2 (event-2 was deleted from Google)
    mockFindMany.mockResolvedValue([
      { id: 'prism-1', externalEventId: 'event-1', title: 'Still exists' },
      { id: 'prism-2', externalEventId: 'event-2', title: 'Deleted from Google' },
    ]);

    await syncGoogleCalendarSource('source-1');

    // Deletes-only review: prism-2 is FLAGGED pending, not hard-deleted.
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ pendingDeletion: expect.any(Date) }),
    );
  });

  it('does not delete local-only events (no externalEventId)', async () => {
    mockFindFirst.mockResolvedValue(makeSource());
    mockFetchCalendarEvents.mockResolvedValue([]);
    // Prism has a local event (no externalEventId)
    mockFindMany.mockResolvedValue([
      { id: 'prism-local', externalEventId: null, title: 'Local Event' },
    ]);

    await syncGoogleCalendarSource('source-1');

    // Should NOT delete local events
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });
});

describe('syncGoogleCalendarSource — auto-disable gated on consecutive 404s (M-CALSYNC)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  /** The object handed to db.update().set() in the fetch-failure branch. */
  function lastSetArg() {
    return mockUpdateSet.mock.calls[0]![0] as {
      enabled?: boolean;
      syncErrors: { consecutive404: number; consecutiveFailures: number };
    };
  }

  it('does not auto-disable on the first 404 after transient (non-404) failures', async () => {
    // Two prior transient failures already reset the 404 streak to 0.
    mockFindFirst.mockResolvedValue(
      makeSource({ syncErrors: { consecutiveFailures: 2, consecutive404: 0 } }),
    );
    mockFetchCalendarEvents.mockRejectedValue(new Error('Google API error: 404 Not Found'));

    await syncGoogleCalendarSource('source-1');

    const set = lastSetArg();
    expect(set.syncErrors.consecutive404).toBe(1);
    expect(set.enabled).toBeUndefined(); // NOT disabled on the first real 404
  });

  it('auto-disables only after 3 consecutive 404s', async () => {
    mockFindFirst.mockResolvedValue(
      makeSource({ syncErrors: { consecutiveFailures: 5, consecutive404: 2 } }),
    );
    mockFetchCalendarEvents.mockRejectedValue(new Error('404 Not Found'));

    await syncGoogleCalendarSource('source-1');

    const set = lastSetArg();
    expect(set.syncErrors.consecutive404).toBe(3);
    expect(set.enabled).toBe(false);
  });

  it('resets the 404 streak on a non-404 failure', async () => {
    mockFindFirst.mockResolvedValue(
      makeSource({ syncErrors: { consecutiveFailures: 2, consecutive404: 2 } }),
    );
    mockFetchCalendarEvents.mockRejectedValue(new Error('500 Internal Server Error'));

    await syncGoogleCalendarSource('source-1');

    const set = lastSetArg();
    expect(set.syncErrors.consecutive404).toBe(0);
    expect(set.enabled).toBeUndefined();
  });

  it('never auto-disables a source the user manually re-enabled (userOverride)', async () => {
    mockFindFirst.mockResolvedValue(
      makeSource({ syncErrors: { consecutive404: 5, userOverride: true } }),
    );
    mockFetchCalendarEvents.mockRejectedValue(new Error('404 Not Found'));

    await syncGoogleCalendarSource('source-1');

    expect(lastSetArg().enabled).toBeUndefined();
  });
});

describe('syncAllGoogleCalendars', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchCalendarEvents.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);
  });

  it('syncs all enabled Google sources', async () => {
    // findMany for sources returns 2 calendars
    mockFindMany.mockResolvedValueOnce([
      makeSource({ id: 'source-1', dashboardCalendarName: 'Cal 1' }),
      makeSource({ id: 'source-2', dashboardCalendarName: 'Cal 2' }),
    ]);
    // findFirst for each sync call
    mockFindFirst.mockResolvedValue(makeSource());
    // findMany for event cleanup returns empty for each source
    mockFindMany.mockResolvedValue([]);

    const result = await syncAllGoogleCalendars();

    expect(result.total).toBe(0); // No events to sync
    expect(result.errors).toHaveLength(0);
  });

  it('isolates errors per-source', async () => {
    // findMany returns 2 sources
    mockFindMany.mockResolvedValueOnce([
      makeSource({ id: 'source-1', dashboardCalendarName: 'Good Cal' }),
      makeSource({ id: 'source-bad', dashboardCalendarName: 'Bad Cal' }),
    ]);

    // First source works, second throws
    let syncCallCount = 0;
    mockFindFirst.mockImplementation(() => {
      syncCallCount++;
      if (syncCallCount === 2) {
        return makeSource({ id: 'source-bad', accessToken: null });
      }
      return makeSource({ id: 'source-1' });
    });

    const result = await syncAllGoogleCalendars();

    // First source synced fine, second had error, but both were attempted
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// --- iCal sync ---

function makeIcalSource(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ical-source-1',
    provider: 'ical',
    icalUrl: 'https://example.com/calendar.ics',
    sourceCalendarId: 'ical_123',
    dashboardCalendarName: 'Test iCal',
    enabled: true,
    ...overrides,
  };
}

function makeVEvent(overrides: Record<string, unknown> = {}) {
  // Dates are relative to "now" so the event always lands inside the sync
  // window (~now-90d .. now+365d) no matter when the suite runs. A hardcoded
  // date silently drifts out of the window as real time passes, which made
  // these tests start failing months after they were written.
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    type: 'VEVENT',
    uid: 'event-uid-1',
    summary: 'Sample Event',
    description: 'desc',
    location: 'loc',
    start,
    end,
    datetype: 'date-time',
    ...overrides,
  };
}

describe('syncIcalCalendarSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it('returns error when source is not found', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await syncIcalCalendarSource('nonexistent');

    expect(result.synced).toBe(0);
    expect(result.errors).toContain('Calendar source not found');
  });

  it('returns error when provider is not ical', async () => {
    mockFindFirst.mockResolvedValue(makeIcalSource({ provider: 'google' }));

    const result = await syncIcalCalendarSource('ical-source-1');

    expect(result.synced).toBe(0);
    expect(result.errors).toContain('Not an iCal calendar source');
  });

  it('returns error when ical_url is missing', async () => {
    mockFindFirst.mockResolvedValue(makeIcalSource({ icalUrl: null }));

    const result = await syncIcalCalendarSource('ical-source-1');

    expect(result.synced).toBe(0);
    expect(result.errors).toContain('No iCal URL configured');
  });

  it('upserts a single non-recurring VEVENT', async () => {
    mockFindFirst.mockResolvedValue(makeIcalSource());
    mockIcalFromURL.mockResolvedValue({
      'event-uid-1': makeVEvent(),
    });

    const result = await syncIcalCalendarSource('ical-source-1');

    expect(result.synced).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        externalEventId: 'event-uid-1',
        title: 'Sample Event',
        recurring: false,
      })
    );
  });

  it('unwraps PropertyWithArgs objects on summary/description/location', async () => {
    // Real-world iCal feeds (e.g. Office Holidays) carry parameters on these
    // properties (`SUMMARY;LANGUAGE=en-us:...`), and node-ical surfaces those
    // as { params, val } objects rather than plain strings.
    mockFindFirst.mockResolvedValue(makeIcalSource());
    mockIcalFromURL.mockResolvedValue({
      'event-uid-1': makeVEvent({
        summary: { params: { LANGUAGE: 'en-us' }, val: "New Year's Day" },
        description: { params: { ALTREP: 'cid:foo' }, val: 'Federal holiday' },
        location: { params: {}, val: 'USA' },
      }),
    });

    const result = await syncIcalCalendarSource('ical-source-1');

    expect(result.synced).toBe(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New Year's Day",
        description: 'Federal holiday',
        location: 'USA',
      })
    );
  });

  it('skips CANCELLED VEVENTs', async () => {
    mockFindFirst.mockResolvedValue(makeIcalSource());
    mockIcalFromURL.mockResolvedValue({
      'event-uid-1': makeVEvent({ status: 'CANCELLED' }),
    });

    const result = await syncIcalCalendarSource('ical-source-1');

    expect(result.synced).toBe(0);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('records consecutiveFailures on fetch failure', async () => {
    mockFindFirst.mockResolvedValue(makeIcalSource());
    mockIcalFromURL.mockRejectedValue(new Error('connection refused'));

    const result = await syncIcalCalendarSource('ical-source-1');

    expect(result.synced).toBe(0);
    expect(result.errors[0]).toContain('connection refused');
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        syncErrors: expect.objectContaining({
          consecutiveFailures: 1,
          lastError: expect.stringContaining('connection refused'),
        }),
      })
    );
  });

  it('unwraps PropertyWithArgs objects on UID and uses the inner string for the externalEventId', async () => {
    // Some iCal feeds carry parameters on UID too (rare, observed on a
    // handful of corporate Outlook exports). node-ical surfaces those as
    // { params, val } objects. Without unwrapping, instanceExternalId
    // would produce "[object Object]_<ts>" and collide across instances.
    mockFindFirst.mockResolvedValue(makeIcalSource());
    mockIcalFromURL.mockResolvedValue({
      'wrapped-uid': makeVEvent({
        uid: { params: {}, val: 'real-uid-123' },
      }),
    });

    const result = await syncIcalCalendarSource('ical-source-1');

    expect(result.synced).toBe(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        externalEventId: 'real-uid-123',
      }),
    );
  });

  it('skips VEVENTs with missing or non-string UID and reports the error', async () => {
    mockFindFirst.mockResolvedValue(makeIcalSource());
    mockIcalFromURL.mockResolvedValue({
      'no-uid': makeVEvent({ uid: null }),
    });

    const result = await syncIcalCalendarSource('ical-source-1');

    expect(result.synced).toBe(0);
    expect(result.errors[0]).toContain('UID');
  });

  it('writes recurrenceRule null on per-instance rows even when the VEVENT has an RRULE', async () => {
    // Per-instance rows are keyed on the expanded externalEventId and
    // should not carry the master RRULE string. Consumers reading
    // recurrenceRule expect "this row is the recurring master," so per-
    // instance rows must clear it. recurring stays true to preserve the
    // boolean signal.
    const fakeRrule = {
      between: () => [new Date('2026-05-10T10:00:00Z')],
      toString: () => 'FREQ=WEEKLY;COUNT=10',
    };
    mockFindFirst.mockResolvedValue(makeIcalSource());
    mockIcalFromURL.mockResolvedValue({
      'event-uid-1': makeVEvent({ rrule: fakeRrule }),
    });

    const result = await syncIcalCalendarSource('ical-source-1');

    expect(result.synced).toBe(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        recurring: true,
        recurrenceRule: null,
      }),
    );
  });

  it('rejects an icalUrl that points at a private address (SSRF guard)', async () => {
    // Force production so the dev-mode loopback escape hatch does not
    // interfere with this assertion.
    jest.replaceProperty(process.env, 'NODE_ENV', 'production');

    mockFindFirst.mockResolvedValue(makeIcalSource({ icalUrl: 'http://10.0.0.5/cal.ics' }));

    const result = await syncIcalCalendarSource('ical-source-1');

    expect(result.synced).toBe(0);
    expect(result.errors[0]).toMatch(/private|loopback/);
    // Critically: the upstream fetch should never have been attempted.
    expect(mockIcalFromURL).not.toHaveBeenCalled();
  });
});
