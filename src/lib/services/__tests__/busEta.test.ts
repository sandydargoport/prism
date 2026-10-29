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

describe('projectStops along the whole route', () => {
  const ours: LiveTrackStop[] = [
    { key: 'home', order: 0, lat: 1, lng: 1, plannedAt: at('13:20'), rider: true },
    { key: 'school', order: 1, lat: 1, lng: 2, plannedAt: at('13:30'), kind: 'school' },
  ];
  const routeVisit = (stopKey: string, planned: string, arrived: string) =>
    ({ stopKey, plannedAt: new Date(at(planned)), arrivedAt: new Date(at(arrived)), departedAt: null });

  it('takes the lateness from the latest route stop reached, even one not on the track', () => {
    const p = projectStops(ours, [
      routeVisit('r1', '13:00', '13:02'),
      routeVisit('r2', '13:05', '13:11'),
    ], null, new Date(at('13:12')), { plannedStart: new Date(at('12:50')), departedAt: new Date(at('12:47')) });
    expect(p.shiftMs).toBe(6 * 60_000);
    expect(p.stops[0]!.projectedAt).toBe(new Date(at('13:26')).toISOString());
  });

  it('an early start does not make the bus early when recent trips were late', () => {
    // Left 3 min early, but the bus has been at least 6 min late at this stop lately.
    const p = projectStops(ours, [], null, new Date(at('12:55')), {
      plannedStart: new Date(at('12:50')), departedAt: new Date(at('12:47')), usualLateMs: 6 * 60_000,
    });
    expect(p.shiftMs).toBe(6 * 60_000);
    expect(p.stops[0]!.projectedAt).toBe(new Date(at('13:26')).toISOString());
  });

  it('a start later than usual still wins', () => {
    const p = projectStops(ours, [], null, new Date(at('13:05')), {
      plannedStart: new Date(at('12:50')), departedAt: new Date(at('13:02')), usualLateMs: 6 * 60_000,
    });
    expect(p.shiftMs).toBe(12 * 60_000);
  });
});

describe('projectStops on an afternoon trip that starts at the school', () => {
  const pm: LiveTrackStop[] = [
    { key: 'school', order: 0, lat: 1, lng: 1, plannedAt: at('20:30'), kind: 'school' },
    { key: 'home', order: 1, lat: 1, lng: 2, plannedAt: at('20:50'), rider: true },
  ];
  // The first move of the day is the drive to the school, long before the planned start.
  const start = { plannedStart: new Date(at('20:30')), departedAt: new Date(at('20:08')) };

  it('does not move the later stops earlier when the bus reaches the school early', () => {
    const p = projectStops(pm, [visit('school', '20:20')], null, new Date(at('20:25')), start);
    expect(p.shiftMs).toBe(0);
    expect(p.stops[1]!.projectedAt).toBe(new Date(at('20:50')).toISOString());
  });

  it('applies the usual lateness while the bus waits at the school', () => {
    const p = projectStops(pm, [visit('school', '20:20')], null, new Date(at('20:25')), { ...start, usualLateMs: 17 * 60_000 });
    expect(p.stops[1]!.projectedAt).toBe(new Date(at('21:07')).toISOString());
  });

  it('counts a bus still at the school past its start as late by at least that much', () => {
    const p = projectStops(pm, [visit('school', '20:20')], null, new Date(at('20:36')), start);
    expect(p.shiftMs).toBe(6 * 60_000);
    expect(p.stops[1]!.projectedAt).toBe(new Date(at('20:56')).toISOString());
  });

  it('follows the route stops once the bus has left the school', () => {
    const p = projectStops(pm, [
      visit('school', '20:20'),
      { stopKey: 'r1', plannedAt: new Date(at('20:35')), arrivedAt: new Date(at('20:45')), departedAt: null },
    ], null, new Date(at('20:46')), { ...start, usualLateMs: 17 * 60_000 });
    expect(p.shiftMs).toBe(10 * 60_000);
    expect(p.stops[1]!.projectedAt).toBe(new Date(at('21:00')).toISOString());
  });

  it('a school reached late still shifts the later stops', () => {
    const p = projectStops(pm, [visit('school', '20:38')], null, new Date(at('20:39')), start);
    expect(p.shiftMs).toBe(8 * 60_000);
  });
});
