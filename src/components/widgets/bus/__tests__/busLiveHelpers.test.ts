import { chooseLayout, formatSpeed, lateness } from '../BusLiveView';
import { isTrackLive, mergeFixes, pickLiveTrack, type LiveFix, type LiveTrack } from '@/lib/hooks/useBusLive';

jest.mock('next/dynamic', () => () => () => null);

const fix = (id: string, ts: string): LiveFix => ({
  id, ts, lat: 0, lng: 0, heading: null, speed: null, moving: null, doorOpen: null,
});

describe('chooseLayout', () => {
  it('puts the panel beside a wide map, under a tall one, and drops the map when small', () => {
    expect(chooseLayout(600, 300)).toBe('wide');
    expect(chooseLayout(320, 480)).toBe('tall');
    // A narrow column at a large text scale still gets a map.
    expect(chooseLayout(217, 560)).toBe('tall');
    expect(chooseLayout(300, 200)).toBe('small');
    // Wide but too short for a map to show anything.
    expect(chooseLayout(800, 120)).toBe('small');
  });
});

describe('lateness and speed', () => {
  it('reads as on time within half a minute', () => {
    expect(lateness(null)).toBeNull();
    expect(lateness(20_000)).toBe('On time');
    expect(lateness(3 * 60_000)).toBe('3 min late');
    expect(lateness(-2 * 60_000)).toBe('2 min early');
  });

  it('converts metres per second', () => {
    expect(formatSpeed(10, 'mph')).toBe('22 mph');
    expect(formatSpeed(10, 'km/h')).toBe('36 km/h');
  });
});

describe('mergeFixes', () => {
  it('drops repeats and keeps time order, whatever order pages arrive in', () => {
    const held = [fix('1', '2026-03-02T13:00:10Z'), fix('2', '2026-03-02T13:00:20Z')];
    const merged = mergeFixes(held, [fix('2', '2026-03-02T13:00:20Z'), fix('3', '2026-03-02T13:00:15Z')]);
    expect(merged.map((f) => f.id)).toEqual(['1', '3', '2']);
    expect(mergeFixes(held, [fix('1', '2026-03-02T13:00:10Z')])).toBe(held);
  });
});

const track = (over: Partial<LiveTrack>): LiveTrack => ({
  id: 't', routeId: 'r', routeLabel: 'AM', direction: 'AM', label: null, status: 'live',
  vehicle: null, driverLabel: null, progress: null, plannedStart: null, plannedEnd: null,
  lastFixAt: '2026-03-02T13:00:00Z', riderStopKey: 's', shiftMs: null, stops: [], fixes: [],
  ...over,
});
const now = new Date('2026-03-02T13:02:00Z').getTime();

describe('isTrackLive / pickLiveTrack', () => {
  it('ends at completed or after ten quiet minutes', () => {
    expect(isTrackLive(track({}), now)).toBe(true);
    expect(isTrackLive(track({ status: 'completed' }), now)).toBe(false);
    expect(isTrackLive(track({ lastFixAt: '2026-03-02T12:50:00Z' }), now)).toBe(false);
    expect(isTrackLive(track({ lastFixAt: null }), now)).toBe(false);
  });

  it('shows the trip due at its stop soonest', () => {
    const stop = (projectedAt: string) => ({
      key: 's', name: null, order: 0, kind: null, lat: 0, lng: 0, plannedAt: null,
      arrivedAt: null, departedAt: null, projectedAt, passed: false,
    });
    const later = track({ id: 'later', stops: [stop('2026-03-02T13:20:00Z')] });
    const sooner = track({ id: 'sooner', stops: [stop('2026-03-02T13:10:00Z')] });
    expect(pickLiveTrack([later, sooner], now)?.id).toBe('sooner');
    expect(pickLiveTrack([track({ status: 'completed' })], now)).toBeNull();
  });
});
