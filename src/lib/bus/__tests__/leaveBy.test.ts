import { busArrival, leaveBy } from '../leaveBy';

const now = new Date('2026-11-05T07:30:00Z');
const inMin = (m: number) => new Date(now.getTime() + m * 60_000);

describe('leave-by for the bus (#900)', () => {
  it('is the arrival minus the walk', () => {
    expect(leaveBy({ arrival: inMin(14), walkMinutes: 8, now })).toEqual({ state: 'later', minutes: 6, at: inMin(6) });
  });

  it('turns amber in the last five minutes and says now at the moment', () => {
    expect(leaveBy({ arrival: inMin(13), walkMinutes: 8, now })?.state).toBe('soon');
    expect(leaveBy({ arrival: inMin(8), walkMinutes: 8, now })).toEqual({ state: 'now', minutes: 0, at: inMin(0) });
  });

  it('gives way once the leave time has passed, and stays away with no walk time', () => {
    expect(leaveBy({ arrival: inMin(5), walkMinutes: 8, now })).toBeNull();
    expect(leaveBy({ arrival: inMin(30), walkMinutes: 0, now })).toBeNull();
    expect(leaveBy({ arrival: inMin(30), walkMinutes: undefined, now })).toBeNull();
    expect(leaveBy({ arrival: null, walkMinutes: 8, now })).toBeNull();
  });

  it('counts back from the live prediction when there is one, else the schedule', () => {
    expect(busArrival({ etaMinutes: 12, scheduled: inMin(20), now })).toEqual(inMin(12));
    expect(busArrival({ etaMinutes: null, scheduled: inMin(20), now })).toEqual(inMin(20));
    expect(busArrival({ etaMinutes: null, scheduled: null, now })).toBeNull();
  });
});
