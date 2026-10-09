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
const mockFindFirstEvent = jest.fn();
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
      events: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
        findFirst: (...args: unknown[]) => mockFindFirstEvent(...args),
      },
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
  settings: { key: 'key' },
}));

const mockFetchCalendarEvents = jest.fn();
const mockRefreshAccessToken = jest.fn();
const mockConvertEvent = jest.fn();
const mockFetchCalendarList = jest.fn();

jest.mock('@/lib/integrations/google-calendar', () => ({
  fetchCalendarEvents: (...args: unknown[]) => mockFetchCalendarEvents(...args),
  fetchCalendarList: (...args: unknown[]) => mockFetchCalendarList(...args),
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
  convertGoogleEventToInternal: (...args: unknown[]) => mockConvertEvent(...args),
  DISMISSED_GOOGLE_CALENDARS_KEY: 'dismissedGoogleCalendarIds',
}));

jest.mock('@/lib/utils/crypto', () => ({
  decrypt: (val: string) => `decrypted_${val}`,
  encrypt: (val: string) => `encrypted_${val}`,
}));

const mockIcalFromURL = jest.fn();
const mockFetchCalDAVEvents = jest.fn();

jest.mock('@/lib/integrations/caldav', () => ({
  fetchCalDAVEvents: (...args: unknown[]) => mockFetchCalDAVEvents(...args),
  fetchCalDAVTasks: jest.fn(),
}));

jest.mock('@/lib/householdTimezone', () => ({
  getHouseholdTimezone: jest.fn().mockResolvedValue('UTC'),
}));

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
  syncCalDAVCalendarSource,
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

  it('discovers a calendar newly shared with the account and inserts it', async () => {
    // One known source for this Google account ("primary"). Google now also
    // reports a second calendar ("shared-cal") that has no row yet — e.g.
    // someone just shared it with this account.
    const knownSource = makeSource({ id: 'source-1', sourceCalendarId: 'primary', dashboardCalendarName: 'Kosta' });
    mockFindMany.mockResolvedValueOnce([knownSource]); // enabled sources
    mockFindMany.mockResolvedValueOnce([knownSource]); // all google sources (dedup set)
    mockFindFirst.mockResolvedValue(makeSource({ id: 'source-1', sourceCalendarId: 'primary' }));
    mockFetchCalendarList.mockResolvedValue([
      { id: 'primary', summary: 'Kosta', accessRole: 'owner', hidden: false },
      { id: 'shared-cal', summary: 'Sandra', accessRole: 'owner', hidden: false },
    ]);

    await syncAllGoogleCalendars();

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        sourceCalendarId: 'shared-cal',
        dashboardCalendarName: 'Sandra',
        enabled: true,
      })
    );
    // The already-known calendar must not be re-inserted.
    expect(mockInsertValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceCalendarId: 'primary' })
    );
  });

  it('does not re-insert a calendar that exists but is disabled', async () => {
    // "weeknum" was discovered previously and then disabled in Manage
    // Calendars, so it's absent from the enabled-only `sources` list but
    // still has a row — it must not be treated as newly-discovered.
    const enabledSource = makeSource({ id: 'source-1', sourceCalendarId: 'primary' });
    const disabledSource = makeSource({ id: 'source-2', sourceCalendarId: 'weeknum', enabled: false });
    mockFindMany.mockResolvedValueOnce([enabledSource]); // enabled sources only
    mockFindMany.mockResolvedValueOnce([enabledSource, disabledSource]); // all google sources
    mockFindFirst.mockResolvedValue(enabledSource);
    mockFetchCalendarList.mockResolvedValue([
      { id: 'primary', summary: 'Kosta', accessRole: 'owner', hidden: false },
      { id: 'weeknum', summary: 'Kalenderwochen', accessRole: 'reader', hidden: false },
    ]);

    await syncAllGoogleCalendars();

    expect(mockInsertValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceCalendarId: 'weeknum' })
    );
  });

  it('does not resurrect a calendar the user previously dismissed', async () => {
    const knownSource = makeSource({ id: 'source-1', sourceCalendarId: 'primary' });
    mockFindMany.mockResolvedValueOnce([knownSource]);
    mockFindMany.mockResolvedValueOnce([knownSource]);
    mockFindFirst.mockResolvedValue(knownSource);
    mockFetchCalendarList.mockResolvedValue([
      { id: 'primary', summary: 'Kosta', accessRole: 'owner', hidden: false },
      { id: 'dismissed-cal', summary: 'Removed One', accessRole: 'reader', hidden: false },
    ]);
    // settings.select(...).from(...).where(...) — dismissed tombstone list
    mockSelect.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ value: [{ id: 'dismissed-cal', name: 'Removed One' }] }]),
      }),
    });

    await syncAllGoogleCalendars();

    expect(mockInsertValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceCalendarId: 'dismissed-cal' })
    );
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

// --- iCal all-day events under a non-UTC server timezone (#518) ---

describe('syncIcalCalendarSource all-day dates', () => {
  const { eventOccursOnDisplayDay } = jest.requireActual('@/lib/utils/timeFormat') as typeof import('@/lib/utils/timeFormat');
  const realIcal = jest.requireActual('node-ical') as typeof import('node-ical');
  // Jest sandboxes process.env, so the zone cannot be switched per test. The
  // suite runs in the runner's zone; `npm run test:tz` (and CI) repeats it in
  // zones on both sides of UTC, where node-ical builds DATE values off midnight.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const ICS = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:one-day@example.com',
    'DTSTART;VALUE=DATE:20260906',
    'DTEND;VALUE=DATE:20260907',
    'SUMMARY:Sample birthday',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:weekly@example.com',
    'DTSTART;VALUE=DATE:20260901',
    'DTEND;VALUE=DATE:20260902',
    'RRULE:FREQ=WEEKLY;COUNT=3',
    'EXDATE;VALUE=DATE:20260908',
    'SUMMARY:Sample weekly',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  describe(`in the runner's zone (${tz})`, () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockFindMany.mockResolvedValue([]);
      mockFindFirst.mockResolvedValue(makeIcalSource());
      // Parse under the zone, as the server would: node-ical builds DATE
      // values at local midnight.
      mockIcalFromURL.mockResolvedValue(realIcal.sync.parseICS(ICS));
    });

    async function syncedRows() {
      await syncIcalCalendarSource('ical-source-1', {
        timeMin: new Date('2026-08-01T00:00:00Z'),
        timeMax: new Date('2026-10-01T00:00:00Z'),
      });
      return mockInsertValues.mock.calls.map(([row]) => row as {
        externalEventId: string; startTime: Date; endTime: Date; allDay: boolean;
      });
    }

    it('stores a one-day VALUE=DATE event as a floating UTC-midnight range', async () => {
      const row = (await syncedRows()).find((r) => r.externalEventId === 'one-day@example.com')!;
      expect(row.allDay).toBe(true);
      expect(row.startTime.toISOString()).toBe('2026-09-06T00:00:00.000Z');
      expect(row.endTime.toISOString()).toBe('2026-09-07T00:00:00.000Z');
    });

    it('renders the one-day event on its own day only', async () => {
      const row = (await syncedRows()).find((r) => r.externalEventId === 'one-day@example.com')!;
      const on = (d: number) => eventOccursOnDisplayDay(row.startTime, row.endTime, true, new Date(2026, 8, d), tz);
      expect([on(5), on(6), on(7)]).toEqual([false, true, false]);
    });

    it('stores expanded all-day occurrences at UTC midnight and honours EXDATE', async () => {
      const rows = (await syncedRows()).filter((r) => r.externalEventId.startsWith('weekly@example.com'));
      expect(rows.map((r) => r.startTime.toISOString())).toEqual([
        '2026-09-01T00:00:00.000Z',
        '2026-09-15T00:00:00.000Z',
      ]);
      expect(rows.map((r) => r.endTime.toISOString())).toEqual([
        '2026-09-02T00:00:00.000Z',
        '2026-09-16T00:00:00.000Z',
      ]);
    });

    it('keys expanded all-day occurrences on their date, not server-local midnight', async () => {
      const ids = (await syncedRows())
        .map((r) => r.externalEventId)
        .filter((id) => id.startsWith('weekly@example.com'));
      expect(ids).toEqual([
        'weekly@example.com_2026-09-01T00:00:00.000Z',
        'weekly@example.com_2026-09-15T00:00:00.000Z',
      ]);
    });

    it('renames a row stored under the older server-local id instead of replacing it', async () => {
      const legacyId = `weekly@example.com_${new Date(2026, 8, 1).toISOString()}`;
      const currentId = 'weekly@example.com_2026-09-01T00:00:00.000Z';
      mockFindMany.mockResolvedValue([{
        externalEventId: legacyId,
        title: 'Sample weekly',
        description: null,
        location: null,
        startTime: new Date('2026-09-01T00:00:00Z'),
        endTime: new Date('2026-09-02T00:00:00Z'),
        allDay: true,
        recurring: true,
        recurrenceRule: null,
      }]);
      await syncedRows();
      const renamed = mockUpdateSet.mock.calls.some(([set]) => set?.externalEventId === currentId);
      // On a UTC server the two ids are the same string and nothing moves.
      expect(renamed).toBe(legacyId !== currentId);
    });
  });
});

// A hidden event (#592) keeps hidden_at only because no sync path writes it.
// Each provider names the columns it overwrites; these pin that it never names
// hiddenAt, so a sync cannot unhide what a parent hid.
describe('sync leaves hiddenAt alone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it('Google: neither the insert nor the conflict update touches hiddenAt', async () => {
    mockFindFirst.mockResolvedValue(makeSource());
    mockFetchCalendarEvents.mockResolvedValue([{ id: 'event-1', summary: 'Meeting' }]);
    mockConvertEvent.mockReturnValue({
      externalEventId: 'event-1', title: 'Meeting', startTime: new Date(), endTime: new Date(),
    });

    await syncGoogleCalendarSource('source-1');

    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsertValues.mock.calls[0][0]).not.toHaveProperty('hiddenAt');
    expect(mockOnConflictDoUpdate.mock.calls[0][0].set).not.toHaveProperty('hiddenAt');
  });

  it('iCal: neither the insert nor the conflict update touches hiddenAt', async () => {
    mockFindFirst.mockResolvedValue(makeIcalSource());
    mockIcalFromURL.mockResolvedValue({ 'event-uid-1': makeVEvent() });

    await syncIcalCalendarSource('ical-source-1');

    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsertValues.mock.calls[0][0]).not.toHaveProperty('hiddenAt');
    expect(mockOnConflictDoUpdate.mock.calls[0][0].set).not.toHaveProperty('hiddenAt');
  });

  it('CalDAV: updating an existing row does not touch hiddenAt', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'caldav-1',
      provider: 'caldav',
      accessToken: 'enc',
      sourceCalendarId: '/cal/',
      providerConfig: { serverUrl: 'https://dav.example.test', username: 'someone' },
    });
    const start = new Date(Date.now() + 86_400_000);
    mockFetchCalDAVEvents.mockResolvedValue([{
      uid: 'uid-1', title: 'Swim practice', startTime: start, endTime: new Date(start.getTime() + 3_600_000),
      allDay: false, recurring: false, recurrenceRule: null, href: '/cal/uid-1.ics', etag: '"1"',
    }]);
    mockFindFirstEvent.mockResolvedValue({ id: 'row-1', title: 'Swim practice', hiddenAt: new Date() });

    await syncCalDAVCalendarSource('caldav-1');

    const eventWrites = mockUpdateSet.mock.calls
      .map(([v]) => v as Record<string, unknown>)
      .filter((v) => 'title' in v);
    expect(eventWrites).toHaveLength(1);
    expect(eventWrites[0]).not.toHaveProperty('hiddenAt');
  });
});

// A hidden series matches occurrences on (calendarSourceId, seriesKey), so the
// key has to be written on insert AND refreshed on update: rows synced before
// the column existed pick it up on their next sync.
describe('sync records the series key', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it('Google: writes the converted seriesKey on insert and update', async () => {
    mockFindFirst.mockResolvedValue(makeSource());
    mockFetchCalendarEvents.mockResolvedValue([{ id: 'event-1_20261005', summary: 'Piano' }]);
    mockConvertEvent.mockReturnValue({
      externalEventId: 'event-1_20261005', title: 'Piano', startTime: new Date(), endTime: new Date(),
      seriesKey: 'event-1',
    });

    await syncGoogleCalendarSource('source-1');

    expect(mockInsertValues.mock.calls[0][0]).toMatchObject({ seriesKey: 'event-1' });
    expect(mockOnConflictDoUpdate.mock.calls[0][0].set).toMatchObject({ seriesKey: 'event-1' });
  });

  it('iCal: every occurrence of a recurring VEVENT carries its UID', async () => {
    const fakeRrule = {
      between: () => [new Date('2026-05-10T10:00:00Z'), new Date('2026-05-17T10:00:00Z')],
      toString: () => 'FREQ=WEEKLY;COUNT=10',
    };
    mockFindFirst.mockResolvedValue(makeIcalSource());
    mockIcalFromURL.mockResolvedValue({ 'event-uid-1': makeVEvent({ rrule: fakeRrule }) });

    await syncIcalCalendarSource('ical-source-1');

    expect(mockInsertValues).toHaveBeenCalledTimes(2);
    for (const [row] of mockInsertValues.mock.calls) {
      expect(row).toMatchObject({ seriesKey: 'event-uid-1' });
    }
    for (const [conflict] of mockOnConflictDoUpdate.mock.calls) {
      expect(conflict.set).toMatchObject({ seriesKey: 'event-uid-1' });
    }
  });

  it('iCal: a one-off event has no series', async () => {
    mockFindFirst.mockResolvedValue(makeIcalSource());
    mockIcalFromURL.mockResolvedValue({ 'event-uid-1': makeVEvent() });

    await syncIcalCalendarSource('ical-source-1');

    expect(mockInsertValues.mock.calls[0][0]).toMatchObject({ seriesKey: null });
  });

  const caldavSource = {
    id: 'caldav-1',
    provider: 'caldav',
    accessToken: 'enc',
    sourceCalendarId: '/cal/',
    providerConfig: { serverUrl: 'https://dav.example.test', username: 'someone' },
  };
  const caldavOccurrence = (over: Record<string, unknown> = {}) => {
    const start = new Date(Date.now() + 86_400_000);
    return {
      uid: `swim@example.com_${start.toISOString()}`, title: 'Swim practice', description: null, location: null,
      startTime: start, endTime: new Date(start.getTime() + 3_600_000), allDay: false, color: null,
      recurring: true, recurrenceRule: 'FREQ=WEEKLY', href: '/cal/swim.ics', etag: '"1"',
      seriesKey: 'swim@example.com', ...over,
    };
  };

  it('CalDAV: writes the series key on insert', async () => {
    mockFindFirst.mockResolvedValue(caldavSource);
    mockFetchCalDAVEvents.mockResolvedValue([caldavOccurrence()]);
    mockFindFirstEvent.mockResolvedValue(undefined);

    await syncCalDAVCalendarSource('caldav-1');

    expect(mockInsertValues.mock.calls[0][0]).toMatchObject({ seriesKey: 'swim@example.com' });
  });

  // Older builds stored an edited occurrence under the bare UID (#593). The
  // row is renamed in place, so a hide already set on it survives.
  it('CalDAV: renames an edit stored under the bare UID and adds the series key', async () => {
    const occ = caldavOccurrence({ legacyUid: 'swim@example.com' });
    mockFindFirst.mockResolvedValue(caldavSource);
    mockFetchCalDAVEvents.mockResolvedValue([occ]);
    mockFindFirstEvent
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'row-1', title: 'Swim practice', hiddenAt: new Date() });

    await syncCalDAVCalendarSource('caldav-1');

    expect(mockInsertValues).not.toHaveBeenCalled();
    const eventWrites = mockUpdateSet.mock.calls
      .map(([v]) => v as Record<string, unknown>)
      .filter((v) => 'title' in v);
    expect(eventWrites).toHaveLength(1);
    expect(eventWrites[0]).toMatchObject({ externalEventId: occ.uid, seriesKey: 'swim@example.com', recurring: true });
    expect(eventWrites[0]).not.toHaveProperty('hiddenAt');
  });
});
