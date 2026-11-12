/**
 * The coming days as sentences (#805), from templates in English and German.
 * No AI and no outside service: the same events always give the same words.
 *
 *   Tomorrow   Alex has Dentist at 9 and Sophie has Piano recital at 6.
 *   Saturday   Soccer at 10.
 *   One more thing later this week.
 *
 * A day says at most two things; the rest, and any day past the last line,
 * fold into the closing "later this week" line. Names come from the person a
 * calendar belongs to; a calendar with no person gives a sentence without one.
 */

export type SentenceLocale = 'en' | 'de';

export interface SentenceEvent {
  title: string;
  start: Date;
  allDay: boolean;
  /** The person this event's calendar belongs to, if any. */
  who?: string;
}

export interface DayLine {
  /** "Tomorrow", "Saturday". */
  day: string;
  sentence: string;
}

/**
 * What fits is said; the rest is left out, never counted (#993: a "33 more
 * things" line only adds stress).
 */
export interface ComingDays {
  lines: DayLine[];
}

const WORDS = {
  en: {
    tomorrow: 'Tomorrow',
    has: (who: string, what: string) => `${who} has ${what}`,
    at: (what: string, time: string) => `${what} at ${time}`,
    allDay: (what: string) => what,
    and: ' and ',
  },
  de: {
    tomorrow: 'Morgen',
    has: (who: string, what: string) => `${who} hat ${what}`,
    at: (what: string, time: string) => `${what} um ${time}`,
    allDay: (what: string) => what,
    and: ' und ',
  },
} as const;


export const SENTENCES = {
  /** Things one day's sentence says before the rest fold. */
  perDay: 2,
  daysAheadDefault: 3,
} as const;

/** "Alex has Dentist at 9", "Soccer at 10", "Grandparents visiting". */
function clause(e: SentenceEvent, locale: SentenceLocale, time: (d: Date) => string): string {
  const w = WORDS[locale];
  const what = e.allDay ? w.allDay(e.title) : w.at(e.title, time(e.start));
  // A title that already names the person ("Alex dentist") is said as it is.
  if (!e.who || e.title.toLowerCase().includes(e.who.toLowerCase())) return what;
  return w.has(e.who, what);
}

const sentenceCase = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/**
 * The lines for the days after today.
 * @param days events grouped by day, in order, starting tomorrow; each day's
 *   label (weekday name) and its events in start order.
 */
export function comingDays(
  days: Array<{ label: string; events: SentenceEvent[] }>,
  opts: { locale: SentenceLocale; time: (d: Date) => string; daysAhead?: number },
): ComingDays {
  const w = WORDS[opts.locale];
  const ahead = opts.daysAhead ?? SENTENCES.daysAheadDefault;
  const lines: DayLine[] = [];
  days.forEach((d, i) => {
    if (d.events.length === 0 || i >= ahead) return;
    const said = d.events.slice(0, SENTENCES.perDay).map((e) => clause(e, opts.locale, opts.time));
    lines.push({ day: i === 0 ? w.tomorrow : d.label, sentence: `${sentenceCase(said.join(w.and))}.` });
  });
  return { lines };
}
