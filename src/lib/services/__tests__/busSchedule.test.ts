/**
 * A bus route's scheduled time is a household wall-clock time. setHours() on
 * the server's clock made a 07:30 route 07:30 UTC, which is 02:30 in Chicago,
 * so its tracking window and "overdue" check ran five hours early.
 */
jest.mock('@/lib/db/client', () => ({ db: {} }));
jest.mock('@/lib/householdTimezone', () => ({ getHouseholdTimezone: jest.fn(async () => 'America/Chicago') }));

import { isWithinBusWindow, scheduledInstantToday } from '../bus-tracking-sync';

const CHICAGO = 'America/Chicago';

describe('bus schedule in the household zone', () => {
  it('places a 07:30 route at 07:30 household time', () => {
    const now = new Date('2026-09-28T11:00:00Z'); // 06:00 CDT
    expect(scheduledInstantToday('07:30', CHICAGO, now)?.toISOString()).toBe('2026-09-28T12:30:00.000Z');
  });

  it('is inside the window around the household time, not the UTC one', () => {
    expect(isWithinBusWindow('07:30', CHICAGO, 30, new Date('2026-09-28T12:40:00Z'))).toBe(true); // 07:40 CDT
    expect(isWithinBusWindow('07:30', CHICAGO, 30, new Date('2026-09-28T07:35:00Z'))).toBe(false); // 02:35 CDT
  });

  it('treats a malformed time as outside any window', () => {
    expect(scheduledInstantToday('7h30', CHICAGO)).toBeNull();
    expect(isWithinBusWindow('7h30', CHICAGO)).toBe(false);
  });
});
