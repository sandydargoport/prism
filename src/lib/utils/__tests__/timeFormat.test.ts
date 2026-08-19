import {
  formatDisplayHour,
  formatDisplayTime,
  formatDisplayTimeRange,
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
});
