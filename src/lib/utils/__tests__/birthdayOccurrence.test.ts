import { birthdayOccurrence } from '../birthdayOccurrence';
import { todayKey } from '../zonedDate';

describe('birthdayOccurrence', () => {
  it('counts a birthday today as 0 days, not next year', () => {
    expect(birthdayOccurrence('2015-10-03', '2026-10-03')).toEqual({
      nextBirthday: '2026-10-03',
      daysUntil: 0,
      age: 11,
    });
  });

  it('counts tomorrow as 1 day', () => {
    expect(birthdayOccurrence('2015-10-04', '2026-10-03')?.daysUntil).toBe(1);
  });

  it('rolls a past birthday to next year and counts the age turned then', () => {
    expect(birthdayOccurrence('2015-10-02', '2026-10-03')).toEqual({
      nextBirthday: '2027-10-02',
      daysUntil: 364,
      age: 12,
    });
  });

  it('counts whole days across a DST change', () => {
    // Chicago falls back on 2026-11-01; the gap is still 3 calendar days.
    expect(birthdayOccurrence('2000-11-02', '2026-10-30')?.daysUntil).toBe(3);
  });

  it('leaves age null for the unknown-year sentinel', () => {
    expect(birthdayOccurrence('1904-12-25', '2026-10-03')?.age).toBeNull();
  });

  it('falls on 28 February in a common year for a 29 February date', () => {
    expect(birthdayOccurrence('2008-02-29', '2027-01-10')).toEqual({
      nextBirthday: '2027-02-28',
      daysUntil: 49,
      age: 19,
    });
  });

  it('returns null for a date that does not exist', () => {
    expect(birthdayOccurrence('2015-02-30', '2026-10-03')).toBeNull();
  });

  // #521: in a zone behind UTC the old code parsed the stored date as UTC
  // midnight and read it back with local getters, a day early. The same
  // stored date must give the same next occurrence in every zone.
  it.each(['Pacific/Honolulu', 'America/Chicago', 'UTC', 'Asia/Tokyo', 'Pacific/Kiritimati'])(
    'gives the stored date in %s',
    (zone) => {
      const today = todayKey(zone, Date.UTC(2026, 9, 1, 12));
      expect(birthdayOccurrence('1990-10-15', today)?.nextBirthday).toBe('2026-10-15');
    },
  );
});
