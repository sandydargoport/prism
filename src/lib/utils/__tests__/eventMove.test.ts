import { moveEventToDay } from '../eventMove';

const CHICAGO = 'America/Chicago';
const iso = (r: { startTime: Date; endTime: Date }) => [r.startTime.toISOString(), r.endTime.toISOString()];

describe('moveEventToDay', () => {
  it('moves an all-day event by whole days, whatever the display zone', () => {
    // 28 Sep all day, stored as UTC midnight; west of UTC its start is the 27th's evening.
    const event = { startTime: new Date('2026-09-28T00:00:00Z'), endTime: new Date('2026-09-29T00:00:00Z'), allDay: true };
    for (const zone of [CHICAGO, 'Asia/Tokyo', 'UTC']) {
      expect(iso(moveEventToDay(event, '2026-09-30', zone)))
        .toEqual(['2026-09-30T00:00:00.000Z', '2026-10-01T00:00:00.000Z']);
    }
  });

  it('keeps a multi-day all-day event its length', () => {
    const event = { startTime: new Date('2026-09-28T00:00:00Z'), endTime: new Date('2026-10-01T00:00:00Z'), allDay: true };
    expect(iso(moveEventToDay(event, '2026-09-25', CHICAGO)))
      .toEqual(['2026-09-25T00:00:00.000Z', '2026-09-28T00:00:00.000Z']);
  });

  it('keeps a timed event its wall time in the display zone', () => {
    // 20:00 CDT on 28 Sep (01:00Z on the 29th), an hour long, dragged to the 30th.
    const event = { startTime: new Date('2026-09-29T01:00:00Z'), endTime: new Date('2026-09-29T02:00:00Z'), allDay: false };
    expect(iso(moveEventToDay(event, '2026-09-30', CHICAGO)))
      .toEqual(['2026-10-01T01:00:00.000Z', '2026-10-01T02:00:00.000Z']);
  });

  it('keeps the wall time across a DST change', () => {
    // 9 AM CDT on Sat 31 Oct, dragged to Mon 2 Nov (CST): still 9 AM, now 15:00Z.
    const event = { startTime: new Date('2026-10-31T14:00:00Z'), endTime: new Date('2026-10-31T15:30:00Z'), allDay: false };
    expect(iso(moveEventToDay(event, '2026-11-02', CHICAGO)))
      .toEqual(['2026-11-02T15:00:00.000Z', '2026-11-02T16:30:00.000Z']);
  });
});
