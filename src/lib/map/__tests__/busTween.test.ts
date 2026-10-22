import {
  HOLD_MAX_MS, MAX_EXTRAPOLATE_MS, MAX_TWEEN_MS, MIN_TWEEN_MS, buildPath, extrapolate, freshness, headingDelta,
  coastMetres, isExtrapolating, isPathDone, metresAhead, metresBetween, poseAt, shouldHold, speedBetween,
} from '../busTween';

const start = { lat: 39.74, lng: -104.99, heading: 90 };
// About 85 m east, then about 111 m north.
const east = { lat: 39.74, lng: -104.989 };
const north = { lat: 39.741, lng: -104.989 };

describe('headingDelta', () => {
  it('turns the short way round', () => {
    expect(headingDelta(350, 10)).toBe(20);
    expect(headingDelta(10, 350)).toBe(-20);
    expect(headingDelta(90, 270)).toBe(180);
    expect(headingDelta(0, 0)).toBe(0);
  });
});

describe('buildPath / poseAt', () => {
  it('lasts as long as the fixes span, clamped', () => {
    expect(buildPath(start, [{ ts: 10_000, ...east }], 0, 0).duration).toBe(10_000);
    expect(buildPath(start, [{ ts: 200, ...east }], 0, 0).duration).toBe(MIN_TWEEN_MS);
    expect(buildPath(start, [{ ts: 90_000, ...east }], 0, 0).duration).toBe(MAX_TWEEN_MS);
    expect(buildPath(start, [{ ts: 10_000, ...east }], 0, 0, true).duration).toBe(0);
  });

  it('follows every fix in order instead of cutting the corner', () => {
    const path = buildPath(start, [{ ts: 5_000, ...east }, { ts: 10_000, ...north }], 0, 0);
    const corner = path.at[1]!;
    const mid = poseAt(path, corner * path.duration);
    expect(metresBetween(mid, east)).toBeLessThan(0.5);
    // Halfway along the first leg it is still on the east-west line.
    const leg = poseAt(path, (corner / 2) * path.duration);
    expect(leg.lat).toBeCloseTo(39.74, 6);
  });

  it('holds at the newest fix and never runs past it', () => {
    const path = buildPath(start, [{ ts: 4_000, ...east }], 0, 1_000);
    expect(isPathDone(path, 4_999)).toBe(false);
    expect(isPathDone(path, 5_000)).toBe(true);
    expect(poseAt(path, 60_000)).toMatchObject(east);
    expect(poseAt(path, 0)).toMatchObject({ lat: start.lat, lng: start.lng });
  });

  it('takes the fix heading, else the direction of travel, else keeps the old one', () => {
    expect(buildPath(start, [{ ts: 1, ...east, heading: 45 }], 0, 0).points[1]!.heading).toBe(45);
    expect(buildPath(start, [{ ts: 1, ...north }], 0, 0).points[1]!.heading).toBeCloseTo(37.6, 0);
    // A metre of GPS jitter while parked does not spin the marker.
    const jitter = { lat: start.lat + 0.000005, lng: start.lng };
    expect(buildPath(start, [{ ts: 1, ...jitter }], 0, 0).points[1]!.heading).toBe(90);
  });

  it('turns through the short way during the tween', () => {
    const path = buildPath({ ...start, heading: 350 }, [{ ts: 2_000, ...east, heading: 10 }], 0, 0);
    expect(poseAt(path, 1_000).heading).toBeCloseTo(0, 5);
  });
});

describe('freshness', () => {
  it('is live, then stale after 90s, then lost after 10 min', () => {
    expect(freshness(0, 89_000)).toBe('live');
    expect(freshness(0, 90_000)).toBe('stale');
    expect(freshness(0, 600_000)).toBe('lost');
    expect(freshness(null, 0)).toBe('lost');
  });
});

describe('extrapolate', () => {
  // Heading east at 10 m/s.
  const pose = { lat: 39.74, lng: -104.99, heading: 90 };
  const motion = { ts: 0, speed: 10 };

  it('carries the bus on along its heading, easing off', () => {
    const p = extrapolate(pose, motion, 5_000);
    expect(metresBetween(pose, p)).toBeCloseTo(coastMetres(10, 5), 0);
    expect(coastMetres(10, 5)).toBeGreaterThan(38);
    expect(coastMetres(10, 5)).toBeLessThan(50);
    expect(p.lat).toBeCloseTo(pose.lat, 6);
    expect(p.lng).toBeGreaterThan(pose.lng);
  });

  it('guesses no further than MAX_EXTRAPOLATE_MS past the fix', () => {
    const far = extrapolate(pose, motion, 120_000);
    expect(metresBetween(pose, far)).toBeCloseTo(coastMetres(10, MAX_EXTRAPOLATE_MS / 1000), 0);
    expect(isExtrapolating(motion, MAX_EXTRAPOLATE_MS - 1)).toBe(true);
    expect(isExtrapolating(motion, MAX_EXTRAPOLATE_MS)).toBe(false);
  });

  it('stops at the next stop ahead, and ignores one behind', () => {
    const ahead = { lat: 39.74, lng: -104.9895 }; // ~43 m east
    expect(metresBetween(pose, extrapolate(pose, motion, 10_000, ahead))).toBeCloseTo(43, 0);
    const behind = { lat: 39.74, lng: -104.9905 };
    expect(metresBetween(pose, extrapolate(pose, motion, 10_000, behind))).toBeCloseTo(coastMetres(10, 10), 0);
  });

  it('holds while stopped, parked or with the doors open', () => {
    expect(extrapolate(pose, { ts: 0, speed: 0.4 }, 5_000)).toBe(pose);
    expect(extrapolate(pose, { ts: 0, speed: 10, doorOpen: true }, 5_000)).toBe(pose);
    expect(extrapolate(pose, { ts: 0, speed: 10, moving: false }, 5_000)).toBe(pose);
    expect(extrapolate(pose, { ts: 0, speed: null }, 5_000)).toBe(pose);
    expect(isExtrapolating({ ts: 0, speed: 10, doorOpen: true }, 1)).toBe(false);
  });

  it('works out a speed from two fixes when the provider sends none', () => {
    expect(speedBetween({ ts: 0, ...start }, { ts: 10_000, ...east })).toBeCloseTo(8.6, 0);
    expect(speedBetween({ ts: 0, ...start }, { ts: 500, ...east })).toBeNull();
  });
});

describe('never backwards', () => {
  const shown = { lat: 39.74, lng: -104.99, heading: 90 };
  const east = (m: number, heading = 90) => ({ lat: 39.74, lng: -104.99 + m / (111_320 * Math.cos((39.74 * Math.PI) / 180)), heading });

  it('measures ahead and behind along the heading', () => {
    expect(metresAhead(shown, east(20))).toBeCloseTo(20, 0);
    expect(metresAhead(shown, east(-20))).toBeCloseTo(-20, 0);
  });

  it('waits rather than sliding back a little', () => {
    expect(shouldHold(shown, east(-15), null, 0)).toBe(true);
    expect(shouldHold(shown, east(-15), 0, HOLD_MAX_MS - 1)).toBe(true);
    expect(shouldHold(shown, east(-15), 0, HOLD_MAX_MS)).toBe(false);
  });

  it('moves on for a step forward, GPS wobble, a turnaround or a guess far out', () => {
    expect(shouldHold(shown, east(15), null, 0)).toBe(false);
    expect(shouldHold(shown, east(-2), null, 0)).toBe(false);
    expect(shouldHold(shown, east(-15, 270), null, 0)).toBe(false);
    expect(shouldHold(shown, east(-200), null, 0)).toBe(false);
  });
});
