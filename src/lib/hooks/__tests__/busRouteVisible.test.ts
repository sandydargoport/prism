/**
 * A route's weekdays and scheduled time are household wall-clock values. The
 * widget shows a route for an hour either side of it, judged in the household
 * zone whatever zone the device is in.
 */
import { isRouteVisible, type BusRouteStatus } from '../useBusTracking';

function route(scheduledTime: string, activeDays: number[]): BusRouteStatus {
  return { scheduledTime, activeDays } as unknown as BusRouteStatus;
}

const WEEKDAYS = [1, 2, 3, 4, 5];

describe('isRouteVisible', () => {
  // Monday 28 Sep 2026, 07:10 in Chicago (12:10Z).
  const mondayMorning = new Date('2026-09-28T12:10:00Z');

  it('shows a 07:30 route at 07:10 household time', () => {
    expect(isRouteVisible(route('07:30', WEEKDAYS), 'America/Chicago', mondayMorning)).toBe(true);
  });

  it('hides it outside the hour either side', () => {
    const later = new Date('2026-09-28T14:40:00Z'); // 09:40 in Chicago
    expect(isRouteVisible(route('07:30', WEEKDAYS), 'America/Chicago', later)).toBe(false);
  });

  it('reads the weekday in the household zone', () => {
    // 20:00 Sunday in Chicago is already Monday in UTC: a Monday route at
    // 20:30 must not show on Sunday evening.
    const sundayEvening = new Date('2026-09-28T01:00:00Z');
    expect(isRouteVisible(route('20:30', WEEKDAYS), 'America/Chicago', sundayEvening)).toBe(false);
    expect(isRouteVisible(route('20:30', [0]), 'America/Chicago', sundayEvening)).toBe(true);
  });

  it('accepts an unpadded hour', () => {
    expect(isRouteVisible(route('7:30', WEEKDAYS), 'America/Chicago', mondayMorning)).toBe(true);
  });

  it('hides the route rather than throwing on a bad zone', () => {
    expect(isRouteVisible(route('07:30', WEEKDAYS), 'Not/AZone', mondayMorning)).toBe(false);
  });
});
