/**
 * Editing an event on a CalDAV server (#687).
 *
 * The old writer rebuilt the object from title, description, location and
 * times, so saving an edit would have dropped alarms, attendees, the repeat
 * rule and every property another app stores. These tests take an object that
 * carries all of those, edit one field, and check that every other line comes
 * back exactly as it was. New events are PUT as their own object.
 */
import ICAL from 'ical.js';
import { applyCalDAVEventChanges, createCalDAVEvent, icalTimeToDate, patchCalDAVEvent } from '../caldav';

const TZ = 'America/Chicago';
const NOW = new Date('2026-11-01T12:00:00Z');

// Lines a client may not add or change on its own. Folded lines are unfolded
// before comparing (RFC 5545 3.1).
const VTIMEZONE_CHICAGO = [
  'BEGIN:VTIMEZONE',
  'TZID:America/Chicago',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0600',
  'TZOFFSETTO:-0500',
  'TZNAME:CDT',
  'DTSTART:20070311T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0600',
  'TZNAME:CST',
  'DTSTART:20071104T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

const RICH = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Example Corp//Phone Calendar//EN',
  'CALSCALE:GREGORIAN',
  ...VTIMEZONE_CHICAGO,
  'BEGIN:VEVENT',
  'UID:rich@example.com',
  'DTSTAMP:20261001T080000Z',
  'CREATED:20261001T080000Z',
  'SEQUENCE:2',
  'DTSTART;TZID=America/Chicago:20261110T090000',
  'DTEND;TZID=America/Chicago:20261110T100000',
  'SUMMARY:Dentist',
  'DESCRIPTION:Bring the insurance card',
  'LOCATION:Main Street Clinic',
  'ORGANIZER;CN=Sam Example:mailto:sam@example.com',
  'ATTENDEE;CN=Alex Example;PARTSTAT=ACCEPTED;ROLE=REQ-PARTICIPANT:mailto:alex@example.com',
  'CATEGORIES:Health,Family',
  'URL:https://clinic.example.com/booking/42',
  'X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC',
  'X-EXAMPLE-COLOR;X-SCHEME=rgb:12,34,56',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  'DESCRIPTION:Reminder',
  'TRIGGER:-PT30M',
  'X-WR-ALARMUID:alarm-1',
  'END:VALARM',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

function lines(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, '').split(/\r\n/).filter(Boolean);
}

/** The lines of `after` that are not in `before`, and the ones that went. */
function lineDiff(before: string, after: string) {
  const a = lines(before);
  const b = lines(after);
  return {
    added: b.filter((l) => !a.includes(l)),
    removed: a.filter((l) => !b.includes(l)),
  };
}

const STAMPS = ['DTSTAMP:20261101T120000Z', 'LAST-MODIFIED:20261101T120000Z'];

function vevent(ics: string, uid: string): ICAL.Component {
  return new ICAL.Component(ICAL.parse(ics))
    .getAllSubcomponents('vevent')
    .find((v) => v.getFirstPropertyValue('uid') === uid && !v.hasProperty('recurrence-id'))!;
}

/** The instants Prism's read path takes from the written object. */
function readBack(ics: string, uid: string) {
  const v = vevent(ics, uid);
  const ev = new ICAL.Event(v);
  const allDay = v.getFirstProperty('dtstart')!.type === 'date';
  return {
    start: icalTimeToDate(ev.startDate, allDay, TZ).toISOString(),
    end: icalTimeToDate(ev.endDate, allDay, TZ).toISOString(),
  };
}

function simple(...props: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:s@example.com', 'SUMMARY:Practice', ...props,
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

describe('applyCalDAVEventChanges', () => {
  it('changes the title and keeps every other line as it was', () => {
    const out = applyCalDAVEventChanges(RICH, 'rich@example.com', { title: 'Dentist (moved room)' }, TZ, NOW)!;
    expect(lineDiff(RICH, out)).toEqual({
      added: ['DTSTAMP:20261101T120000Z', 'SUMMARY:Dentist (moved room)', 'LAST-MODIFIED:20261101T120000Z'],
      removed: ['DTSTAMP:20261001T080000Z', 'SUMMARY:Dentist'],
    });
  });

  it('removes a cleared location and nothing else', () => {
    const out = applyCalDAVEventChanges(RICH, 'rich@example.com', { location: null }, TZ, NOW)!;
    const diff = lineDiff(RICH, out);
    expect(diff.removed).toEqual(['DTSTAMP:20261001T080000Z', 'LOCATION:Main Street Clinic']);
    expect(diff.added).toEqual(STAMPS);
  });

  it('writes nothing when every field already matches', () => {
    expect(applyCalDAVEventChanges(RICH, 'rich@example.com', {
      title: 'Dentist',
      description: 'Bring the insurance card',
      location: 'Main Street Clinic',
      times: {
        startTime: new Date('2026-11-10T15:00:00Z'),
        endTime: new Date('2026-11-10T16:00:00Z'),
        allDay: false,
      },
    }, TZ, NOW)).toBeNull();
  });

  it('strips a bare CR so a description cannot forge another property', () => {
    const out = applyCalDAVEventChanges(RICH, 'rich@example.com',
      { description: 'Notes\rATTENDEE:mailto:intruder@example.com' }, TZ, NOW)!;
    expect(out).not.toMatch(/\rATTENDEE:mailto:intruder/);
  });

  it('moves a time in its own TZID, keeping the VTIMEZONE and bumping SEQUENCE', () => {
    const times = {
      startTime: new Date('2026-11-10T17:30:00Z'), // 11:30 CST
      endTime: new Date('2026-11-10T18:30:00Z'),
      allDay: false,
    };
    const out = applyCalDAVEventChanges(RICH, 'rich@example.com', { times }, TZ, NOW)!;
    const diff = lineDiff(RICH, out);
    expect(diff.removed.sort()).toEqual([
      'DTEND;TZID=America/Chicago:20261110T100000',
      'DTSTAMP:20261001T080000Z',
      'DTSTART;TZID=America/Chicago:20261110T090000',
      'SEQUENCE:2',
    ]);
    expect(diff.added.sort()).toEqual([
      'DTEND;TZID=America/Chicago:20261110T123000',
      'DTSTAMP:20261101T120000Z',
      'DTSTART;TZID=America/Chicago:20261110T113000',
      'LAST-MODIFIED:20261101T120000Z',
      'SEQUENCE:3',
    ]);
    expect(readBack(out, 'rich@example.com')).toEqual({
      start: '2026-11-10T17:30:00.000Z',
      end: '2026-11-10T18:30:00.000Z',
    });
  });

  it('converts with the object\'s own VTIMEZONE when the TZID is not an IANA name', () => {
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0',
      'BEGIN:VTIMEZONE', 'TZID:Custom Plus Two', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0200', 'END:STANDARD', 'END:VTIMEZONE',
      'BEGIN:VEVENT', 'UID:c@example.com', 'SUMMARY:Call',
      'DTSTART;TZID=Custom Plus Two:20261110T090000', 'DTEND;TZID=Custom Plus Two:20261110T100000',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const out = applyCalDAVEventChanges(ics, 'c@example.com', { times: {
      startTime: new Date('2026-11-10T10:00:00Z'),
      endTime: new Date('2026-11-10T11:00:00Z'),
      allDay: false,
    } }, TZ, NOW)!;
    expect(lines(out)).toContain('DTSTART;TZID=Custom Plus Two:20261110T120000');
    expect(lines(out)).toContain('DTEND;TZID=Custom Plus Two:20261110T130000');
  });

  it('keeps an IANA TZID that has no VTIMEZONE', () => {
    const ics = simple('DTSTART;TZID=Asia/Tokyo:20261110T090000', 'DTEND;TZID=Asia/Tokyo:20261110T100000');
    const out = applyCalDAVEventChanges(ics, 's@example.com', { times: {
      startTime: new Date('2026-11-10T01:00:00Z'), // 10:00 JST
      endTime: new Date('2026-11-10T02:00:00Z'),
      allDay: false,
    } }, TZ, NOW)!;
    expect(lines(out)).toContain('DTSTART;TZID=Asia/Tokyo:20261110T100000');
    expect(lines(out)).toContain('DTEND;TZID=Asia/Tokyo:20261110T110000');
  });

  it('keeps a floating time floating, in the household zone', () => {
    const ics = simple('DTSTART:20261110T090000', 'DTEND:20261110T100000');
    const out = applyCalDAVEventChanges(ics, 's@example.com', { times: {
      startTime: new Date('2026-11-10T16:00:00Z'), // 10:00 CST
      endTime: new Date('2026-11-10T17:00:00Z'),
      allDay: false,
    } }, TZ, NOW)!;
    expect(lines(out)).toContain('DTSTART:20261110T100000');
    expect(lines(out)).toContain('DTEND:20261110T110000');
  });

  it('keeps a UTC time in UTC', () => {
    const ics = simple('DTSTART:20261110T090000Z', 'DTEND:20261110T100000Z');
    const out = applyCalDAVEventChanges(ics, 's@example.com', { times: {
      startTime: new Date('2026-11-10T10:00:00Z'),
      endTime: new Date('2026-11-10T11:00:00Z'),
      allDay: false,
    } }, TZ, NOW)!;
    expect(lines(out)).toContain('DTSTART:20261110T100000Z');
    expect(lines(out)).toContain('DTEND:20261110T110000Z');
  });

  it('turns a timed event all-day as plain dates without a TZID', () => {
    const out = applyCalDAVEventChanges(RICH, 'rich@example.com', { times: {
      startTime: new Date('2026-11-10T00:00:00Z'),
      endTime: new Date('2026-11-11T00:00:00Z'),
      allDay: true,
    } }, TZ, NOW)!;
    expect(lines(out)).toContain('DTSTART;VALUE=DATE:20261110');
    expect(lines(out)).toContain('DTEND;VALUE=DATE:20261111');
    expect(readBack(out, 'rich@example.com')).toEqual({
      start: '2026-11-10T00:00:00.000Z',
      end: '2026-11-11T00:00:00.000Z',
    });
  });

  it('turns an all-day event timed, in UTC', () => {
    const ics = simple('DTSTART;VALUE=DATE:20261110', 'DTEND;VALUE=DATE:20261111');
    const out = applyCalDAVEventChanges(ics, 's@example.com', { times: {
      startTime: new Date('2026-11-10T15:00:00Z'),
      endTime: new Date('2026-11-10T16:00:00Z'),
      allDay: false,
    } }, TZ, NOW)!;
    expect(lines(out)).toContain('DTSTART:20261110T150000Z');
    expect(lines(out)).toContain('DTEND:20261110T160000Z');
  });

  it('updates DURATION when the event has no DTEND', () => {
    const ics = simple('DTSTART:20261110T090000Z', 'DURATION:PT1H');
    const out = applyCalDAVEventChanges(ics, 's@example.com', { times: {
      startTime: new Date('2026-11-10T09:00:00Z'),
      endTime: new Date('2026-11-10T10:30:00Z'),
      allDay: false,
    } }, TZ, NOW)!;
    expect(lines(out)).toContain('DURATION:PT1H30M');
    expect(lines(out).some((l) => l.startsWith('DTEND'))).toBe(false);
  });

  describe('a repeating series', () => {
    const SERIES = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      ...VTIMEZONE_CHICAGO,
      'BEGIN:VEVENT',
      'UID:series@example.com',
      'DTSTAMP:20261001T080000Z',
      'DTSTART;TZID=America/Chicago:20261103T170000',
      'DTEND;TZID=America/Chicago:20261103T180000',
      'RRULE:FREQ=WEEKLY;BYDAY=TU',
      'EXDATE;TZID=America/Chicago:20261117T170000',
      'SUMMARY:Swim practice',
      'X-EXAMPLE-TEAM:Dolphins',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:series@example.com',
      'DTSTAMP:20261001T080000Z',
      'RECURRENCE-ID;TZID=America/Chicago:20261110T170000',
      'DTSTART;TZID=America/Chicago:20261110T180000',
      'DTEND;TZID=America/Chicago:20261110T190000',
      'SUMMARY:Swim practice (late lane)',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    it('renames the series on its master VEVENT and leaves the edited occurrence alone', () => {
      const out = applyCalDAVEventChanges(SERIES, 'series@example.com', { title: 'Swim' }, TZ, NOW)!;
      const diff = lineDiff(SERIES, out);
      expect(diff.removed).toEqual(['SUMMARY:Swim practice']);
      expect(diff.added.sort()).toEqual([...STAMPS, 'SUMMARY:Swim'].sort());
      // Both VEVENTs carried the old DTSTAMP; only the master is restamped.
      expect(lines(out).filter((l) => l === 'DTSTAMP:20261001T080000Z')).toHaveLength(1);
      expect(lines(out)).toContain('SUMMARY:Swim practice (late lane)');
      expect(lines(out)).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU');
      expect(lines(out)).toContain('EXDATE;TZID=America/Chicago:20261117T170000');
    });

    it('refuses to move the times of the series', () => {
      expect(() => applyCalDAVEventChanges(SERIES, 'series@example.com', { times: {
        startTime: new Date('2026-11-03T22:00:00Z'),
        endTime: new Date('2026-11-03T23:00:00Z'),
        allDay: false,
      } }, TZ, NOW)).toThrow(/repeating/);
    });

    it('accepts the series\' own times unchanged alongside a text edit', () => {
      const out = applyCalDAVEventChanges(SERIES, 'series@example.com', {
        title: 'Swim',
        times: {
          startTime: new Date('2026-11-03T23:00:00Z'), // 17:00 CST
          endTime: new Date('2026-11-04T00:00:00Z'),
          allDay: false,
        },
      }, TZ, NOW);
      expect(out).not.toBeNull();
      expect(lines(out!)).toContain('DTSTART;TZID=America/Chicago:20261103T170000');
    });
  });

  it('throws when the object has no event with that UID', () => {
    expect(() => applyCalDAVEventChanges(RICH, 'other@example.com', { title: 'X' }, TZ, NOW)).toThrow(/UID/);
  });
});

describe('patchCalDAVEvent', () => {
  const HREF = 'https://dav.example.com/cal/rich.ics';
  let fetchMock: jest.SpyInstance;

  function respond(status: number, body = '', etag?: string): Response {
    return new Response(status === 204 ? null : body, {
      status,
      headers: etag ? { ETag: etag } : {},
    });
  }

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  const put = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT');

  it('reads the object, PUTs the edit with If-Match on its ETag, and returns the new ETag', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(200, RICH, '"v1"'))
      .mockResolvedValueOnce(respond(204, '', '"v2"'));

    const result = await patchCalDAVEvent('https://dav.example.com', 'u', 'p', HREF, 'rich@example.com',
      { title: 'Dentist (moved room)' }, TZ);

    expect(result).toEqual({ ok: true, etag: '"v2"' });
    const [[url, init]] = put();
    expect(url).toBe(HREF);
    expect(init.headers['If-Match']).toBe('"v1"');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`);
    expect(lines(init.body)).toContain('SUMMARY:Dentist (moved room)');
    expect(lines(init.body)).toContain('BEGIN:VALARM');
  });

  it('does not PUT when nothing changed', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, RICH, '"v1"'));
    const result = await patchCalDAVEvent('https://dav.example.com', 'u', 'p', HREF, 'rich@example.com',
      { title: 'Dentist' }, TZ);
    expect(result).toEqual({ ok: true, etag: '"v1"' });
    expect(put()).toHaveLength(0);
  });

  it('on a 412 reads again and applies the edit on top of the other app\'s change', async () => {
    const changedElsewhere = RICH.replace('LOCATION:Main Street Clinic', 'LOCATION:Second Street Clinic');
    fetchMock
      .mockResolvedValueOnce(respond(200, RICH, '"v1"'))
      .mockResolvedValueOnce(respond(412))
      .mockResolvedValueOnce(respond(200, changedElsewhere, '"v2"'))
      .mockResolvedValueOnce(respond(204, '', '"v3"'));

    const result = await patchCalDAVEvent('https://dav.example.com', 'u', 'p', HREF, 'rich@example.com',
      { title: 'Dentist (moved room)' }, TZ);

    expect(result).toEqual({ ok: true, etag: '"v3"' });
    const second = put()[1]![1];
    expect(second.headers['If-Match']).toBe('"v2"');
    expect(lines(second.body)).toContain('LOCATION:Second Street Clinic');
    expect(lines(second.body)).toContain('SUMMARY:Dentist (moved room)');
  });

  it('reports a conflict after a second 412 instead of overwriting', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(200, RICH, '"v1"'))
      .mockResolvedValueOnce(respond(412))
      .mockResolvedValueOnce(respond(200, RICH, '"v2"'))
      .mockResolvedValueOnce(respond(412));

    const result = await patchCalDAVEvent('https://dav.example.com', 'u', 'p', HREF, 'rich@example.com',
      { title: 'Dentist (moved room)' }, TZ);

    expect(result).toMatchObject({ ok: false, reason: 'conflict' });
    expect(put()).toHaveLength(2);
  });

  it('reports a read-only calendar as forbidden', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(200, RICH, '"v1"'))
      .mockResolvedValueOnce(respond(403));
    const result = await patchCalDAVEvent('https://dav.example.com', 'u', 'p', HREF, 'rich@example.com',
      { title: 'Dentist (moved room)' }, TZ);
    expect(result).toMatchObject({ ok: false, reason: 'forbidden' });
  });

  it('reports a missing object as not found', async () => {
    fetchMock.mockResolvedValueOnce(respond(404));
    const result = await patchCalDAVEvent('https://dav.example.com', 'u', 'p', HREF, 'rich@example.com',
      { title: 'X' }, TZ);
    expect(result).toMatchObject({ ok: false, reason: 'not-found' });
    expect(put()).toHaveLength(0);
  });
});

describe('createCalDAVEvent', () => {
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  const EV = {
    uid: 'c0ffee00-1111-4222-8333-444455556666',
    title: 'Book fair',
    location: 'School library',
    startTime: new Date('2026-11-12T14:00:00Z'),
    endTime: new Date('2026-11-12T15:30:00Z'),
  };

  it('PUTs a new object named by the UID, refusing to replace one, and returns href and ETag', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201, headers: { ETag: '"n1"' } }));

    const result = await createCalDAVEvent('https://dav.example.com', 'u', 'p', 'https://dav.example.com/cal/home', EV);

    const href = 'https://dav.example.com/cal/home/c0ffee00-1111-4222-8333-444455556666.ics';
    expect(result).toEqual({ ok: true, href, etag: '"n1"' });
    const [[url, init]] = fetchMock.mock.calls;
    expect(url).toBe(href);
    expect(init.method).toBe('PUT');
    expect(init.headers['If-None-Match']).toBe('*');
    const body = lines(init.body);
    expect(body).toContain('UID:c0ffee00-1111-4222-8333-444455556666');
    expect(body).toContain('SUMMARY:Book fair');
    expect(body).toContain('LOCATION:School library');
    expect(body).toContain('DTSTART:20261112T140000Z');
    expect(body).toContain('DTEND:20261112T153000Z');
  });

  it('writes an all-day event as plain dates', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }));
    const result = await createCalDAVEvent('https://dav.example.com', 'u', 'p', 'https://dav.example.com/cal/home/', {
      ...EV,
      startTime: new Date('2026-11-12T00:00:00Z'),
      endTime: new Date('2026-11-13T00:00:00Z'),
      allDay: true,
    });
    expect(result).toMatchObject({ ok: true, etag: null });
    const body = lines(fetchMock.mock.calls[0]![1].body);
    expect(body).toContain('DTSTART;VALUE=DATE:20261112');
    expect(body).toContain('DTEND;VALUE=DATE:20261113');
  });

  it('reports a read-only calendar as forbidden', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    const result = await createCalDAVEvent('https://dav.example.com', 'u', 'p', 'https://dav.example.com/cal/home/', EV);
    expect(result).toMatchObject({ ok: false, reason: 'forbidden' });
  });
});
