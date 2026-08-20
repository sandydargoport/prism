import {
  eventOccursOnDisplayDay,
  eventStartsOnDisplayDay,
  eventSpansMultipleDisplayDays,
  formatDisplayHour,
  formatDisplayTime,
  formatDisplayTimeRange,
  fromDisplayDateTime,
  getDisplayDateKey,
  isCalendarEventPast,
  toDisplayDate,
} from '../timeFormat';

describe('time format utilities', () => {
  const afternoon = new Date(2026, 0, 15, 14, 5, 9);

  it('formats ordinary times in 12-hour and 24-hour modes', () => {
    expect(formatDisplayTime(afternoon, '12h')).toBe('2:05 PM');
    expect(formatDisplayTime(afternoon, '24h')).toBe('14:05');
  });

  it('includes seconds when requested', () => {
    expect(formatDisplayTime(afternoon, '12h', { showSeconds: true })).toBe('2:05:09 PM');
    expect(formatDisplayTime(afternoon, '24h', { showSeconds: true })).toBe('14:05:09');
  });

  it('formats compact and full hour-axis labels', () => {
    const hour = new Date(2026, 0, 15, 14, 0);
    expect(formatDisplayHour(hour, '12h', { compact: true })).toBe('2PM');
    expect(formatDisplayHour(hour, '24h', { compact: true })).toBe('14');
    expect(formatDisplayHour(hour, '24h')).toBe('14:00');
  });

  it('formats event time ranges consistently', () => {
    const end = new Date(2026, 0, 15, 15, 30);
    expect(formatDisplayTimeRange(afternoon, end, '12h')).toBe('2:05–3:30 PM');
    expect(formatDisplayTimeRange(afternoon, end, '24h')).toBe('14:05–15:30');
  });

  it('formats the same appointment in the selected display timezone', () => {
    const appointment = new Date('2026-08-19T06:00:00.000Z');

    expect(formatDisplayTime(appointment, '24h', {}, 'Europe/Warsaw')).toBe('08:00');
    expect(formatDisplayTime(appointment, '24h', {}, 'Europe/London')).toBe('07:00');
  });

  it('uses the selected timezone for day bucketing around midnight', () => {
    const instant = new Date('2026-08-19T22:30:00.000Z');

    expect(getDisplayDateKey(instant, 'Europe/Warsaw')).toBe('2026-08-20');
    expect(getDisplayDateKey(instant, 'Europe/London')).toBe('2026-08-19');
    expect(toDisplayDate(instant, 'Europe/Warsaw').getHours()).toBe(0);
  });

  it('persists calendar form times in the selected display timezone', () => {
    expect(fromDisplayDateTime('2026-08-19', '08:00', 'Europe/Warsaw').toISOString())
      .toBe('2026-08-19T06:00:00.000Z');
    expect(fromDisplayDateTime('2026-08-19', '08:00', 'Europe/London').toISOString())
      .toBe('2026-08-19T07:00:00.000Z');
  });

  it('uses the correct selected-timezone offset across daylight saving time', () => {
    expect(fromDisplayDateTime('2026-01-19', '08:00', 'Europe/Warsaw').toISOString())
      .toBe('2026-01-19T07:00:00.000Z');
    expect(fromDisplayDateTime('2026-08-19', '08:00', 'Europe/Warsaw').toISOString())
      .toBe('2026-08-19T06:00:00.000Z');
  });

  it('keeps a Google all-day event on its date despite a positive timezone offset', () => {
    const start = new Date('2026-08-18T00:00:00.000Z');
    const exclusiveEnd = new Date('2026-08-19T00:00:00.000Z');

    expect(eventOccursOnDisplayDay(start, exclusiveEnd, true, new Date(2026, 7, 18), 'Europe/Warsaw'))
      .toBe(true);
    expect(eventOccursOnDisplayDay(start, exclusiveEnd, true, new Date(2026, 7, 19), 'Europe/Warsaw'))
      .toBe(false);
  });

  it('supports Prism all-day events with an inclusive end-of-day timestamp', () => {
    const start = new Date('2026-08-18T00:00:00.000Z');
    const inclusiveEnd = new Date('2026-08-18T23:59:59.999Z');

    expect(eventOccursOnDisplayDay(start, inclusiveEnd, true, new Date(2026, 7, 18), 'Europe/Warsaw'))
      .toBe(true);
    expect(eventOccursOnDisplayDay(start, inclusiveEnd, true, new Date(2026, 7, 19), 'Europe/Warsaw'))
      .toBe(false);
  });

  it('preserves exclusive ends for multi-day all-day events', () => {
    const start = new Date('2026-08-18T00:00:00.000Z');
    const exclusiveEnd = new Date('2026-08-20T00:00:00.000Z');

    expect(eventOccursOnDisplayDay(start, exclusiveEnd, true, new Date(2026, 7, 18))).toBe(true);
    expect(eventOccursOnDisplayDay(start, exclusiveEnd, true, new Date(2026, 7, 19))).toBe(true);
    expect(eventOccursOnDisplayDay(start, exclusiveEnd, true, new Date(2026, 7, 20))).toBe(false);
  });

  it('classifies timed events spanning displayed dates', () => {
    const start = new Date('2026-08-21T16:00:00.000Z');
    const end = new Date('2026-08-23T17:00:00.000Z');

    expect(eventSpansMultipleDisplayDays(start, end, false, 'Europe/Warsaw')).toBe(true);
  });

  it('shows a timed event start only on its first displayed day', () => {
    const start = new Date('2026-08-21T16:00:00.000Z');

    expect(eventStartsOnDisplayDay(start, false, new Date(2026, 7, 21), 'Europe/Warsaw'))
      .toBe(true);
    expect(eventStartsOnDisplayDay(start, false, new Date(2026, 7, 22), 'Europe/Warsaw'))
      .toBe(false);
  });

  it('uses floating UTC dates for all-day event starts', () => {
    const start = new Date('2026-08-21T00:00:00.000Z');

    expect(eventStartsOnDisplayDay(start, true, new Date(2026, 7, 21), 'America/Los_Angeles'))
      .toBe(true);
    expect(eventStartsOnDisplayDay(start, true, new Date(2026, 7, 20), 'America/Los_Angeles'))
      .toBe(false);
  });

  it('does not treat an exact-midnight end as occupying another day', () => {
    const start = new Date('2026-08-21T16:00:00.000Z');
    const midnightEnd = new Date('2026-08-21T22:00:00.000Z');

    expect(eventSpansMultipleDisplayDays(start, midnightEnd, false, 'Europe/Warsaw')).toBe(false);
  });

  it('distinguishes one-day and multi-day all-day ranges', () => {
    expect(eventSpansMultipleDisplayDays(
      new Date('2026-08-21T00:00:00.000Z'),
      new Date('2026-08-22T00:00:00.000Z'),
      true,
    )).toBe(false);
    expect(eventSpansMultipleDisplayDays(
      new Date('2026-08-21T00:00:00.000Z'),
      new Date('2026-08-24T00:00:00.000Z'),
      true,
    )).toBe(true);
  });

  it('treats an all-day event as past only after its exclusive end date', () => {
    const start = new Date('2026-08-18T00:00:00.000Z');
    const exclusiveEnd = new Date('2026-08-20T00:00:00.000Z');

    expect(isCalendarEventPast(
      start,
      exclusiveEnd,
      true,
      new Date('2026-08-19T12:00:00.000Z'),
      'Europe/Warsaw',
    )).toBe(false);
    expect(isCalendarEventPast(
      start,
      exclusiveEnd,
      true,
      new Date('2026-08-20T12:00:00.000Z'),
      'Europe/Warsaw',
    )).toBe(true);
  });

  it('keeps an ongoing timed event active until its actual end instant', () => {
    const start = new Date('2026-08-20T06:00:00.000Z');
    const end = new Date('2026-08-20T08:00:00.000Z');

    expect(isCalendarEventPast(start, end, false, new Date('2026-08-20T07:00:00.000Z')))
      .toBe(false);
    expect(isCalendarEventPast(start, end, false, new Date('2026-08-20T08:00:00.000Z')))
      .toBe(true);
  });
});
