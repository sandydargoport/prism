import { mergeSharedEvents, eventDotBackground } from '../sharedEvents';
import type { CalendarEvent } from '@/types/calendar';

const ev = (id: string, calendarId: string, color: string, title = 'Parent night', start = '2026-11-12T18:00:00Z'): CalendarEvent => ({
  id, title, startTime: new Date(start), endTime: new Date(new Date(start).getTime() + 3600_000),
  allDay: false, color, calendarName: `Cal ${calendarId}`, calendarId,
});

describe('mergeSharedEvents (#1066)', () => {
  it('one event on two calendars becomes one, keeping the other copy', () => {
    const out = mergeSharedEvents([ev('a', 'c1', '#f00'), ev('b', 'c2', '#00f')]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a', alsoIds: ['b'], alsoCalendarIds: ['c2'], alsoCalendarNames: ['Cal c2'], alsoColors: ['#00f'] });
  });

  it('matches titles regardless of case and spaces at the ends', () => {
    expect(mergeSharedEvents([ev('a', 'c1', '#f00', 'Parent night'), ev('b', 'c2', '#00f', ' parent NIGHT ')])).toHaveLength(1);
  });

  it('leaves copies on one calendar, different times and different titles alone', () => {
    expect(mergeSharedEvents([ev('a', 'c1', '#f00'), ev('b', 'c1', '#f00')])).toHaveLength(2);
    expect(mergeSharedEvents([ev('a', 'c1', '#f00'), ev('b', 'c2', '#00f', 'Parent night', '2026-11-12T19:00:00Z')])).toHaveLength(2);
    expect(mergeSharedEvents([ev('a', 'c1', '#f00'), ev('b', 'c2', '#00f', 'Soccer')])).toHaveLength(2);
  });

  it('three calendars, one event; the same colour is not repeated', () => {
    const out = mergeSharedEvents([ev('a', 'c1', '#f00'), ev('b', 'c2', '#00f'), ev('c', 'c3', '#00f')]);
    expect(out).toHaveLength(1);
    expect(out[0]!.alsoIds).toEqual(['b', 'c']);
    expect(out[0]!.alsoColors).toEqual(['#00f']);
  });

  it('keeps the order of everything else', () => {
    const out = mergeSharedEvents([ev('x', 'c1', '#0f0', 'Soccer'), ev('a', 'c1', '#f00'), ev('b', 'c2', '#00f'), ev('y', 'c2', '#0f0', 'Piano')]);
    expect(out.map((e) => e.id)).toEqual(['x', 'a', 'y']);
  });

  it('a mark is one colour, or the colours in equal parts', () => {
    expect(eventDotBackground({ color: '#f00' })).toBe('#f00');
    expect(eventDotBackground({ color: '#f00', alsoColors: ['#00f'] })).toBe('linear-gradient(90deg, #f00 0% 50%, #00f 50% 100%)');
    expect(eventDotBackground({ color: '#f00', alsoColors: ['#00f'] }, '180deg')).toMatch(/^linear-gradient\(180deg/);
  });
});
