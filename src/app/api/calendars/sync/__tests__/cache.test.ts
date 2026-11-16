/**
 * A manual calendar sync shows its result at once (#1226): it writes events
 * and, for CalDAV, to-dos into tasks, so it drops both cached lists, also when
 * every source reported an error (rows may still have been written).
 */
const mockInvalidate = jest.fn();
const mockSync = jest.fn();

jest.mock('@/lib/auth', () => ({ requireAuth: () => Promise.resolve({ userId: 'u1', role: 'parent' }) }));
jest.mock('@/lib/cache/cacheKeys', () => ({
  invalidateEntity: (e: unknown) => mockInvalidate(e),
  invalidateEntities: (...a: unknown[]) => a.forEach((e) => mockInvalidate(e)),
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/db/schema', () => ({ calendarSources: { id: 'id' } }));
jest.mock('drizzle-orm', () => ({ eq: () => ({}) }));
jest.mock('@/lib/db/client', () => ({
  db: { query: { calendarSources: { findFirst: () => Promise.resolve({ id: 'c1', provider: 'caldav' }) } } },
}));
jest.mock('@/lib/services/calendar-sync', () => {
  const one = () => mockSync();
  return {
    syncAllGoogleCalendars: one,
    syncAllIcalCalendars: one,
    syncAllCalDAVCalendars: one,
    syncGoogleCalendarSource: one,
    syncIcalCalendarSource: one,
    syncCalDAVCalendarSource: one,
  };
});

import { NextRequest } from 'next/server';
import { POST } from '../route';

const req = (body: unknown) =>
  new NextRequest('http://localhost/api/calendars/sync', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => jest.clearAllMocks());

describe('POST /api/calendars/sync drops cached events and tasks', () => {
  it('after a sync of every calendar', async () => {
    mockSync.mockResolvedValue({ total: 2, added: 1, updated: 0, removed: 0, errors: [] });
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    expect(mockInvalidate).toHaveBeenCalledWith('events');
    expect(mockInvalidate).toHaveBeenCalledWith('tasks');
  });

  it('after a sync of one calendar', async () => {
    mockSync.mockResolvedValue({ synced: 1, added: 0, updated: 1, removed: 0, errors: [] });
    const res = await POST(req({ calendarId: 'c1' }));
    expect(res.status).toBe(200);
    expect(mockInvalidate).toHaveBeenCalledWith('events');
    expect(mockInvalidate).toHaveBeenCalledWith('tasks');
  });

  it('also when every source reported an error', async () => {
    mockSync.mockResolvedValue({ synced: 0, added: 0, updated: 0, removed: 0, errors: ['timeout'] });
    const res = await POST(req({ calendarId: 'c1' }));
    expect(res.status).toBe(500);
    expect(mockInvalidate).toHaveBeenCalledWith('events');
    expect(mockInvalidate).toHaveBeenCalledWith('tasks');
  });
});
