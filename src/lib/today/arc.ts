/**
 * The sun arc's geometry (#909): pure, so other views can draw it later.
 *
 * Time runs left to right from 6 am to 10 pm (or now plus half an hour, if
 * later). Hours already spent are squeezed, each a quarter of the width of an
 * hour still ahead, so the day ahead gets most of the room. Height follows the
 * real sun: the path peaks at solar noon, meets the horizon at sunrise and
 * sunset, and dips gently below it outside them.
 *
 * Hours here are hours on the household's wall clock as decimals (17.5 is
 * 5:30 pm), so the axis is the same whatever zone the screen runs in.
 */

export const ARC = {
  startHour: 6,
  endHour: 22,
  /** Width of a past hour against an hour ahead. */
  pastWeight: 0.25,
  pastWeightPortrait: 0.2,
  /** How far below the horizon the path may dip, as a share of its height. */
  maxDip: 0.4,
} as const;

export interface ArcAxis {
  start: number;
  end: number;
  /** Where an hour falls across the arc, 0 (left) to 1 (right), clamped. */
  x: (hour: number) => number;
}

/** The time axis for `nowHour`. */
export function arcAxis(nowHour: number, opts: { portrait?: boolean } = {}): ArcAxis {
  const start = ARC.startHour;
  const end = Math.max(ARC.endHour, nowHour + 0.5);
  const past = opts.portrait ? ARC.pastWeightPortrait : ARC.pastWeight;
  const split = Math.min(Math.max(nowHour, start), end);
  // Width before `h`: past hours count `past` each, hours ahead count 1.
  const weightTo = (h: number) => {
    const c = Math.min(Math.max(h, start), end);
    return (Math.min(c, split) - start) * past + Math.max(0, c - split);
  };
  const total = weightTo(end);
  return { start, end, x: (h) => (total > 0 ? weightTo(h) / total : 0) };
}

/**
 * The path's height at `hour`: 1 at solar noon, 0 at sunrise and sunset,
 * negative (down to -ARC.maxDip) before sunrise and after sunset.
 */
export function arcHeight(hour: number, sunrise: number, sunset: number): number {
  const day = sunset - sunrise;
  if (day <= 0) return 0;
  const s = Math.sin((Math.PI * (hour - sunrise)) / day);
  const inDay = hour >= sunrise && hour <= sunset;
  return inDay ? s : Math.max(-ARC.maxDip, -Math.abs(s));
}

/** Decimal hours of a wall-clock time. */
export function hourOf(date: { getHours(): number; getMinutes(): number }): number {
  return date.getHours() + date.getMinutes() / 60;
}

export interface ArcPoint { x: number; y: number }

/**
 * Where an hour sits in a box `width` x `height`: x across the box, y with the
 * horizon at `horizon` (px from the top) and the peak `amp` px above it.
 */
export function arcPoint(axis: ArcAxis, hour: number, sunrise: number, sunset: number, box: {
  width: number; horizon: number; amp: number;
}): ArcPoint {
  return { x: axis.x(hour) * box.width, y: box.horizon - box.amp * arcHeight(hour, sunrise, sunset) };
}

/** The whole path as points every few minutes, for drawing. */
export function arcPolyline(axis: ArcAxis, from: number, to: number, sunrise: number, sunset: number, box: {
  width: number; horizon: number; amp: number;
}, step = 1 / 12): ArcPoint[] {
  const pts: ArcPoint[] = [];
  for (let h = from; h < to; h += step) pts.push(arcPoint(axis, h, sunrise, sunset, box));
  pts.push(arcPoint(axis, to, sunrise, sunset, box));
  return pts;
}
