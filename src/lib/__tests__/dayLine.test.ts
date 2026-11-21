/**
 * The Through the day line (#1170): night and resting across one day on the
 * wall clock, where night starts and ends, and the dashboards placed on it.
 */
import { dayLine, hhmm, placementSpans, placeBlocks } from '../dayLine';

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

describe('placementSpans', () => {
  const placements = [
    { days: [1, 2, 3, 4, 5], from: '07:15', to: '08:00', dashboardId: 'bus' },
    { days: [3], from: '22:00', to: '01:00', dashboardId: 'late' },
    { days: [6], from: '10:00', to: '10:00', dashboardId: 'all' },
  ];
  const at = (index: number, from: number, to: number, partial: boolean) => ({ index, from, to, partial });

  it('on one day: each placement on its days, with the morning of one from the night before', () => {
    expect(placementSpans(placements, [4])).toEqual([at(0, 435, 480, false), at(1, 0, 60, false)]);
    expect(placementSpans(placements, [3])).toEqual([at(0, 435, 480, false), at(1, 1320, 1440, false)]);
    expect(placementSpans(placements, [6])).toEqual([at(2, 0, 1440, false)]);
  });

  it('on a set of days, a placement on all of them is one block, and one on some is marked', () => {
    // Weekdays: the bus placement is one block, not five; the late one is on
    // Wednesday only (and Thursday morning).
    expect(placementSpans(placements, [1, 2, 3, 4, 5])).toEqual([
      at(0, 435, 480, false), at(1, 0, 60, true), at(1, 1320, 1440, true),
    ]);
    // Saturday and Sunday: no bus.
    expect(placementSpans(placements, [0, 6])).toEqual([at(2, 0, 1440, true)]);
  });

  it('writes a minute as a clock time, wrapping past midnight', () => {
    expect(hhmm(420)).toBe('07:00');
    expect(hhmm(1440 + 30)).toBe('00:30');
  });
});

describe('placeBlocks', () => {
  it('keeps each block at its start, inside the line', () => {
    expect(placeBlocks([{ start: 100, width: 120 }], 400)).toEqual([{ left: 100, lane: 0 }]);
    expect(placeBlocks([{ start: 350, width: 120 }], 400)).toEqual([{ left: 280, lane: 0 }]);
  });

  it('drops a block that would touch another to the next row', () => {
    // The late one is pushed left by the line's end into the early one.
    expect(placeBlocks([{ start: 100, width: 128 }, { start: 380, width: 125 }], 355)).toEqual([
      { left: 100, lane: 0 },
      { left: 230, lane: 1 },
    ]);
    expect(placeBlocks([{ start: 0, width: 50 }, { start: 60, width: 50 }], 400)).toEqual([
      { left: 0, lane: 0 },
      { left: 60, lane: 0 },
    ]);
  });
});
