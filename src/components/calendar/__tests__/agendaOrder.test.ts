/**
 * The agenda orders events by the display day they start on. An all-day
 * event's start is UTC midnight of its date, which must count as that date in
 * every zone, not as the previous evening west of UTC.
 */
jest.mock('@/components/providers', () => ({ useTimeFormat: jest.fn() }));

import { compareAgendaEvents } from '../AgendaView';
import type { CalendarEvent } from '@/types/calendar';

function ev(id: string, start: string, end: string, allDay: boolean): CalendarEvent {
  return {
    id, title: id, startTime: new Date(start), endTime: new Date(end), allDay,
    color: '#000', calendarName: 'c', calendarId: 'c',
  } as CalendarEvent;
}

describe('compareAgendaEvents', () => {
  // All day on 10 Sep, and a timed event from 20:00 on the 9th in Chicago.
  const allDay = ev('all-day', '2026-09-10T00:00:00Z', '2026-09-11T00:00:00Z', true);
  const overnight = ev('overnight', '2026-09-10T01:00:00Z', '2026-09-10T15:00:00Z', false);

  it.each(['America/Chicago', 'UTC', 'Asia/Tokyo'])('puts an event from the day before first in %s', (zone) => {
    const inChicagoTerms = zone === 'America/Chicago';
    const sorted = [allDay, overnight].sort((a, b) => compareAgendaEvents(a, b, zone));
    // In Chicago the overnight event starts on the 9th, before the all-day
    // one. Elsewhere it starts on the 10th, and all-day comes first that day.
    expect(sorted.map((e) => e.id)).toEqual(inChicagoTerms ? ['overnight', 'all-day'] : ['all-day', 'overnight']);
  });
});
