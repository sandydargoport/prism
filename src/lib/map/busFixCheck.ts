/**
 * Read-time checks on what a provider says about each fix, against what the
 * positions themselves show.
 *
 * Providers get the extras wrong (a speed field that is not a speed, a door
 * flag stuck open), and stored rows are never cleaned up afterwards, so every
 * reader runs a track's fixes through here instead. A fix always keeps its
 * position and heading; a speed, motion or door flag the positions contradict
 * is dropped, and a missing or impossible speed is replaced by the one the
 * positions imply. Because the raw rows stay as they were, a better rule here
 * applies to old trips as well as new ones.
 */

import { metresBetween } from './busTween';

/** Faster than any school bus goes (~100 mph). */
export const MAX_BUS_MPS = 45;
/** Clearly under way: doors are shut and the bus is moving. */
const UNDER_WAY_MPS = 3;
/** Fixes further apart than this say little about the speed between them. */
const PAIR_MAX_S = 120;
/** A flag seen this often without ever changing is stuck, not information. */
const STUCK_AFTER = 10;

export interface CheckableFix {
  ts: string | number | Date;
  lat: number;
  lng: number;
  speed: number | null;
  moving: boolean | null;
  doorOpen: boolean | null;
}

const ms = (ts: CheckableFix['ts']) => (ts instanceof Date ? ts.getTime() : new Date(ts).getTime());

/** Metres per second between two fixes, or null when they are too close or too far apart in time. */
function implied(a: CheckableFix, b: CheckableFix): number | null {
  const s = (ms(b.ts) - ms(a.ts)) / 1000;
  return s >= 1 && s <= PAIR_MAX_S ? metresBetween(a, b) / s : null;
}

/** A track's fixes, oldest first, with contradicted flags dropped. */
export function checkFixes<T extends CheckableFix>(fixes: T[]): T[] {
  const doors = fixes.filter((f) => f.doorOpen !== null);
  const doorStuck = doors.length >= STUCK_AFTER && doors.every((f) => f.doorOpen === doors[0]!.doorOpen);

  return fixes.map((f, i) => {
    const before = i > 0 ? implied(fixes[i - 1]!, f) : null;
    const after = i < fixes.length - 1 ? implied(f, fixes[i + 1]!) : null;
    // Under way on both sides: the bus did not stop at this fix.
    const sides = [before, after].filter((v): v is number => v !== null);
    const underWay = sides.length > 0 && Math.min(...sides) >= UNDER_WAY_MPS;

    const plausible = f.speed !== null && f.speed >= 0 && f.speed <= MAX_BUS_MPS;
    return {
      ...f,
      speed: plausible ? f.speed : before,
      moving: f.moving === false && underWay ? null : f.moving,
      doorOpen: doorStuck || (f.doorOpen && underWay) ? null : f.doorOpen,
    };
  });
}
