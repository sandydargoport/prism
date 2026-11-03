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

it('draws an agenda event as a tint with a bar, in the normal text colour', () => {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const event = {
    id: 'e1', title: 'Soccer practice', startTime: start, endTime: new Date(start.getTime() + 3600_000),
    allDay: false, color: '#10b981', calendarName: 'Family', calendarId: 'c1',
  } as CalendarEvent;

  render(<AgendaView events={[event]} days={1} onEventClick={() => {}} />);
  const row = screen.getByText('Soccer practice').closest('button')!;

  expect(row.style.color).toBe('hsl(var(--card-foreground))');
  expect(row.getAttribute('style')).toContain('var(--ds-event-tint)');
  expect(row.style.borderLeft).toContain('var(--ds-event-bar)');
  expect(row.innerHTML).not.toContain('text-white');
});
