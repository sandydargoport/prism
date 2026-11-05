/**
 * @jest-environment node
 */

/**
 * GET /api/calendars (#809): the wall and children see each calendar without
 * the CalDAV server and username or the raw sync error; parents see all.
 */
import { NextResponse } from 'next/server';

let parent = false;
const row = {
  id: 'c1', provider: 'caldav', sourceCalendarId: 'x', dashboardCalendarName: 'Work', displayName: null, color: '#123456',
  enabled: true, showInEventModal: true, isFamily: false, groupId: null, lastSynced: null,
  syncErrors: { lastError: 'connect refused by server.example.org', consecutiveFailures: 2, needsReauth: true },
  providerConfig: { serverUrl: 'https://dav.example.org', username: 'someone', lifeEventsCalendar: true },
  displayRules: null, createdAt: new Date('2026-01-01T00:00:00Z'), userId: null, userName: null, userColor: null, groupName: null, groupColor: null,
};

jest.mock('@/lib/auth', () => ({
  getDisplayAuth: async () => ({ userId: 'u', role: parent ? 'parent' : 'guest' }),
  requireAuth: jest.fn(),
  requireRole: () => (parent ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 })),
}));
let call = 0;
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: () => {
        call++;
        // The first read is the members list (empty: nothing to seed), the second the calendars.
        const p = Promise.resolve([] as unknown[]) as unknown as Promise<unknown[]> & { leftJoin: () => unknown };
        p.leftJoin = () => ({ leftJoin: () => ({ orderBy: async () => [row] }) });
        return p;
      },
    }),
  },
}));
jest.mock('@/lib/db/schema', () => ({ calendarSources: {}, users: {}, calendarGroups: {} }));
jest.mock('drizzle-orm', () => ({ eq: () => ({}), asc: () => ({}) }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET } from '../route';

async function list() {
  call = 0;
  return (await (await GET()).json()).calendars[0];
}

describe('GET /api/calendars read scope (#809)', () => {
  it('gives the wall the flags, not the server details', async () => {
    parent = false;
    const cal = await list();
    expect(cal.providerConfig).toEqual({ lifeEventsCalendar: true });
    expect(cal.syncErrors).toEqual({ consecutiveFailures: 2, needsReauth: true });
  });

  it('gives a parent everything', async () => {
    parent = true;
    const cal = await list();
    expect(cal.providerConfig).toEqual(row.providerConfig);
    expect(cal.syncErrors).toEqual(row.syncErrors);
  });
});
