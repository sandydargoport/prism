/**
 * Storage rules for a Google calendar connection, focused on the one thing the
 * row must get right: whether Prism offers an event form for it.
 *
 * `showInEventModal` is what AddEventModal filters on. Getting it wrong does
 * not fail at connect time; it fails weeks later when someone types an event
 * and submits it, which is the failure mode this area keeps producing.
 */
const mockFindFirst = jest.fn();
const insertValuesSpy = jest.fn();
const updateSetSpy = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    query: { calendarSources: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
    insert: () => ({ values: (v: unknown) => { insertValuesSpy(v); return Promise.resolve(); } }),
    update: () => ({ set: (v: unknown) => { updateSetSpy(v); return { where: () => Promise.resolve() }; } }),
  },
}));
jest.mock('@/lib/db/schema', () => ({ calendarSources: { id: 'id', provider: 'provider', sourceCalendarId: 'src' } }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }));
jest.mock('@/lib/utils/crypto', () => ({ encrypt: (v: string) => `enc(${v})` }));
jest.mock('@/lib/services/settingsTombstone', () => ({ tombstoneIdSet: () => Promise.resolve(new Set()) }));

const mockFetchList = jest.fn();
jest.mock('@/lib/integrations/google-calendar', () => ({
  __esModule: true,
  DISMISSED_GOOGLE_CALENDARS_KEY: 'dismissed',
  fetchCalendarList: (...a: unknown[]) => mockFetchList(...a),
}));

import { storeGoogleCalendarConnection } from '../googleCalendarStore';

const tokens = { accessToken: 'at', refreshToken: 'rt', expiresIn: 3600 };
const base = { userId: 'u1', tokens, accountEmail: 'user@example.com' };

/** A calendar the account fully owns — the strongest case for writability. */
const OWNED = { id: 'c1', summary: 'Family', accessRole: 'owner', primary: true, hidden: false };

beforeEach(() => {
  jest.clearAllMocks();
  mockFindFirst.mockResolvedValue(undefined);
  mockFetchList.mockResolvedValue([OWNED]);
});

describe('storeGoogleCalendarConnection — new rows', () => {
  it('offers the event form for an owned calendar on a writable token', async () => {
    await storeGoogleCalendarConnection(base);
    expect(insertValuesSpy.mock.calls[0][0].showInEventModal).toBe(true);
  });

  it('does NOT offer it on a read-only token, even for an owned calendar', async () => {
    // accessRole is the ACCOUNT's right, not the TOKEN's. Trusting it here is
    // exactly how a read-only connection ends up with an event form that 403s.
    await storeGoogleCalendarConnection({ ...base, readOnly: true });
    expect(insertValuesSpy.mock.calls[0][0].showInEventModal).toBe(false);
  });

  it('still stores the calendar itself — read-only means read, not skip', async () => {
    const result = await storeGoogleCalendarConnection({ ...base, readOnly: true });
    expect(insertValuesSpy).toHaveBeenCalledTimes(1);
    expect(result.calendarCount).toBe(1);
    expect(insertValuesSpy.mock.calls[0][0].enabled).toBe(true);
  });

  it('defaults to writable when the flag is omitted (existing callers unchanged)', async () => {
    await storeGoogleCalendarConnection(base);
    expect(insertValuesSpy.mock.calls[0][0].showInEventModal).toBe(true);
  });
});

describe('storeGoogleCalendarConnection — existing rows', () => {
  beforeEach(() => mockFindFirst.mockResolvedValue({ id: 'row1', syncErrors: null }));

  it('revokes the event form when reconnecting read-only', async () => {
    await storeGoogleCalendarConnection({ ...base, readOnly: true });
    expect(updateSetSpy.mock.calls[0][0].showInEventModal).toBe(false);
  });

  it('leaves the setting alone when reconnecting writable', async () => {
    // Asymmetric on purpose: losing write access is a fact worth forcing, but
    // re-ticking a box the user deliberately cleared would be overreach.
    await storeGoogleCalendarConnection(base);
    expect(updateSetSpy.mock.calls[0][0]).not.toHaveProperty('showInEventModal');
  });
});
