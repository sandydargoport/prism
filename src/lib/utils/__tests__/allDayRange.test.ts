import { normalizeAllDayRange } from '../allDayRange';

const iso = (r: { start: Date; end: Date }) => [r.start.toISOString(), r.end.toISOString()];
const d = (s: string) => new Date(s);

describe('normalizeAllDayRange', () => {
  it('passes a floating range through unchanged', () => {
    expect(iso(normalizeAllDayRange(d('2026-09-28T00:00:00Z'), d('2026-09-30T00:00:00Z'), 'America/Chicago')))
      .toEqual(['2026-09-28T00:00:00.000Z', '2026-09-30T00:00:00.000Z']);
  });

  it('reads local midnights as their dates (west of UTC)', () => {
    // Midnight to midnight in Chicago (CDT): 05:00Z to 05:00Z.
    expect(iso(normalizeAllDayRange(d('2026-09-28T05:00:00Z'), d('2026-09-29T05:00:00Z'), 'America/Chicago')))
      .toEqual(['2026-09-28T00:00:00.000Z', '2026-09-29T00:00:00.000Z']);
  });

  it('reads local midnights as their dates (east of UTC)', () => {
    // Midnight 28 Sep in Tokyo is 15:00Z on the 27th.
    expect(iso(normalizeAllDayRange(d('2026-09-27T15:00:00Z'), d('2026-09-28T15:00:00Z'), 'Asia/Tokyo')))
      .toEqual(['2026-09-28T00:00:00.000Z', '2026-09-29T00:00:00.000Z']);
  });

  it('makes an inclusive 23:59 end exclusive', () => {
    // 28 Sep 00:00 to 23:59 in Chicago.
    expect(iso(normalizeAllDayRange(d('2026-09-28T05:00:00Z'), d('2026-09-29T04:59:00Z'), 'America/Chicago')))
      .toEqual(['2026-09-28T00:00:00.000Z', '2026-09-29T00:00:00.000Z']);
  });

  it('is never shorter than one day', () => {
    expect(iso(normalizeAllDayRange(d('2026-09-28T00:00:00Z'), d('2026-09-28T00:00:00Z'), 'UTC')))
      .toEqual(['2026-09-28T00:00:00.000Z', '2026-09-29T00:00:00.000Z']);
  });
});
