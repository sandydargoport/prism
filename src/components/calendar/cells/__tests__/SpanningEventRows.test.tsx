/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { render } from '@testing-library/react';
import { SpanningEventRows } from '../SpanningEventRows';
import { InlineCalendarEvent } from '../InlineCalendarEvent';
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
  it('reserves no lanes on a day that every span in the row misses', () => {
    // The bug this guards: a week carrying three multi-day events reserved a
    // blank lane for each of them on EVERY day of the row, so a day none of
    // them touched started three rows down and its own events appeared to
    // begin halfway down the cell.
    const rowDates = [new Date(2026, 8, 20), new Date(2026, 8, 21), new Date(2026, 8, 22), new Date(2026, 8, 23)];
    const spans: CalendarEvent[] = [23, 24, 25].map((day, i) => ({
      ...event,
      id: `span-${i}`,
      startTime: new Date(`2026-09-${day}T00:00:00.000Z`),
      endTime: new Date('2026-09-29T00:00:00.000Z'),
    }));

    const { container } = render(
      <SpanningEventRows
        date={new Date(2026, 8, 21)}
        rowDates={rowDates}
        events={spans}
        onEventClick={() => {}}
      />,
    );

    expect(container.querySelector('[data-spanning-events]')).toBeNull();
  });

  it('keeps a lane open when a bar really is drawn below it', () => {
    // A holds lane 0 on the 20th and 21st; B overlaps it so it takes lane 1 and
    // keeps it. On the 22nd A is over, but lane 0 stays blank so B does not
    // jump up a row midway through its own span.
    const rowDates = [new Date(2026, 8, 20), new Date(2026, 8, 21), new Date(2026, 8, 22)];
    const a: CalendarEvent = {
      ...event,
      id: 'a',
      startTime: new Date('2026-09-20T00:00:00.000Z'),
      endTime: new Date('2026-09-22T00:00:00.000Z'),
    };
    const b: CalendarEvent = {
      ...event,
      id: 'b',
      startTime: new Date('2026-09-20T00:00:00.000Z'),
      endTime: new Date('2026-09-23T00:00:00.000Z'),
    };

    const { container } = render(
      <SpanningEventRows
        date={new Date(2026, 8, 22)}
        rowDates={rowDates}
        events={[a, b]}
        onEventClick={() => {}}
      />,
    );

    const wrapper = container.querySelector('[data-spanning-events]');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.children).toHaveLength(2);
    expect(wrapper!.children[0]!.getAttribute('aria-hidden')).toBe('true');
  });

  it('reuses a lane an earlier span has finished with', () => {
    // The bug: lane came from position in the row's list, so a span beginning
    // after two others had ended still sat in lane 2 and stacked two blank rows
    // above itself on every day it covered.
    const rowDates = [new Date(2026, 8, 20), new Date(2026, 8, 21), new Date(2026, 8, 22)];
    const done: CalendarEvent[] = ['x', 'y'].map((id) => ({
      ...event,
      id,
      startTime: new Date('2026-09-20T00:00:00.000Z'),
      endTime: new Date('2026-09-21T00:00:00.000Z'),
    }));
    const later: CalendarEvent = {
      ...event,
      id: 'z',
      startTime: new Date('2026-09-22T00:00:00.000Z'),
      endTime: new Date('2026-09-24T00:00:00.000Z'),
    };

    const { container } = render(
      <SpanningEventRows
        date={new Date(2026, 8, 22)}
        rowDates={rowDates}
        events={[...done, later]}
        onEventClick={() => {}}
      />,
    );

    const wrapper = container.querySelector('[data-spanning-events]');
    expect(wrapper!.children).toHaveLength(1);
    expect(wrapper!.children[0]!.getAttribute('aria-hidden')).toBeNull();
  });

  it('bridges day gaps without overlapping adjacent event slices', () => {
    const rowDates = [new Date(2026, 7, 10), new Date(2026, 7, 11), new Date(2026, 7, 12)];

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
      </div>
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

  it('shows continuation edges and repeats the label after a week wrap', () => {
    const wrappingEvent: CalendarEvent = {
      ...event,
      startTime: new Date('2026-08-09T00:00:00.000Z'),
      endTime: new Date('2026-08-18T00:00:00.000Z'),
    };
    const rowDates = Array.from({ length: 7 }, (_, index) => new Date(2026, 7, 10 + index));

    const { container } = render(
      <div>
        {rowDates.map((date) => (
          <SpanningEventRows
            key={date.toISOString()}
            date={date}
            rowDates={rowDates}
            events={[wrappingEvent]}
            onEventClick={() => {}}
          />
        ))}
      </div>
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(7);
    expect(buttons[0]!.textContent).toBe('Family trip');
    expect(buttons[0]!.className).not.toContain('rounded-l-md');
    expect(buttons[0]!.style.clipPath).toContain('0 50%');
    expect(buttons[6]!.className).not.toContain('rounded-r-md');
    expect(buttons[6]!.style.clipPath).toContain('100% 50%');
  });

  it('uses white text for a future spanning event', () => {
    const futureEvent: CalendarEvent = {
      ...event,
      startTime: new Date('2099-08-10T00:00:00.000Z'),
      endTime: new Date('2099-08-13T00:00:00.000Z'),
    };

    const { getByRole } = render(
      <SpanningEventRows
        date={new Date(2099, 7, 10)}
        rowDates={[new Date(2099, 7, 10)]}
        events={[futureEvent]}
        onEventClick={() => {}}
      />
    );

    expect(getByRole('button').style.color).toBe('rgb(255, 255, 255)');
  });

  it('does not repeat a timed event start time on continuation days', () => {
    const timedEvent: CalendarEvent = {
      ...event,
      title: 'Weekend trip',
      allDay: false,
      startTime: new Date('2026-08-21T16:00:00.000Z'),
      endTime: new Date('2026-08-23T17:00:00.000Z'),
    };

    const startDay = new Date(2026, 7, 21);
    const continuationDay = new Date(2026, 7, 22);
    const rowDates = [startDay, continuationDay];
    const { container } = render(
      <div>
        <SpanningEventRows
          date={startDay}
          rowDates={rowDates}
          events={[timedEvent]}
          onEventClick={() => {}}
        />
        <SpanningEventRows
          date={continuationDay}
          rowDates={rowDates}
          events={[timedEvent]}
          onEventClick={() => {}}
        />
      </div>
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons[0]!.textContent).toBe('18:00 Weekend trip');
    expect(buttons[1]!.textContent).toBe('');
    expect(buttons[1]!.title).toBe('Weekend trip');
  });
});

describe('InlineCalendarEvent', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-20T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses a neutral timed-event label and event-colour dot', () => {
    const timedEvent: CalendarEvent = {
      ...event,
      allDay: false,
      startTime: new Date('2026-08-20T14:00:00.000Z'),
      endTime: new Date('2026-08-20T15:00:00.000Z'),
    };

    const { getByRole } = render(<InlineCalendarEvent event={timedEvent} onClick={() => {}} />);
    const button = getByRole('button');
    const dot = button.querySelector('[aria-hidden]') as HTMLElement;

    expect(button.className).toContain('text-left');
    expect(button.style.backgroundColor).toBe('');
    expect(dot.style.backgroundColor).toBe('rgb(91, 127, 234)');
  });

  it('subdues a completed event without striking it through', () => {
    const { getByRole } = render(<InlineCalendarEvent event={event} onClick={() => {}} />);
    const button = getByRole('button');

    expect(button.className).toContain('opacity-55');
    expect(button.className).not.toContain('line-through');
  });

  it('uses white text for a current or future filled event', () => {
    const futureEvent: CalendarEvent = {
      ...event,
      startTime: new Date('2026-08-21T00:00:00.000Z'),
      endTime: new Date('2026-08-22T00:00:00.000Z'),
    };

    const { getByRole } = render(<InlineCalendarEvent event={futureEvent} onClick={() => {}} />);

    expect(getByRole('button').style.color).toBe('rgb(255, 255, 255)');
  });
});
