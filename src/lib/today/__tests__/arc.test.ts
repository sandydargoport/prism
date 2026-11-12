/**
 * The sun arc's geometry (#909).
 */
import { ARC, arcAxis, arcHeight, arcPoint, bodyHeight } from '../arc';

const box = { width: 1000, horizon: 300, amp: 100 };

describe('the arc height', () => {
  const sunrise = 6.5, sunset = 17.5; // a November day
  it('peaks at solar noon', () => {
    expect(arcHeight(12, sunrise, sunset)).toBeCloseTo(1, 5);
    expect(arcHeight(11, sunrise, sunset)).toBeLessThan(1);
  });
  it('meets the horizon at sunrise and sunset', () => {
    expect(arcHeight(sunrise, sunrise, sunset)).toBeCloseTo(0, 5);
    expect(arcHeight(sunset, sunrise, sunset)).toBeCloseTo(0, 5);
  });
  it('dips gently below it after sunset, never further than the limit', () => {
    for (let h = 18; h <= 24; h += 0.5) {
      const y = arcHeight(h, sunrise, sunset);
      expect(y).toBeLessThan(0);
      expect(y).toBeGreaterThanOrEqual(-ARC.below * 2);
    }
  });

  it('never runs flat below the horizon (#994): it keeps falling to midnight, then rises', () => {
    const at = (h: number) => arcHeight(h, sunrise, sunset);
    for (let h = 18.5; h < 24; h += 0.5) expect(at(h + 0.5)).toBeLessThan(at(h));
    for (let h = 0.5; h < 5.5; h += 0.5) expect(at(h + 0.5)).toBeGreaterThan(at(h));
    // Over any hour of the night the curve moves, unlike the old floor.
    for (let h = 19; h < 29; h += 1) expect(Math.abs(at((h + 1) % 24) - at(h % 24))).toBeGreaterThan(0.005);
  });

  it('the moon: up between its rise and set, wrapping past midnight', () => {
    // Rises at 7:45 pm, sets at 9 am the next day.
    expect(bodyHeight(19.75, 19.75, 9)).toBeCloseTo(0, 5);
    expect(bodyHeight(9, 19.75, 9)).toBeCloseTo(0, 5);
    expect(bodyHeight(2.375, 19.75, 9)).toBeCloseTo(1, 5);
    expect(bodyHeight(23, 19.75, 9)).toBeGreaterThan(0);
    expect(bodyHeight(15, 19.75, 9)).toBeLessThan(0);
  });
});

describe('the time axis', () => {
  it('runs from 6 am to 10 pm', () => {
    const axis = arcAxis(12);
    expect(axis.x(6)).toBe(0);
    expect(axis.x(22)).toBe(1);
    expect(axis.x(5)).toBe(0);
    expect(axis.x(23)).toBe(1);
  });
  it('squeezes the past: an hour gone is a quarter of an hour ahead', () => {
    const axis = arcAxis(16);
    const past = axis.x(15) - axis.x(14);
    const ahead = axis.x(18) - axis.x(17);
    expect(past / ahead).toBeCloseTo(ARC.pastWeight, 5);
  });
  it('gives the day ahead most of the width in the afternoon', () => {
    // At 4:10 pm the past is about 30% of the width.
    expect(arcAxis(16 + 10 / 60).x(16 + 10 / 60)).toBeGreaterThan(0.25);
    expect(arcAxis(16 + 10 / 60).x(16 + 10 / 60)).toBeLessThan(0.35);
  });
  it('starts earlier for an early event and ends later for a late one, never past midnight', () => {
    const early = arcAxis(9, { firstHour: 5 });
    expect(early.start).toBeCloseTo(4.7, 5);
    expect(early.x(5)).toBeGreaterThan(0);
    expect(arcAxis(9, { lastHour: 23 }).end).toBeCloseTo(23.3, 5);
    expect(arcAxis(9, { lastHour: 23.9 }).end).toBe(24);
  });

  it('stretches past 10 pm late at night', () => {
    const axis = arcAxis(23);
    expect(axis.end).toBe(23.5);
    expect(axis.x(23)).toBeLessThan(1);
  });
});

describe('beads on the arc', () => {
  it('puts a 6 pm event to the right of a 5 pm one', () => {
    const axis = arcAxis(9);
    const five = arcPoint(axis, 17, 6.5, 17.5, box);
    const six = arcPoint(axis, 18, 6.5, 17.5, box);
    expect(six.x).toBeGreaterThan(five.x);
  });
  it('puts noon at the top of the box and sunset on the horizon', () => {
    const axis = arcAxis(9);
    expect(arcPoint(axis, 12, 6.5, 17.5, box).y).toBeCloseTo(box.horizon - box.amp, 5);
    expect(arcPoint(axis, 17.5, 6.5, 17.5, box).y).toBeCloseTo(box.horizon, 5);
  });
});
