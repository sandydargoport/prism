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

export type CaptionSpot = 'bottom-right' | 'bottom-left' | 'top-centre' | 'bottom-centre';

/** Where each spot's line would sit, for a screen and a line of this size. */
function spotRect(spot: CaptionSpot, W: number, H: number, w: number, h: number, margin: number): Rect {
  switch (spot) {
    case 'bottom-right': return { left: W - margin - w, top: H - margin - h, width: w, height: h };
    case 'bottom-left': return { left: margin, top: H - margin - h, width: w, height: h };
    case 'top-centre': return { left: (W - w) / 2, top: margin, width: w, height: h };
    case 'bottom-centre': return { left: (W - w) / 2, top: H - margin - h, width: w, height: h };
  }
}

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

/** The first spot where the line touches no widget; null when none is free (it then hides). */
export function captionSpot(screen: { width: number; height: number }, covered: readonly Rect[], line = { width: 360, height: 28 }, margin = 32): CaptionSpot | null {
  const order: CaptionSpot[] = ['bottom-right', 'bottom-left', 'top-centre', 'bottom-centre'];
  for (const spot of order) {
    const r = spotRect(spot, screen.width, screen.height, line.width, line.height, margin);
    if (!covered.some((c) => overlaps(r, c))) return spot;
  }
  return null;
}
