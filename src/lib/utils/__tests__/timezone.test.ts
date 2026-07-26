import { zonedParts, isValidTimezone } from '../timezone';

describe('zonedParts', () => {
  it('converts an absolute instant into the household zone (the meal-time bug)', () => {
    // Tandoor stored 6pm Central as 23:00 UTC (via a -04:00 Eastern offset).
    const { date, time } = zonedParts('2026-07-25T19:00:00-04:00', 'America/Chicago');
    expect(time).toBe('18:00'); // 6pm Central, not 7pm Eastern / 11pm UTC
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // July (0-indexed)
    expect(date.getDate()).toBe(25);
  });

  it('same instant lands on the previous day in an earlier zone (day bucketing)', () => {
    // 00:30 UTC on the 26th is still 7:30pm on the 25th in Chicago.
    const { date, time } = zonedParts('2026-07-26T00:30:00Z', 'America/Chicago');
    expect(date.getDate()).toBe(25);
    expect(time).toBe('19:30');
  });

  it('UTC passthrough', () => {
    const { time } = zonedParts('2026-07-25T23:00:00Z', 'UTC');
    expect(time).toBe('23:00');
  });

  it('falls back to the authored wall-clock for an invalid zone', () => {
    const { time } = zonedParts('2026-07-25T18:00:00-05:00', 'Not/AZone');
    expect(time).toBe('18:00');
  });
});

describe('isValidTimezone', () => {
  it('accepts real zones and rejects junk', () => {
    expect(isValidTimezone('America/Chicago')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Not/AZone')).toBe(false);
  });
});
