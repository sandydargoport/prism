/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { render } from '@testing-library/react';
import { SpanningEventRows } from '../SpanningEventRows';
import type { CalendarEvent } from '@/types/calendar';

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({
    timeFormat: '24h',
    displayTimezone: 'Europe/Warsaw',
  }),
}));

const event: CalendarEvent = {
  id: 'multi-day',
  title: 'Family trip',
  startTime: new Date('2026-08-10T00:00:00.000Z'),
  endTime: new Date('2026-08-13T00:00:00.000Z'),
  allDay: true,
  color: '#5b7fea',
  calendarName: 'Family',
  calendarId: 'family',
};

describe('SpanningEventRows', () => {
  it('bridges day gaps without overlapping adjacent event slices', () => {
    const rowDates = [
      new Date(2026, 7, 10),
      new Date(2026, 7, 11),
      new Date(2026, 7, 12),
    ];

    const { container } = render(
      <div>
        {rowDates.map((date) => (
          <SpanningEventRows
            key={date.toISOString()}
            date={date}
            rowDates={rowDates}
            events={[event]}
            onEventClick={() => {}}
          />
        ))}
      </div>,
    );

    const rows = container.querySelectorAll('[data-spanning-events]');
    const buttons = container.querySelectorAll('button');

    expect(rows).toHaveLength(3);
    expect(buttons).toHaveLength(3);
    expect(buttons[0]!.style.marginLeft).toBe('');
    expect(buttons[1]!.style.marginLeft).toBe('');
    expect(buttons[2]!.style.marginLeft).toBe('');
    expect(buttons[0]!.style.width).toBe('calc(100% + 0.25rem)');
    expect(buttons[1]!.style.width).toBe('calc(100% + 0.25rem)');
    expect(buttons[2]!.style.width).toBe('100%');
  });
});
