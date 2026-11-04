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

// The agenda reads the household's past-events setting on mount; answer with
// no settings, so it keeps its default.
beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ settings: {} }) })) as unknown as typeof fetch;
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
  const heading = container.querySelector('span.text-sm.font-semibold')!;
  expect(heading.className).toContain('text-foreground');
  expect(heading.className).not.toContain('text-seasonal-accent');
});
