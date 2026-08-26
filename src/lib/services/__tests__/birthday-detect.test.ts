/**
 * Tests for the source-agnostic life-event parser.
 *
 * These are the rules that decide whether something on any of the user's
 * calendars becomes a birthday. They exist because the previous approach —
 * "trust whatever is on a calendar named 'Friends & Family'" — was replaced by
 * content rules that now run against EVERY calendar, so a bad rule creates
 * junk contacts rather than just missing a few.
 *
 * The real-world strings below are taken from a live 2,216-event database.
 */

import { parseEventTitle } from '../birthday-detect';

const D = '2026-03-14';
const parse = (
  title: string,
  opts: { recurring?: boolean; lifeEvents?: boolean; description?: string | null } = {},
) =>
  parseEventTitle(
    title,
    D,
    opts.description ?? null,
    opts.lifeEvents ?? false,
    opts.recurring ?? false,
  );

describe('birthdays', () => {
  it('detects a birthday and strips the possessive', () => {
    expect(parse("Sarah's Birthday")).toMatchObject({ name: 'Sarah', eventType: 'birthday' });
  });

  it('handles the other title shapes people use', () => {
    expect(parse('Birthday - Sarah')).toMatchObject({ name: 'Sarah' });
    expect(parse('Sarah - Birthday')).toMatchObject({ name: 'Sarah' });
  });

  it('takes the year from the title and removes it from the name', () => {
    expect(parse("Grandma's Birthday (1948)")).toMatchObject({ name: 'Grandma', year: 1948 });
  });

  it('takes the year from the description when the title has none', () => {
    expect(parse("Grandma's Birthday", { description: 'born 1948' })).toMatchObject({ year: 1948 });
  });

  it('strips trailing punctuation', () => {
    // Real title: "Halvorsen's Birthday!"
    expect(parse("Halvorsen's Birthday!")).toMatchObject({ name: 'Halvorsen' });
  });
});

describe('anniversaries', () => {
  it('detects the keyword anywhere, with no designated calendar', () => {
    expect(parse('Mum & Dad Anniversary')).toMatchObject({ eventType: 'anniversary' });
  });
});

describe('milestones', () => {
  // Real titles: "Ana ❤️ Ben (2005)", "CJT ❤️ MRT (1977)". The signal is the
  // year plus the annual repeat — NOT the heart, which is one user's habit.
  it('detects a recurring event carrying a year, with no keyword', () => {
    expect(parse('Ana ❤️ Ben (2005)', { recurring: true }))
      .toMatchObject({ eventType: 'milestone', year: 2005 });
  });

  it('does not depend on the heart character', () => {
    expect(parse('Ana and Ben (2005)', { recurring: true }))
      .toMatchObject({ eventType: 'milestone', year: 2005 });
  });

  it('ignores the same title when it is a one-off', () => {
    // Without the annual repeat there is nothing to distinguish it from any
    // other all-day entry that happens to mention a year.
    expect(parse('Ana ❤️ Ben (2005)', { recurring: false })).toBeNull();
  });

  it('ignores a recurring all-day event with no year', () => {
    expect(parse('Bin day', { recurring: true })).toBeNull();
  });
});

describe('other languages', () => {
  // Prism ships a German UI, so a German household writes German titles. An
  // English-only matcher would detect nothing for them and fail silently.
  it('detects a German birthday and strips the keyword from the name', () => {
    expect(parse('Omas Geburtstag')).toMatchObject({ name: 'Omas', eventType: 'birthday' });
  });

  it('keeps the genitive -s, because German names end in s too', () => {
    // No apostrophe in German, so "Lukas" is both a name and a genitive form.
    // Stripping a trailing s would turn Lukas into Luka.
    expect(parse('Lukas Geburtstag')).toMatchObject({ name: 'Lukas' });
  });

  it('detects a German birthday with a year', () => {
    expect(parse('Lukas Geburtstag (1990)')).toMatchObject({ eventType: 'birthday', year: 1990 });
  });

  it('detects a German anniversary', () => {
    expect(parse('Hochzeitstag')).toMatchObject({ eventType: 'anniversary' });
    expect(parse('Jubiläum Oma und Opa')).toMatchObject({ name: 'Oma und Opa', eventType: 'anniversary' });
  });

  it('rejects a German birthday party', () => {
    expect(parse('Geburtstagsfeier bei Lukas')).toBeNull();
  });
});

describe('false positives that reached production data', () => {
  it('rejects preparation for a birthday', () => {
    // Real title, on a writable family calendar — would have imported a
    // person called "Prep for Ana".
    expect(parse("Prep for Ana's birthday (party)")).toBeNull();
  });

  it('rejects a public holiday named after a person', () => {
    // Real title, from a subscribed school calendar.
    expect(parse("No School~Dr. Martin Luther King's Birthday")).toBeNull();
  });

  it('rejects social events happening near a birthday', () => {
    expect(parse("Dinner for Sam's birthday")).toBeNull();
    expect(parse('Birthday party at the park')).toBeNull();
    expect(parse("Sleepover for Amy's birthday")).toBeNull();
  });

  it('ignores anything with no life-event signal at all', () => {
    expect(parse('Dentist')).toBeNull();
    expect(parse('School closed')).toBeNull();
  });
});

describe('designated life-events calendar (optional override)', () => {
  it('accepts a keyword-free, non-recurring title', () => {
    expect(parse('Moved to the new house', { lifeEvents: true }))
      .toMatchObject({ eventType: 'milestone' });
  });

  it('trusts the calendar over the negative-keyword list', () => {
    // The user vouched for this calendar, so "party" is no longer a veto.
    expect(parse('Retirement party (2019)', { lifeEvents: true })).not.toBeNull();
  });
});
