import type { IdleBackground, IdleSource } from './idleBackground';
import { busWindowOf, daysShort, routesOf, staysAwake, type BusTime, type ScreenSwitch } from './screenSwitches';
import { screenStateAt } from './throughTheDay';

/**
 * The sentence a screen says about itself (#1349), for example:
 *
 *   Hallway shows Main. On school days it shows Bus board around bus time
 *   and stays awake for it. Idle for 2 minutes, it becomes a photo frame. At
 *   night the photo frame is 50% darker.
 *
 * The Screen tab shows it at the top; Settings > Screens uses it as each
 * screen's row (#1351). What it says idle and at night comes from
 * `screenStateAt`, the one function the wall, the canvas and the strip ask,
 * so the sentence cannot describe a day the wall does not have. When
 * something will not happen it says so: a screen that never idles, or one
 * too narrow to idle.
 *
 * Plain function, no browser: Settings can call it for screens it is not.
 */

export type ScreenSentenceInput = {
  /** The screen's name; null for one nobody named, which reads "This screen". */
  name: string | null;
  /** The dashboard it normally shows, by name. */
  normally: string;
  /** Its switches, in order. */
  switches: readonly ScreenSwitch[];
  /** A dashboard's name by id; null for one that no longer exists, whose switch never shows. */
  dashboardName: (id: string) => string | null;
  /** The bus routes, for which days bus time is; null while not known. */
  routes?: readonly BusTime[] | null;
  /** The screen's idle looks and night rule, as the wall reads them. */
  background: IdleBackground;
  /** How much darker at night, in percent (0, 25, 50, 75). */
  nightLevel: number;
  /** Idle after this many seconds of nobody touching it; 0 never. */
  idleAfter: number;
  /** False for a screen that cannot idle at all: narrower than a wall screen. */
  canIdle?: boolean;
  /** A time of day, "HH:MM", the way the household reads one. */
  clock: (hhmm: string) => string;
};

/** What each look becomes, after "it becomes". */
const BECOMES: Record<IdleSource, string> = {
  dashboard: 'the dashboard, quieter',
  photos: 'a photo frame',
  sky: 'the night sky',
  off: 'screen off',
};
/** The same look named as the thing that goes darker. */
const SUBJECT: Record<IdleSource, string> = {
  dashboard: 'the quiet dashboard',
  photos: 'the photo frame',
  sky: 'the night sky',
  off: 'the screen',
};

const WEEKDAYS = [1, 2, 3, 4, 5];
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((d) => b.includes(d));

/** A set of days as a sentence opens with it: "Every day", "Mon to Fri", "Sat, Sun". */
export function daysInWords(days: readonly number[]): string {
  return daysShort([...days]).replace(/–/g, ' to ');
}

/** How long, in words: "30 seconds", "1 minute", "2 minutes", "1 hour". */
export function idleAfterInWords(seconds: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (seconds < 60) return plural(seconds, 'second');
  if (seconds < 3600) return plural(Math.round(seconds / 60), 'minute');
  return plural(Math.round(seconds / 3600), 'hour');
}

/** One switch's clause, or null when it never shows. */
function switchClause(sw: ScreenSwitch, input: ScreenSentenceInput): string | null {
  const shows = input.dashboardName(sw.dashboardId);
  if (shows === null) return null;
  const awake = staysAwake(sw) ? ' and stays awake for it' : '';
  if (sw.when === 'bus') {
    if (!input.routes) return `At bus time it shows ${shows}${awake}.`;
    const followed = routesOf(sw, input.routes).filter((r) => (r.activeDays?.length ?? 0) > 0);
    if (followed.length === 0) return `No bus route is set up, so it never shows ${shows}.`;
    const days = [...new Set(followed.flatMap((r) => r.activeDays))].sort();
    const when = days.length === 7 ? 'Every day' : same(days, WEEKDAYS) ? 'On school days' : `On ${daysInWords(days)}`;
    const { before, after } = busWindowOf(sw);
    const around = before === 0 && after === 0 ? 'at bus time' : 'around bus time';
    return `${when} it shows ${shows} ${around}${awake}.`;
  }
  const days = sw.days.length === 7 ? 'Every day' : daysInWords(sw.days);
  const hours = sw.from === sw.to ? 'all day' : `${input.clock(sw.from)} to ${input.clock(sw.to)}`;
  return `${days}, ${hours} it shows ${shows}${awake}.`;
}

/** What it does idle, by day and at night, from the one scene function. */
function idleClauses(input: ScreenSentenceInput): string[] {
  const { background, canIdle = true, idleAfter } = input;
  const at = (night: boolean) => screenStateAt({ idle: true, background, at: { night }, dimLevel: input.nightLevel / 100, canIdle });
  const day = at(false);
  if (day.state === 'active') return ['Will not idle: too narrow.'];
  if (idleAfter <= 0) return ['It never idles, so it has no night look.'];
  const night = at(true);
  const out = [`Idle for ${idleAfterInWords(idleAfter)}, ${day.look === 'off' ? 'its screen turns off' : `it becomes ${BECOMES[day.look]}`}.`];
  const darker = Math.round(night.dim * 100);
  if (night.look === 'off') {
    if (day.look !== 'off') out.push('At night the screen turns off.');
  } else if (night.look === day.look) {
    out.push(darker > 0 ? `At night ${SUBJECT[night.look]} is ${darker}% darker.` : 'At night nothing changes.');
  } else {
    out.push(`At night it becomes ${BECOMES[night.look]}${darker > 0 ? `, ${darker}% darker` : ''}.`);
  }
  return out;
}

/** The screen's day in one sentence: what it shows, when it switches, and how it idles by day and at night. */
export function screenSentence(input: ScreenSentenceInput): string {
  const who = input.name?.trim() || 'This screen';
  return [
    `${who} shows ${input.normally}.`,
    ...input.switches.map((sw) => switchClause(sw, input)).filter((c): c is string => c !== null),
    ...idleClauses(input),
  ].join(' ');
}
