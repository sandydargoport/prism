import ICAL from 'ical.js';
import { buildVTimezone } from '../vtimezone';

/** The UTC instant of a wall time in the zone a VTIMEZONE defines, read by ical.js. */
function readWall(vtimezone: string, tzid: string, wall: string): string {
  const component = new ICAL.Component(ICAL.parse(`BEGIN:VCALENDAR\r\n${vtimezone}\r\nEND:VCALENDAR`))
    .getFirstSubcomponent('vtimezone')!;
  const zone = new ICAL.Timezone({ component, tzid });
  const time = ICAL.Time.fromDateTimeString(wall);
  time.zone = zone;
  return time.toJSDate().toISOString();
}

describe('buildVTimezone', () => {
  it('writes the US rules: second Sunday of March, first Sunday of November', () => {
    const text = buildVTimezone('America/Chicago', 2026);
    expect(text).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU');
    expect(text).toContain('RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU');
    expect(text).toContain('TZOFFSETTO:-0500');
    expect(text).toContain('TZOFFSETTO:-0600');
  });

  it('writes the EU rules: last Sunday of March and of October', () => {
    const text = buildVTimezone('Europe/Berlin', 2026);
    expect(text).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU');
    expect(text).toContain('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU');
  });

  it('gives a zone without clock changes one offset', () => {
    const text = buildVTimezone('Asia/Tokyo', 2026);
    expect(text).toContain('TZOFFSETFROM:+0900');
    expect(text).not.toContain('DAYLIGHT');
  });

  it('places wall times on either side of the clock changes, in the year and the next', () => {
    for (const [tzid, wall, utc] of [
      ['America/Chicago', '2026-07-01T09:00:00', '2026-07-01T14:00:00.000Z'],
      ['America/Chicago', '2026-12-01T09:00:00', '2026-12-01T15:00:00.000Z'],
      ['America/Chicago', '2027-03-15T09:00:00', '2027-03-15T14:00:00.000Z'],
      ['Europe/Berlin', '2026-07-01T09:00:00', '2026-07-01T07:00:00.000Z'],
      ['Europe/Berlin', '2027-01-15T09:00:00', '2027-01-15T08:00:00.000Z'],
      ['Australia/Sydney', '2026-07-01T09:00:00', '2026-06-30T23:00:00.000Z'],
      ['Australia/Sydney', '2027-01-15T09:00:00', '2027-01-14T22:00:00.000Z'],
    ] as const) {
      expect(readWall(buildVTimezone(tzid, 2026), tzid, wall)).toBe(utc);
    }
  });
});
