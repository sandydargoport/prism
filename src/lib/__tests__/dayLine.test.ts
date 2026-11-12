/**
 * The Through the day line (#1170): night and resting across one day on the
 * wall clock, where night starts and ends, and the Interludes that day.
 */
import { dayLine, hhmm, interludeSpans } from '../dayLine';

const day = new Date(2026, 10, 12); // a Thursday

describe('dayLine', () => {
  it('splits a day into night, resting and night on a clock rule that runs past midnight', () => {
    const { stretches, milestones } = dayLine(day, { by: 'clock', from: '21:00', to: '06:30' }, 45, -100);
    expect(stretches).toEqual([
      { kind: 'night', from: 0, to: 390 },
      { kind: 'resting', from: 390, to: 1260 },
      { kind: 'night', from: 1260, to: 1440 },
    ]);
    expect(milestones).toEqual([{ kind: 'night-end', minute: 390 }, { kind: 'night-start', minute: 1260 }]);
  });

  it('keeps a night that starts after midnight inside the day', () => {
    const { stretches } = dayLine(day, { by: 'clock', from: '00:30', to: '06:00' }, 45, -100);
    expect(stretches).toEqual([
      { kind: 'resting', from: 0, to: 30 },
      { kind: 'night', from: 30, to: 360 },
      { kind: 'resting', from: 360, to: 1440 },
    ]);
  });

  it('follows dusk and dawn, offsets included', () => {
    // A longitude whose noon is the test's own, so dusk and dawn fall inside the day.
    const lon = -day.getTimezoneOffset() / 4;
    const plain = dayLine(day, { by: 'sun', duskOffset: 0, dawnOffset: 0 }, 45, lon).milestones;
    const moved = dayLine(day, { by: 'sun', duskOffset: 60, dawnOffset: -60 }, 45, lon).milestones;
    expect(moved.map((m) => m.kind)).toEqual(['night-end', 'night-start']);
    expect(moved[0]!.minute - plain[0]!.minute).toBe(-60);
    expect(moved[1]!.minute - plain[1]!.minute).toBe(60);
  });
});

describe('interludeSpans', () => {
  const rules = [
    { days: [1, 2, 3, 4, 5], from: '07:15', to: '08:00', dashboardId: 'bus' },
    { days: [3], from: '22:00', to: '01:00', dashboardId: 'late' },
    { days: [6], from: '10:00', to: '10:00', dashboardId: 'all' },
  ];

  it('places each Interlude on its days, with the morning of one from the night before', () => {
    expect(interludeSpans(rules, 4)).toEqual([{ index: 0, from: 435, to: 480 }, { index: 1, from: 0, to: 60 }]);
    expect(interludeSpans(rules, 3)).toEqual([{ index: 0, from: 435, to: 480 }, { index: 1, from: 1320, to: 1440 }]);
    expect(interludeSpans(rules, 6)).toEqual([{ index: 2, from: 0, to: 1440 }]);
  });

  it('writes a minute as a clock time, wrapping past midnight', () => {
    expect(hhmm(420)).toBe('07:00');
    expect(hhmm(1440 + 30)).toBe('00:30');
  });
});
