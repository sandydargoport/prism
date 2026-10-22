/**
 * Smooth movement for a live vehicle marker.
 *
 * The feed is irregular (often ~10s, sometimes 1s, sometimes a minute when
 * parked), and the widget polls every few seconds, so fixes arrive in small
 * batches and each is already some seconds old. Each batch becomes a short
 * catch-up path from wherever the marker is drawn now, through every new fix
 * in order (so corners are followed rather than cut), to where the bus most
 * likely is by the end of it. After that the marker keeps going at the last
 * speed and heading.
 *
 * Showing the bus behind where it is would tell someone waiting that they have
 * more time than they do, so the guess leans forward, but only a little: it
 * covers the gap until the next fix is due, stops at the next stop, and never
 * starts while the bus is stopped or its doors are open.
 */

export interface Pose {
  lat: number;
  lng: number;
  /** Degrees clockwise from north. */
  heading: number;
}

export interface Fix {
  ts: number;
  lat: number;
  lng: number;
  heading?: number | null;
}

export interface Path {
  points: Pose[];
  /** Cumulative fraction of the path at each point, 0 to 1. */
  at: number[];
  start: number;
  duration: number;
}

export const MIN_TWEEN_MS = 1_000;
/** How long the marker takes to catch up to a new batch of fixes. */
export const CATCH_UP_MS = 1_500;
/**
 * The furthest ahead of its newest fix the marker is guessed: about two of the
 * feed's usual gaps. Past this the bus has probably stopped (a light, a stop
 * the provider has not reported), so the marker holds.
 */
export const MAX_EXTRAPOLATE_MS = 20_000;
/**
 * The guess eases off the longer it goes without a fix: buses slow for
 * lights, corners and stops far more often than they speed up, and a guess
 * that ran ahead has to come back. Seconds.
 */
const COAST_TAU_S = 12;
/** Slower than this is stopped, not moving. */
const MOVING_MPS = 1;
/** A stop further off the heading than this is not ahead of the bus. */
const AHEAD_DEG = 60;
export const MAX_TWEEN_MS = 12_000;
/** Dim the marker after this long without a fix. */
export const STALE_MS = 90_000;
/** Stop showing it as live after this long. */
export const LOST_MS = 10 * 60_000;

/** Moves shorter than this keep the previous heading (GPS jitter when parked). */
const STILL_M = 3;

export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

export function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = b.lat - a.lat;
  const dLng = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180);
  return ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
}

/** Signed turn from one heading to another the short way round, -180 to 180. */
export function headingDelta(from: number, to: number): number {
  const d = (((to - from) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

/**
 * The path for a batch of new fixes, oldest first. Its duration is the time
 * the fixes span, from the last one already shown, clamped so a burst does not
 * blink and a long gap does not crawl.
 */
export function buildPath(
  from: Pose,
  fixes: Fix[],
  previousTs: number | null,
  now: number,
  reducedMotion = false,
): Path {
  const points: Pose[] = [from];
  let heading = from.heading;
  for (const f of fixes) {
    const prev = points[points.length - 1]!;
    const moved = metresBetween(prev, f) >= STILL_M;
    heading = f.heading ?? (moved ? bearing(prev, f) : heading);
    points.push({ lat: f.lat, lng: f.lng, heading });
  }

  const lengths = points.slice(1).map((p, i) => metresBetween(points[i]!, p));
  const total = lengths.reduce((a, b) => a + b, 0);
  const at = [0];
  let run = 0;
  for (const len of lengths) {
    run += len;
    at.push(total > 0 ? run / total : 1);
  }

  const last = fixes[fixes.length - 1];
  const span = last && previousTs !== null ? last.ts - previousTs : MAX_TWEEN_MS;
  const duration = reducedMotion ? 0 : Math.min(MAX_TWEEN_MS, Math.max(MIN_TWEEN_MS, span));
  return { points, at, start: now, duration };
}

export interface Motion {
  /** When the bus was at the pose, ms. */
  ts: number;
  /** Metres per second. */
  speed: number | null;
  moving?: boolean | null;
  doorOpen?: boolean | null;
}

/** The point `metres` along `heading` from `from`. */
function offset(from: Pose, metres: number): Pose {
  const h = (from.heading * Math.PI) / 180;
  return {
    lat: from.lat + (metres * Math.cos(h)) / 111_320,
    lng: from.lng + (metres * Math.sin(h)) / (111_320 * Math.cos((from.lat * Math.PI) / 180)),
    heading: from.heading,
  };
}

/** Metres covered `seconds` after a fix at `speed`, slowing gently as the guess ages. */
export function coastMetres(speed: number, seconds: number): number {
  return speed * COAST_TAU_S * (1 - Math.exp(-seconds / COAST_TAU_S));
}

/**
 * Where the bus most likely is at `now`, from its newest fix: carried on along
 * the same heading, easing off, for at most MAX_EXTRAPOLATE_MS, and never past
 * the next stop when that stop lies ahead.
 */
export function extrapolate(
  pose: Pose,
  motion: Motion,
  now: number,
  nextStop?: { lat: number; lng: number } | null,
): Pose {
  const speed = motion.speed ?? 0;
  if (speed < MOVING_MPS || motion.moving === false || motion.doorOpen) return pose;
  const seconds = Math.min(Math.max(0, now - motion.ts), MAX_EXTRAPOLATE_MS) / 1000;
  let metres = coastMetres(speed, seconds);
  if (nextStop) {
    const off = Math.abs(headingDelta(pose.heading, bearing(pose, nextStop)));
    if (off < AHEAD_DEG) {
      metres = Math.min(metres, metresBetween(pose, nextStop) * Math.cos((off * Math.PI) / 180));
    }
  }
  return metres > 0 ? offset(pose, metres) : pose;
}

/** Metres from `from` to `to` along `from`'s heading; negative is behind it. */
export function metresAhead(from: Pose, to: { lat: number; lng: number }): number {
  const d = metresBetween(from, to);
  if (d === 0) return 0;
  return d * Math.cos((headingDelta(from.heading, bearing(from, to)) * Math.PI) / 180);
}

/** GPS wobble: a target this little behind is not a step back. */
const BACK_TOLERANCE_M = 3;
/** Further behind than this, the guess was wrong and the marker goes back. */
const FAR_BEHIND_M = 80;
/** The longest the marker waits for the bus to come level with it. */
export const HOLD_MAX_MS = 10_000;

/**
 * Whether the marker should wait where it is rather than move back to
 * `target`. A bus seldom reverses, so a marker sliding backwards is nearly
 * always the guess having run ahead; waiting a few seconds lets the real bus
 * catch up to it. A real turnaround (the heading flips) or a guess far out
 * moves it back at once, and no wait lasts longer than HOLD_MAX_MS.
 */
export function shouldHold(shown: Pose, target: Pose, heldSince: number | null, now: number): boolean {
  const ahead = metresAhead(shown, target);
  if (ahead >= -BACK_TOLERANCE_M || ahead < -FAR_BEHIND_M) return false;
  if (Math.abs(headingDelta(shown.heading, target.heading)) > 120) return false;
  return heldSince === null || now - heldSince < HOLD_MAX_MS;
}

/** Whether `extrapolate` would still move the marker after `now`. */
export function isExtrapolating(motion: Motion, now: number): boolean {
  const speed = motion.speed ?? 0;
  if (speed < MOVING_MPS || motion.moving === false || motion.doorOpen) return false;
  return now - motion.ts < MAX_EXTRAPOLATE_MS;
}

/**
 * Speed from the last two fixes, for a provider that does not send one.
 * Null when they are too close in time to say.
 */
export function speedBetween(a: Fix, b: Fix): number | null {
  const seconds = (b.ts - a.ts) / 1000;
  return seconds >= 1 ? metresBetween(a, b) / seconds : null;
}

/** Where the marker is drawn at `now`. Holds at the end of the path. */
export function poseAt(path: Path, now: number): Pose {
  const { points, at } = path;
  const t = path.duration <= 0 ? 1 : Math.min(1, Math.max(0, (now - path.start) / path.duration));
  if (t >= 1 || points.length === 1) return points[points.length - 1]!;

  let i = 1;
  while (i < at.length - 1 && at[i]! < t) i++;
  const a = points[i - 1]!;
  const b = points[i]!;
  const span = at[i]! - at[i - 1]!;
  const f = span > 0 ? (t - at[i - 1]!) / span : 1;
  return {
    lat: a.lat + (b.lat - a.lat) * f,
    lng: a.lng + (b.lng - a.lng) * f,
    heading: (a.heading + headingDelta(a.heading, b.heading) * f + 360) % 360,
  };
}

export function isPathDone(path: Path, now: number): boolean {
  return path.duration <= 0 || now - path.start >= path.duration;
}

export type Freshness = 'live' | 'stale' | 'lost';

export function freshness(lastFixTs: number | null, now: number): Freshness {
  if (lastFixTs === null) return 'lost';
  const age = now - lastFixTs;
  if (age >= LOST_MS) return 'lost';
  if (age >= STALE_MS) return 'stale';
  return 'live';
}
