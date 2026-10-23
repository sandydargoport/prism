import { pickRiderStop, projectStops } from '../bus-eta';
import type { LiveTrackStop } from '@/lib/db/schema';

const at = (hhmm: string) => `2026-03-02T${hhmm}:00Z`;
const stops: LiveTrackStop[] = [
  { key: 'a', name: 'Maple', order: 0, lat: 1, lng: 1, plannedAt: at('13:00') },
  { key: 'b', name: 'Cedar', order: 1, lat: 1, lng: 2, plannedAt: at('13:05') },
  { key: 'c', name: 'Willow', order: 2, lat: 1, lng: 3, plannedAt: at('13:10') },
  { key: 'school', name: 'Example Elementary', order: 3, lat: 1, lng: 4, plannedAt: at('13:20'), kind: 'school' },
];
const visit = (stopKey: string, arrived: string) => ({ stopKey, arrivedAt: new Date(at(arrived)), departedAt: null });

describe('projectStops', () => {
  it('shifts upcoming stops by the lateness at the last stop reached', () => {
    const p = projectStops(stops, [visit('a', '13:03')], null, new Date(at('13:04')));
    expect(p.shiftMs).toBe(3 * 60_000);
    expect(p.stops.map((s) => s.passed)).toEqual([true, false, false, false]);
    expect(p.stops[0]!.arrivedAt).toBe(at('13:03').replace('Z', '.000Z'));
    expect(p.stops[0]!.projectedAt).toBeNull();
    expect(p.stops[1]!.projectedAt).toBe(new Date(at('13:08')).toISOString());
    expect(p.stops[3]!.projectedAt).toBe(new Date(at('13:23')).toISOString());
  });

  it('counts an early bus as early', () => {
    const p = projectStops(stops, [visit('a', '12:58')], null, new Date(at('12:59')));
    expect(p.shiftMs).toBe(-2 * 60_000);
    expect(p.stops[1]!.projectedAt).toBe(new Date(at('13:03')).toISOString());
  });

  it('pushes everything later once the next stop is overdue', () => {
    // On time at the first stop, but it is now 13:09 and the 13:05 stop has not been reached.
    const p = projectStops(stops, [visit('a', '13:00')], null, new Date(at('13:09')));
    expect(p.shiftMs).toBe(4 * 60_000);
    expect(p.stops[1]!.projectedAt).toBe(new Date(at('13:09')).toISOString());
    expect(p.stops[2]!.projectedAt).toBe(new Date(at('13:14')).toISOString());
  });

  it('treats a trip that has not started as on plan, never earlier than now', () => {
    const before = projectStops(stops, [], null, new Date(at('12:50')));
    expect(before.shiftMs).toBeNull();
    expect(before.stops[0]!.projectedAt).toBe(new Date(at('13:00')).toISOString());

    const late = projectStops(stops, [], null, new Date(at('13:02')));
    expect(late.shiftMs).toBe(2 * 60_000);
    expect(late.stops[0]!.projectedAt).toBe(new Date(at('13:02')).toISOString());
  });

  it('shifts every stop by a late start from the depot', () => {
    const start = { plannedStart: new Date(at('12:45')), departedAt: new Date(at('12:52')) };
    const p = projectStops(stops, [], null, new Date(at('12:53')), start);
    expect(p.shiftMs).toBe(7 * 60_000);
    expect(p.stops[2]!.projectedAt).toBe(new Date(at('13:17')).toISOString());
  });

  it('counts a bus still parked past its start as late by at least that much', () => {
    const p = projectStops(stops, [], null, new Date(at('12:50')), { plannedStart: new Date(at('12:45')), departedAt: null });
    expect(p.shiftMs).toBe(5 * 60_000);
    expect(p.stops[0]!.projectedAt).toBe(new Date(at('13:05')).toISOString());
  });

  it('lets the first stop reached overrule the start', () => {
    const start = { plannedStart: new Date(at('12:45')), departedAt: new Date(at('12:52')) };
    const p = projectStops(stops, [visit('a', '13:02')], null, new Date(at('13:03')), start);
    expect(p.shiftMs).toBe(2 * 60_000);
  });

  it('takes the provider progress count as passed even without arrival events', () => {
    const p = projectStops(stops, [visit('a', '13:01')], { lastVisitedStop: 2, totalStops: 4 }, new Date(at('13:06')));
    expect(p.stops.map((s) => s.passed)).toEqual([true, true, false, false]);
    // b has no arrival time, so the lateness comes from a.
    expect(p.shiftMs).toBe(60_000);
  });

  it('ignores a progress count over the provider\'s whole route', () => {
    // FirstView counts all 22 stops on the route; the track holds only ours.
    // Stop 2 of 22 is the first stop after the school, not our second stop.
    const p = projectStops(stops, [], { lastVisitedStop: 2, totalStops: 22 }, new Date(at('12:55')));
    expect(p.stops.map((s) => s.passed)).toEqual([false, false, false, false]);
  });

  it('sorts by stop order and leaves stops without a plan unprojected', () => {
    const p = projectStops(
      [{ key: 'x', order: 1, lat: 0, lng: 0 }, { key: 'w', order: 0, lat: 0, lng: 0, plannedAt: at('13:00') }],
      [], null, new Date(at('12:00')),
    );
    expect(p.stops.map((s) => s.key)).toEqual(['w', 'x']);
    expect(p.stops[1]!.projectedAt).toBeNull();
  });
});

describe('pickRiderStop', () => {
  it('prefers the provider flag, then the route stop name, then the last stop', () => {
    expect(pickRiderStop([...stops.slice(0, 3), { ...stops[3]!, rider: true }], 'Cedar')).toBe('school');
    expect(pickRiderStop(stops, ' cedar ')).toBe('b');
    expect(pickRiderStop(stops, 'Nowhere')).toBe('school');
    expect(pickRiderStop([], 'Cedar')).toBeNull();
  });
});
