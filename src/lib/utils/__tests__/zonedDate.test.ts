import {
  addDaysToKey,
  calendarDaysBetween,
  dateOnlyToFloatingUtc,
  dayWindowUtc,
  floatingUtcToDateKey,
  nextAnnualOccurrence,
  parseDateOnly,
  startOfMonthKey,
  startOfWeekKey,
  startOfYearKey,
  todayKey,
  wallTimeAt,
  wallTimeToday,
  weekdayOfKey,
  zonedWallTimeToUtc,
} from '../zonedDate';

// Every expectation is written as a UTC instant or a date key, and every call
// passes its zone, so these pass identically under each zone test-tz.sh runs.
const CHICAGO = 'America/Chicago';
const TOKYO = 'Asia/Tokyo';
const SYDNEY = 'Australia/Sydney';
const KIRITIMATI = 'Pacific/Kiritimati';

const iso = (d: Date) => d.toISOString();

describe('todayKey', () => {
  // 01:30Z is evening of the previous day across the Americas and already
  // mid-morning in Asia: the hour a process-zone "today" goes wrong.
  const at = new Date('2026-06-15T01:30:00Z');

  it.each([
    ['UTC', '2026-06-15'],
    [CHICAGO, '2026-06-14'],
    ['Pacific/Honolulu', '2026-06-14'],
    [TOKYO, '2026-06-15'],
    [KIRITIMATI, '2026-06-15'],
  ])('in %s', (zone, expected) => {
    expect(todayKey(zone, at)).toBe(expected);
  });

  it('rolls at local midnight, not UTC midnight', () => {
    expect(todayKey(CHICAGO, new Date('2026-06-15T04:59:59Z'))).toBe('2026-06-14');
    expect(todayKey(CHICAGO, new Date('2026-06-15T05:00:00Z'))).toBe('2026-06-15');
    expect(todayKey(KIRITIMATI, new Date('2026-06-14T09:59:59Z'))).toBe('2026-06-14');
    expect(todayKey(KIRITIMATI, new Date('2026-06-14T10:00:00Z'))).toBe('2026-06-15');
  });

  it('crosses a year boundary', () => {
    expect(todayKey(CHICAGO, new Date('2027-01-01T01:30:00Z'))).toBe('2026-12-31');
    expect(todayKey(TOKYO, new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
  });

  it('accepts a timestamp', () => {
    expect(todayKey(TOKYO, Date.parse('2026-06-14T15:00:00Z'))).toBe('2026-06-15');
  });

  it('throws on an unknown zone instead of guessing', () => {
    expect(() => todayKey('Not/AZone')).toThrow(RangeError);
  });
});

describe('zonedWallTimeToUtc', () => {
  it('converts an ordinary wall time', () => {
    expect(iso(zonedWallTimeToUtc('2026-06-15', '07:30', CHICAGO))).toBe('2026-06-15T12:30:00.000Z');
    expect(iso(zonedWallTimeToUtc('2026-06-15', '07:30', TOKYO))).toBe('2026-06-14T22:30:00.000Z');
    expect(iso(zonedWallTimeToUtc('2026-06-15', '00:00', KIRITIMATI))).toBe('2026-06-14T10:00:00.000Z');
  });

  it('uses the offset in force on that date, either side of a DST change', () => {
    expect(iso(zonedWallTimeToUtc('2026-03-07', '09:00', CHICAGO))).toBe('2026-03-07T15:00:00.000Z');
    expect(iso(zonedWallTimeToUtc('2026-03-08', '09:00', CHICAGO))).toBe('2026-03-08T14:00:00.000Z');
    expect(iso(zonedWallTimeToUtc('2026-10-31', '09:00', CHICAGO))).toBe('2026-10-31T14:00:00.000Z');
    expect(iso(zonedWallTimeToUtc('2026-11-01', '09:00', CHICAGO))).toBe('2026-11-01T15:00:00.000Z');
  });

  it('moves a time in the spring-forward gap forward by the gap', () => {
    // 02:00-02:59 does not exist in Chicago on 2026-03-08.
    expect(iso(zonedWallTimeToUtc('2026-03-08', '02:30', CHICAGO))).toBe('2026-03-08T08:30:00.000Z');
    expect(iso(zonedWallTimeToUtc('2026-03-08', '01:59', CHICAGO))).toBe('2026-03-08T07:59:00.000Z');
    expect(iso(zonedWallTimeToUtc('2026-03-08', '03:00', CHICAGO))).toBe('2026-03-08T08:00:00.000Z');
  });

  it('takes the first of the two times in the fall-back overlap', () => {
    // 01:00-01:59 happens twice in Chicago on 2026-11-01; CDT comes first.
    expect(iso(zonedWallTimeToUtc('2026-11-01', '01:30', CHICAGO))).toBe('2026-11-01T06:30:00.000Z');
    expect(iso(zonedWallTimeToUtc('2026-11-01', '02:00', CHICAGO))).toBe('2026-11-01T08:00:00.000Z');
  });

  it('handles southern-hemisphere DST', () => {
    // Sydney springs forward on 2026-10-04 (02:00 AEST becomes 03:00 AEDT).
    expect(iso(zonedWallTimeToUtc('2026-10-03', '09:00', SYDNEY))).toBe('2026-10-02T23:00:00.000Z');
    expect(iso(zonedWallTimeToUtc('2026-10-04', '09:00', SYDNEY))).toBe('2026-10-03T22:00:00.000Z');
    expect(iso(zonedWallTimeToUtc('2026-10-04', '02:30', SYDNEY))).toBe('2026-10-03T16:30:00.000Z');
  });

  it.each([
    ['2026-02-30', '09:00'],
    ['2026-6-15', '09:00'],
    ['2026-06-15', '24:00'],
    ['2026-06-15', '9:60'],
    ['2026-06-15', '0930'],
  ])('rejects %s %s', (key, hhmm) => {
    expect(() => zonedWallTimeToUtc(key, hhmm, CHICAGO)).toThrow(RangeError);
  });
});

describe('wallTimeToday', () => {
  it("uses the zone's date, not the UTC date", () => {
    // 01:30Z on the 15th is still the 14th in Chicago, so a 07:30 bus there
    // is 07:30 on the 14th (already past), not on the 15th.
    const now = new Date('2026-06-15T01:30:00Z');
    expect(iso(wallTimeToday('07:30', CHICAGO, now))).toBe('2026-06-14T12:30:00.000Z');
    expect(iso(wallTimeToday('07:30', TOKYO, now))).toBe('2026-06-14T22:30:00.000Z');
  });
});

describe('dayWindowUtc', () => {
  const hours = (w: { start: Date; end: Date }) => (w.end.getTime() - w.start.getTime()) / 3_600_000;

  it('covers local midnight to local midnight', () => {
    const w = dayWindowUtc('2026-06-15', CHICAGO);
    expect(iso(w.start)).toBe('2026-06-15T05:00:00.000Z');
    expect(iso(w.end)).toBe('2026-06-16T05:00:00.000Z');
  });

  it('is 23 hours on spring-forward day and 25 on fall-back day', () => {
    expect(hours(dayWindowUtc('2026-03-08', CHICAGO))).toBe(23);
    expect(hours(dayWindowUtc('2026-11-01', CHICAGO))).toBe(25);
    expect(hours(dayWindowUtc('2026-10-04', SYDNEY))).toBe(23);
    expect(hours(dayWindowUtc('2026-06-15', TOKYO))).toBe(24);
  });

  it('places an instant near the day boundary in the right day', () => {
    const inWindow = (at: string, key: string, zone: string) => {
      const w = dayWindowUtc(key, zone);
      const t = Date.parse(at);
      return t >= w.start.getTime() && t < w.end.getTime();
    };
    expect(inWindow('2026-06-15T01:30:00Z', '2026-06-14', CHICAGO)).toBe(true);
    expect(inWindow('2026-06-15T01:30:00Z', '2026-06-15', CHICAGO)).toBe(false);
    expect(inWindow('2026-06-15T01:30:00Z', '2026-06-15', KIRITIMATI)).toBe(true);
  });

  it('starts at 01:00 where midnight itself is skipped', () => {
    // Santiago springs forward at 00:00 on 2026-09-06, so the day begins 01:00.
    const w = dayWindowUtc('2026-09-06', 'America/Santiago');
    expect(iso(w.start)).toBe('2026-09-06T04:00:00.000Z');
    expect(hours(w)).toBe(23);
  });
});

describe('parseDateOnly', () => {
  it.each([
    ['2026-03-08', '2026-03-08'],
    [' 2026-03-08 ', '2026-03-08'],
    ['2026-03-08T00:00:00.000Z', '2026-03-08'],
    ['2026-03-08T23:30:00-06:00', '2026-03-08'],
    ['2028-02-29', '2028-02-29'],
  ])('%p gives %p', (input, expected) => {
    expect(parseDateOnly(input)).toBe(expected);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-00-10', '2026-3-8', '03/08/2026', '', null, undefined])(
    'rejects %p',
    (input) => {
      expect(parseDateOnly(input as string | null | undefined)).toBeNull();
    },
  );
});

describe('floating date-only values', () => {
  it('round-trip through UTC midnight', () => {
    const d = dateOnlyToFloatingUtc('2026-11-01');
    expect(iso(d)).toBe('2026-11-01T00:00:00.000Z');
    expect(floatingUtcToDateKey(d)).toBe('2026-11-01');
  });

  it('read with the UTC getters whatever the process zone', () => {
    expect(floatingUtcToDateKey(new Date('2026-03-08T23:59:59.999Z'))).toBe('2026-03-08');
  });
});

describe('addDaysToKey and calendarDaysBetween', () => {
  it('step across month, year and leap-day boundaries', () => {
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('count whole days across DST changes', () => {
    expect(calendarDaysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(calendarDaysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(calendarDaysBetween('2026-01-01', '2027-01-01')).toBe(365);
    expect(calendarDaysBetween('2026-06-15', '2026-06-15')).toBe(0);
    expect(calendarDaysBetween('2026-06-15', '2026-06-14')).toBe(-1);
  });
});

describe('nextAnnualOccurrence', () => {
  it('returns today when the date is today', () => {
    expect(nextAnnualOccurrence('06-15', '2026-06-15')).toBe('2026-06-15');
  });

  it('returns tomorrow, not today', () => {
    expect(nextAnnualOccurrence('06-16', '2026-06-15')).toBe('2026-06-16');
  });

  it('rolls to next year once the date has passed', () => {
    expect(nextAnnualOccurrence('06-14', '2026-06-15')).toBe('2027-06-14');
    expect(nextAnnualOccurrence('01-01', '2026-12-31')).toBe('2027-01-01');
  });

  it('ignores the year of a full birth date', () => {
    expect(nextAnnualOccurrence('1990-11-01', '2026-10-31')).toBe('2026-11-01');
    expect(nextAnnualOccurrence('1904-03-08T00:00:00.000Z', '2026-03-08')).toBe('2026-03-08');
  });

  it('puts 29 February on 28 February in years without one', () => {
    expect(nextAnnualOccurrence('02-29', '2026-01-10')).toBe('2026-02-28');
    expect(nextAnnualOccurrence('02-29', '2027-03-01')).toBe('2028-02-29');
    expect(nextAnnualOccurrence('2000-02-29', '2028-02-01')).toBe('2028-02-29');
  });

  it.each(['02-30', '13-01', 'June 15', ''])('rejects %p', (input) => {
    expect(() => nextAnnualOccurrence(input, '2026-06-15')).toThrow(RangeError);
  });
});

describe('week, month and year starts', () => {
  it('reads the weekday from the key alone', () => {
    expect(weekdayOfKey('2026-02-15')).toBe(0); // Sunday
    expect(weekdayOfKey('2026-02-16')).toBe(1); // Monday
  });

  it.each([
    // [date, weekStartsOn, expected]
    ['2026-02-16', 0, '2026-02-15'],
    ['2026-02-15', 0, '2026-02-15'],
    ['2026-02-16', 1, '2026-02-16'],
    ['2026-02-15', 1, '2026-02-09'],
    // Across a month and a year boundary.
    ['2026-01-01', 0, '2025-12-28'],
    ['2026-03-01', 1, '2026-02-23'],
  ] as const)('start of the week of %s (weekStartsOn %s) is %s', (key, wso, expected) => {
    expect(startOfWeekKey(key, wso)).toBe(expected);
  });

  it('gives the month and year starts', () => {
    expect(startOfMonthKey('2026-02-16')).toBe('2026-02-01');
    expect(startOfYearKey('2026-02-16')).toBe('2026-01-01');
  });
});

describe('wallTimeAt', () => {
  it('reads the wall clock in the zone', () => {
    const instant = new Date('2026-09-29T01:30:00Z');
    expect(wallTimeAt(CHICAGO, instant)).toBe('20:30');
    expect(wallTimeAt(TOKYO, instant)).toBe('10:30');
    expect(wallTimeAt(KIRITIMATI, instant)).toBe('15:30');
  });
});
