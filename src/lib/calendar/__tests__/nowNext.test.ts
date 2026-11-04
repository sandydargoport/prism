/**
 * Now & Next (#806): what is on now and next today, in the household's zone.
 */
import { nowNext, isInProgress, NEXT_WARN_MINUTES } from '../nowNext';
import type { CalendarEvent } from '@/types/calendar';

const ZONE = 'America/Chicago';
// 4:10 PM in Chicago on a summer day (UTC-5).
const NOW = new Date('2026-06-17T21:10:00Z');

let n = 0;
function ev(title: string, start: string, end: string, allDay = false): CalendarEvent {
  n += 1;
  return { id: `e${n}`, title, startTime: new Date(start), endTime: new Date(end), allDay, color: '#3B82F6' } as CalendarEvent;
}

describe('nowNext', () => {
  it('finds the event in progress and the next one today, with a countdown', () => {
    const soccer = ev('Soccer Practice', '2026-06-17T21:00:00Z', '2026-06-17T22:30:00Z');
    const scouts = ev('Scouts Meeting', '2026-06-17T23:00:00Z', '2026-06-18T00:00:00Z');
    const r = nowNext([scouts, soccer], NOW, ZONE);
    expect(r.now.map((e) => e.title)).toEqual(['Soccer Practice']);
    expect(r.next?.title).toBe('Scouts Meeting');
    expect(r.minutesToNext).toBe(110);
    expect(r.warn).toBe(false);
    expect(r.emptyDay).toBe(false);
  });

  it(`warns in the last ${NEXT_WARN_MINUTES} minutes before a start, not before`, () => {
    const at = (min: number) => ev('Piano', new Date(NOW.getTime() + min * 60_000).toISOString(), '2026-06-18T00:00:00Z');
    expect(nowNext([at(NEXT_WARN_MINUTES)], NOW, ZONE).warn).toBe(true);
    expect(nowNext([at(NEXT_WARN_MINUTES + 1)], NOW, ZONE).warn).toBe(false);
  });

  it('rounds a part minute up, so it never says "in 0 min"', () => {
    const r = nowNext([ev('Bus', new Date(NOW.getTime() + 20_000).toISOString(), '2026-06-17T22:00:00Z')], NOW, ZONE);
    expect(r.minutesToNext).toBe(1);
  });

  it('never shows an all-day event as now or next, but counts it as the day having events', () => {
    const r = nowNext([ev('Grandma visiting', '2026-06-17T05:00:00Z', '2026-06-18T05:00:00Z', true)], NOW, ZONE);
    expect(r.now).toEqual([]);
    expect(r.next).toBeNull();
    expect(r.emptyDay).toBe(false);
  });

  it('says the day is empty only when today has nothing at all', () => {
    expect(nowNext([], NOW, ZONE).emptyDay).toBe(true);
    // Tomorrow morning is not today's next.
    const tomorrow = ev('Dentist', '2026-06-18T14:00:00Z', '2026-06-18T15:00:00Z');
    const r = nowNext([tomorrow], NOW, ZONE);
    expect(r.next).toBeNull();
    expect(r.emptyDay).toBe(true);
  });

  it('reads "today" in the household zone, not UTC', () => {
    // 11:30 PM Chicago is already the next day in UTC; a 11:45 PM event is
    // still today's next.
    const late = new Date('2026-06-18T04:30:00Z');
    const r = nowNext([ev('Stargazing', '2026-06-18T04:45:00Z', '2026-06-18T05:30:00Z')], late, ZONE);
    expect(r.next?.title).toBe('Stargazing');
  });

  it('an event that has ended is neither now nor next', () => {
    const done = ev('Lunch', '2026-06-17T17:00:00Z', '2026-06-17T18:00:00Z');
    expect(isInProgress(done, NOW)).toBe(false);
    const r = nowNext([done], NOW, ZONE);
    expect(r.now).toEqual([]);
    expect(r.next).toBeNull();
    expect(r.emptyDay).toBe(false);
  });
});
