import { expandSeries, isPrismSeries, occurrenceId, parseEventId } from '../recurrence';

const CHICAGO = 'America/Chicago';
const d = (s: string) => new Date(s);
const starts = (list: Array<{ start: Date }>) => list.map((o) => o.start.toISOString());

describe('expandSeries', () => {
  it('keeps a weekly event at its wall time across the clock change', () => {
    // Fridays 9:00-10:00 Chicago from 23 Oct 2026; clocks go back on 1 Nov.
    const row = { startTime: d('2026-10-23T14:00:00Z'), endTime: d('2026-10-23T15:00:00Z'), allDay: false, recurrenceRule: 'FREQ=WEEKLY' };
    const out = expandSeries(row, d('2026-10-20T00:00:00Z'), d('2026-11-14T00:00:00Z'), CHICAGO);
    expect(starts(out)).toEqual([
      '2026-10-23T14:00:00.000Z',
      '2026-10-30T14:00:00.000Z',
      '2026-11-06T15:00:00.000Z',
      '2026-11-13T15:00:00.000Z',
    ]);
    expect(out.every((o) => o.end.getTime() - o.start.getTime() === 60 * 60 * 1000)).toBe(true);
  });

  it('expands every other week on the chosen days', () => {
    // Tue/Thu every 2 weeks from Tue 3 Nov 2026, 17:00 Chicago (23:00Z).
    const row = { startTime: d('2026-11-03T23:00:00Z'), endTime: d('2026-11-04T00:00:00Z'), allDay: false, recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH' };
    const out = expandSeries(row, d('2026-11-01T00:00:00Z'), d('2026-11-30T00:00:00Z'), CHICAGO);
    expect(starts(out)).toEqual([
      '2026-11-03T23:00:00.000Z',
      '2026-11-05T23:00:00.000Z',
      '2026-11-17T23:00:00.000Z',
      '2026-11-19T23:00:00.000Z',
    ]);
  });

  it('expands the first Friday of each month', () => {
    const row = { startTime: d('2026-11-06T15:00:00Z'), endTime: d('2026-11-06T16:00:00Z'), allDay: false, recurrenceRule: 'FREQ=MONTHLY;BYDAY=1FR' };
    const out = expandSeries(row, d('2026-11-01T00:00:00Z'), d('2027-02-01T00:00:00Z'), CHICAGO);
    expect(starts(out)).toEqual([
      '2026-11-06T15:00:00.000Z',
      '2026-12-04T15:00:00.000Z',
      '2027-01-01T15:00:00.000Z',
    ]);
  });

  it('repeats an all-day event as floating dates', () => {
    const row = { startTime: d('2026-11-02T00:00:00Z'), endTime: d('2026-11-03T00:00:00Z'), allDay: true, recurrenceRule: 'FREQ=WEEKLY' };
    const out = expandSeries(row, d('2026-11-01T00:00:00Z'), d('2026-11-20T00:00:00Z'), CHICAGO);
    expect(out.map((o) => [o.start.toISOString(), o.end.toISOString()])).toEqual([
      ['2026-11-02T00:00:00.000Z', '2026-11-03T00:00:00.000Z'],
      ['2026-11-09T00:00:00.000Z', '2026-11-10T00:00:00.000Z'],
      ['2026-11-16T00:00:00.000Z', '2026-11-17T00:00:00.000Z'],
    ]);
  });

  it('stops after COUNT occurrences', () => {
    const row = { startTime: d('2026-11-02T15:00:00Z'), endTime: d('2026-11-02T16:00:00Z'), allDay: false, recurrenceRule: 'FREQ=DAILY;COUNT=3' };
    expect(expandSeries(row, d('2026-11-01T00:00:00Z'), d('2026-12-01T00:00:00Z'), CHICAGO)).toHaveLength(3);
  });

  it('reads a UTC UNTIL against the household wall clock', () => {
    // Daily 22:00 Chicago (04:00Z next day). UNTIL is 23:59:59 Chicago on
    // 4 Nov, which is 05:59:59Z on the 5th: the 4 Nov occurrence (04:00Z on
    // the 5th) is the last one. Read as a wall time in UTC, 22:00 on the 4th
    // would be after 05:59 and dropped.
    const row = { startTime: d('2026-11-03T04:00:00Z'), endTime: d('2026-11-03T05:00:00Z'), allDay: false, recurrenceRule: 'FREQ=DAILY;UNTIL=20261105T055959Z' };
    const out = expandSeries(row, d('2026-11-01T00:00:00Z'), d('2026-11-10T00:00:00Z'), CHICAGO);
    expect(starts(out)).toEqual([
      '2026-11-03T04:00:00.000Z',
      '2026-11-04T04:00:00.000Z',
      '2026-11-05T04:00:00.000Z',
    ]);
  });

  it('finds this week of a daily series that began years ago', () => {
    // 9:00 Chicago, daylight time then (14:00Z), standard time now (15:00Z).
    const row = { startTime: d('2016-11-02T14:00:00Z'), endTime: d('2016-11-02T15:00:00Z'), allDay: false, recurrenceRule: 'FREQ=DAILY' };
    const out = expandSeries(row, d('2026-11-02T06:00:00Z'), d('2026-11-05T06:00:00Z'), CHICAGO);
    expect(starts(out)).toEqual([
      '2026-11-02T15:00:00.000Z',
      '2026-11-03T15:00:00.000Z',
      '2026-11-04T15:00:00.000Z',
    ]);
  });

  it('includes an occurrence that started before the range and ends in it', () => {
    const row = { startTime: d('2026-11-02T04:00:00Z'), endTime: d('2026-11-02T08:00:00Z'), allDay: false, recurrenceRule: 'FREQ=DAILY' };
    const out = expandSeries(row, d('2026-11-03T06:00:00Z'), d('2026-11-03T07:00:00Z'), CHICAGO);
    expect(starts(out)).toEqual(['2026-11-03T04:00:00.000Z']);
  });

  it('accepts the RRULE: prefix and falls back to the row for an unreadable rule', () => {
    const row = { startTime: d('2026-11-02T15:00:00Z'), endTime: d('2026-11-02T16:00:00Z'), allDay: false };
    const range = [d('2026-11-01T00:00:00Z'), d('2026-11-06T00:00:00Z')] as const;
    expect(expandSeries({ ...row, recurrenceRule: 'RRULE:FREQ=DAILY' }, ...range, CHICAGO)).toHaveLength(4);
    expect(starts(expandSeries({ ...row, recurrenceRule: 'not a rule' }, ...range, CHICAGO)))
      .toEqual(['2026-11-02T15:00:00.000Z']);
  });
});

describe('isPrismSeries', () => {
  it('is a row with a rule and no external id', () => {
    expect(isPrismSeries({ recurrenceRule: 'FREQ=WEEKLY', externalEventId: null })).toBe(true);
    expect(isPrismSeries({ recurrenceRule: 'FREQ=WEEKLY', externalEventId: 'abc' })).toBe(false);
    expect(isPrismSeries({ recurrenceRule: null, externalEventId: null })).toBe(false);
  });
});

describe('occurrence ids', () => {
  const rowId = '3f2a9c1e-0b7d-4e5f-9a12-6c8d4b2e1f00';

  it('round-trips the row and the occurrence start', () => {
    const start = d('2026-11-06T15:00:00Z');
    expect(parseEventId(occurrenceId(rowId, start))).toEqual({ rowId, occurrenceStart: start });
  });

  it('leaves a plain row id alone', () => {
    expect(parseEventId(rowId)).toEqual({ rowId, occurrenceStart: null });
  });
});
