import type { CalendarEvent } from '@/types/calendar';
import { auroraPalette, moonPhase, nightSkyEvents, tomorrowEvents } from '../nightSkyUtils';

const event = (id: string, start: string): CalendarEvent => ({
  id,
  title: id,
  startTime: new Date(start),
  endTime: new Date(new Date(start).getTime() + 3600000),
  allDay: false,
  color: '#3b82f6',
  calendarName: 'Family',
  calendarId: 'family',
});

describe('Night Sky schedule model', () => {
  const now = new Date('2026-08-29T12:00:00-05:00');

  it('keeps the next fourteen days and orders them', () => {
    const result = nightSkyEvents([
      event('later', '2026-09-03T10:00:00-05:00'),
      event('past', '2026-08-28T10:00:00-05:00'),
      event('next', '2026-08-29T13:00:00-05:00'),
      event('far', '2026-09-20T10:00:00-05:00'),
    ], now);
    expect(result.map(({ id }) => id)).toEqual(['next', 'later']);
  });

  it('finds tomorrow in local calendar time', () => {
    const result = tomorrowEvents([
      event('today', '2026-08-29T18:00:00-05:00'),
      event('second', '2026-08-30T12:00:00-05:00'),
      event('first', '2026-08-30T08:00:00-05:00'),
    ], now);
    expect(result.map(({ id }) => id)).toEqual(['first', 'second']);
  });

  it('maps light, medium, and busy days to distinct palettes', () => {
    expect(auroraPalette(3)[0]).toBe('#10b981');
    expect(auroraPalette(4)[0]).toBe('#0d9488');
    expect(auroraPalette(8)[0]).toBe('#7c3aed');
  });

  it('computes known new and full moon illumination', () => {
    expect(moonPhase(new Date('2000-01-06T18:14:00Z')).illumination).toBeCloseTo(0, 4);
    expect(moonPhase(new Date('2000-01-21T12:36:00Z')).illumination).toBeCloseTo(1, 2);
  });
});
