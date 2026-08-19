import {
  formatDisplayHour,
  formatDisplayTime,
  formatDisplayTimeRange,
  fromDisplayDateTime,
  getDisplayDateKey,
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
});
