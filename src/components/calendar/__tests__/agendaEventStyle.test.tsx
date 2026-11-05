/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'America/Chicago' }),
}));

import { AgendaView } from '../AgendaView';
import type { CalendarEvent } from '@/types/calendar';

// #801: the agenda draws an event as a pale tint of the person's colour with a
// bar on the leading edge, in the normal text colour, never white on a block.

// A fixed afternoon in Chicago, where the agenda is drawn. On the real clock,
// "an hour from now" fell on Chicago's tomorrow between 11pm and midnight
// there, and the one-day agenda was empty.
beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-03T21:00:00Z') }); // 3:00 PM CST
});
afterEach(() => {
  jest.useRealTimers();
});

function soonEvent(): CalendarEvent {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  return {
    id: 'e1', title: 'Soccer practice', startTime: start, endTime: new Date(start.getTime() + 3600_000),
    allDay: false, color: '#10b981', calendarName: 'Family', calendarId: 'c1',
  } as CalendarEvent;
}

it('draws an agenda event as a tint with a bar, in the normal text colour', () => {
  const event = soonEvent();

  render(<AgendaView events={[event]} days={1} onEventClick={() => {}} />);
  const row = screen.getByText('Soccer practice').closest('button')!;

  expect(row.style.color).toBe('hsl(var(--card-foreground))');
  expect(row.getAttribute('style')).toContain('var(--ds-event-tint)');
  expect(row.style.borderLeft).toContain('var(--ds-event-bar)');
  expect(row.innerHTML).not.toContain('text-white');
});

// A seasonal accent is a marker colour; several months' are too light to be
// text on a light card. Today's heading uses the normal text colour.
it("draws today's heading in the normal text colour, not the seasonal accent", () => {
  const { container } = render(<AgendaView events={[soonEvent()]} days={1} onEventClick={() => {}} />);
  const heading = container.querySelector('[data-agenda-day-word]')!;
  expect(heading.className).toContain('text-foreground');
  expect(heading.className).not.toContain('text-seasonal-accent');
});

// #806: an event happening right now carries a "Now" tag; one later today does not.
it('tags the event in progress as Now, and only that one', () => {
  const start = new Date();
  start.setMinutes(start.getMinutes() - 30, 0, 0);
  const current = {
    id: 'e2', title: 'Piano lesson', startTime: start, endTime: new Date(start.getTime() + 3600_000),
    allDay: false, color: '#3b82f6', calendarName: 'Family', calendarId: 'c1',
  } as CalendarEvent;
  render(<AgendaView events={[current, soonEvent()]} days={1} onEventClick={() => {}} />);
  const tags = document.querySelectorAll('[data-agenda-now]');
  expect(tags).toHaveLength(1);
  expect(screen.getByText('Piano lesson').closest('button')!.contains(tags[0]!)).toBe(true);
  expect(tags[0]!.textContent).toBe('Now');
  expect(tags[0]!.className).toContain('bg-primary');
});
