/**
 * The line under a photo on the wall and the screensaver (#958): when it was
 * taken, as a phrase, and where, if the household shows places.
 */
import type { Rect } from './frame';

/** Household settings. The date shows unless turned off; the place only when turned on. */
export const PHOTO_DATE_SETTING = 'photoCaptionDate';
export const PHOTO_PLACE_SETTING = 'photoCaptionPlace';
/** "On this day" mix (#959), off unless turned on. */
export const PHOTO_ON_THIS_DAY_SETTING = 'photoOnThisDay';

/**
 * The rotation with "On this day" photos mixed in (#959): every other photo
 * is one of them, in turn, while there are any; otherwise the pool as it is.
 * A photo in both lists is not shown twice in a row.
 */
export function mixOnThisDay<T extends { id: string }>(pool: readonly T[], onThisDay: readonly T[]): T[] {
  if (onThisDay.length === 0) return [...pool];
  const rest = pool.filter((p) => !onThisDay.some((o) => o.id === p.id));
  if (rest.length === 0) return [...onThisDay];
  const out: T[] = [];
  const n = Math.max(rest.length, onThisDay.length);
  for (let i = 0; i < n; i++) {
    out.push(onThisDay[i % onThisDay.length]!);
    if (i < rest.length) out.push(rest[i]!);
  }
  return out;
}

/**
 * "March" this year, "March last year", else "March 2019". On today's date
 * in an earlier year, "On this day, 2021". Nothing without a date.
 */
export function datePhrase(takenAt: Date | string | null | undefined, now: Date, locale = 'en'): string | null {
  if (!takenAt) return null;
  const d = typeof takenAt === 'string' ? new Date(takenAt) : takenAt;
  if (Number.isNaN(d.getTime()) || d.getTime() > now.getTime()) return null;
  const month = d.toLocaleDateString(locale, { month: 'long' });
  const de = locale.startsWith('de');
  if (d.getFullYear() < now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
    return de ? `Heute vor ${now.getFullYear() - d.getFullYear()} Jahren, ${d.getFullYear()}` : `On this day, ${d.getFullYear()}`;
  }
  if (d.getFullYear() === now.getFullYear()) return month;
  if (d.getFullYear() === now.getFullYear() - 1) return de ? `${month} letzten Jahres` : `${month} last year`;
  return `${month} ${d.getFullYear()}`;
}

/** The caption: date and place joined, or whichever there is. */
export function captionText(date: string | null, place: string | null): string | null {
  if (date && place) return `${date}, ${place}`;
  return date ?? place ?? null;
}

/** Only the bottom corners (#992): anywhere else a lone date reads as a stray heading. */
export type CaptionSpot = 'bottom-right' | 'bottom-left';

/** Where each spot's line would sit, for a screen and a line of this size. */
function spotRect(spot: CaptionSpot, W: number, H: number, w: number, h: number, margin: number): Rect {
  switch (spot) {
    case 'bottom-right': return { left: W - margin - w, top: H - margin - h, width: w, height: h };
    case 'bottom-left': return { left: margin, top: H - margin - h, width: w, height: h };
  }
}

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

export interface CaptionPlace {
  spot: CaptionSpot;
  /** Pixels the line is raised to clear a small item already in that corner. */
  lift: number;
}

/**
 * The first bottom corner the line fits in (#992): as it is, or lifted just
 * clear of a small item sitting in that corner (a button, a short line), but
 * never more than 15% of the screen's height. Null when neither corner has
 * room; the line then hides rather than moving anywhere else.
 */
export function captionSpot(screen: { width: number; height: number }, covered: readonly Rect[], line = { width: 360, height: 28 }, margin = 32): CaptionPlace | null {
  const order: CaptionSpot[] = ['bottom-right', 'bottom-left'];
  const gap = 8;
  for (const spot of order) {
    const r = spotRect(spot, screen.width, screen.height, line.width, line.height, margin);
    const hit = covered.filter((c) => overlaps(r, c));
    if (hit.length === 0) return { spot, lift: 0 };
    const lift = Math.ceil(r.top + r.height - Math.min(...hit.map((c) => c.top)) + gap);
    if (lift > 0.15 * screen.height) continue;
    const raised = { ...r, top: r.top - lift };
    if (!covered.some((c) => overlaps(raised, c))) return { spot, lift };
  }
  return null;
}
