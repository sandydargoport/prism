/**
 * GET /api/household-time: the zone, today's date in it, and the week start.
 */

const mockGetDisplayAuth = jest.fn();
const mockGetHouseholdTimezone = jest.fn();
const mockWhere = jest.fn();

jest.mock('@/lib/auth', () => ({ getDisplayAuth: () => mockGetDisplayAuth() }));
jest.mock('@/lib/householdTimezone', () => ({ getHouseholdTimezone: () => mockGetHouseholdTimezone() }));
jest.mock('@/lib/db/client', () => ({
  db: { select: () => ({ from: () => ({ where: (...a: unknown[]) => mockWhere(...a) }) }) },
}));
jest.mock('@/lib/db/schema', () => ({ settings: { key: 'key', value: 'value' } }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET } from '../route';

describe('GET /api/household-time', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetDisplayAuth.mockResolvedValue({ userId: 'u1', role: 'parent', scopes: ['*'] });
    mockWhere.mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  it('refuses a caller with no identity', async () => {
    mockGetDisplayAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("reports today in the household zone, not the server's", async () => {
    // 03:30 UTC on 1 Oct is still the evening of 30 Sep in Chicago.
    jest.setSystemTime(new Date('2026-10-01T03:30:00Z'));
    mockGetHouseholdTimezone.mockResolvedValue('America/Chicago');

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      timeZone: 'America/Chicago',
      today: '2026-09-30',
      now: '2026-10-01T03:30:00.000Z',
      weekStartsOn: 0,
    });
  });

  it('is already tomorrow east of UTC', async () => {
    jest.setSystemTime(new Date('2026-09-30T20:00:00Z'));
    mockGetHouseholdTimezone.mockResolvedValue('Asia/Tokyo');
    mockWhere.mockResolvedValue([{ key: 'weekStartsOn', value: '1' }]);

    const body = await (await GET()).json();
    expect(body.today).toBe('2026-10-01');
    expect(body.weekStartsOn).toBe(1);
  });
});
