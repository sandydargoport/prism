/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
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

  it('joins a run by reaching back from each later slice', () => {
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
    // The run is joined by each later slice reaching BACK over the seam, not by
    // the earlier one reaching forward: a later cell paints on top of an
    // earlier one, so only the later slice's overflow is actually visible.
    expect(buttons[0]!.style.marginLeft).toBe('');
    // One generous reach, not a per-view sum: the seam differs between views
    // (8px in the month grid, 12.5px in the two-week view) and overshooting is
    // invisible, because a slice only reaches back over its own event's slice.
    expect(buttons[1]!.style.marginLeft).toBe('calc(-1.5rem)');
    expect(buttons[2]!.style.marginLeft).toBe('calc(-1.5rem)');
    // 1px grid gap plus a cell's padding on each side, kept in rem so it stays
    // correct at this app's 14px root rather than assuming 16px.
    expect(buttons[0]!.style.width).toBe('100%');
    expect(buttons[1]!.style.width).toBe('calc(100% + 1.5rem)');
    expect(buttons[2]!.style.width).toBe('calc(100% + 1.5rem)');
  });

  it('sizes a bar from the same variables a day event uses', () => {
    const rowDates = [new Date(2026, 7, 10), new Date(2026, 7, 11)];

    const { container } = render(
      <SpanningEventRows
        date={new Date(2026, 7, 10)}
        rowDates={rowDates}
        events={[event]}
        onEventClick={() => {}}
      />,
    );

    const bar = container.querySelector('button')!;
    // No fixed height, and padding/type read from the event custom properties,
    // so a bar and an all-day chip are the same object at any theme density.
    expect(bar.className).not.toMatch(/\bh-5\b/);
    expect(bar.className).toContain('px-(--event-padding-x,0.25rem)');
    expect(bar.className).toContain('text-(length:--event-font-size,0.75rem)');
  });

  it('holds an empty lane open with an invisible bar, not a fixed height', () => {
    const rowDates = [new Date(2026, 8, 20), new Date(2026, 8, 21), new Date(2026, 8, 22)];
    const a: CalendarEvent = {
      ...event, id: 'a',
      startTime: new Date('2026-09-20T00:00:00.000Z'),
      endTime: new Date('2026-09-22T00:00:00.000Z'),
    };
    const b: CalendarEvent = {
      ...event, id: 'b',
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

    const blank = container.querySelector('[data-spanning-events]')!.children[0]!;
    expect(blank.getAttribute('aria-hidden')).toBe('true');
    expect(blank.className).toContain('invisible');
    expect(blank.className).not.toMatch(/\bh-5\b/);
  });

  it('keeps a continuation slice full height even though it carries no title', () => {
    // The regression this guards: a continuation slice prints no label, so once
    // the height came from content rather than a fixed h-5 it collapsed to the
    // padding alone — a few pixels tall, effectively invisible, on every day of
    // a multi-day event after the first.
    const rowDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 27 + i));
    const trip: CalendarEvent = {
      ...event,
      id: 'trip',
      title: 'Trip away',
      startTime: new Date('2026-09-28T00:00:00.000Z'),
      endTime: new Date('2026-10-01T00:00:00.000Z'),
    };

    const onDay = (index: number) => {
      const { container } = render(
        <SpanningEventRows
          date={rowDates[index]!}
          rowDates={rowDates}
          events={[trip]}
          onEventClick={() => {}}
        />,
      );
      return container.querySelector('button')!;
    };

    // Day it starts: the title.
    expect(onDay(1).textContent).toBe('Trip away');
    // Days it continues: no title, but never empty.
    for (const index of [2, 3]) {
      const bar = onDay(index);
      expect(bar.textContent).not.toBe('');
      expect(bar.textContent!.trim()).toBe('');
    }
  });

  it('wears the card surface in cards mode, with the colour on a stripe', () => {
    const rowDates = [new Date(2026, 7, 10), new Date(2026, 7, 11)];

    const { container } = render(
      <SpanningEventRows
        date={new Date(2026, 7, 10)}
        rowDates={rowDates}
        events={[event]}
        onEventClick={() => {}}
        cards
      />,
    );

    const bar = container.querySelector('button')!;
    // Opaque, not the 85% the single-day cards use: a spanning pill crosses a
    // cell boundary, so anything under the seam would show through it.
    expect(bar.className).toContain('bg-card');
    expect(bar.className).not.toContain('bg-card/85');
    expect(bar.className).toContain('shadow-xs');
    // The event colour moves to a stripe element built the same way the card's
    // is, rather than a fat left border, so the two line up by construction.
    expect(bar.style.backgroundColor).toBe('');
    const stripe = bar.querySelector('span[aria-hidden]') as HTMLElement | null;
    expect(stripe).not.toBeNull();
    expect(stripe!.style.width).toBe('3px');
  });

  it('gives every band slice the same one-line box, whatever the event', () => {
    // Lanes only line up across days if every slice in the band is the same
    // height. A second line on some slices and not others made lane 1 start at
    // 155 in one column and 166 in the next, so a pill in a lower lane stepped
    // between days. Title only, so every slice is one line.
    const rowDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 27 + i));
    const oneDay: CalendarEvent = {
      ...event, id: 'one', title: 'Picture Day',
      startTime: new Date('2026-09-29T00:00:00.000Z'),
      endTime: new Date('2026-09-30T00:00:00.000Z'),
    };
    const run: CalendarEvent = {
      ...event, id: 'run', title: 'Away',
      startTime: new Date('2026-09-28T00:00:00.000Z'),
      endTime: new Date('2026-10-01T00:00:00.000Z'),
    };
    const render1 = (ev: CalendarEvent, index: number) => {
      cleanup();
      const { container } = render(
        <SpanningEventRows date={rowDates[index]!} rowDates={rowDates} events={[ev]} onEventClick={() => {}} cards />,
      );
      return container.querySelector('button')!;
    };

    expect(render1(oneDay, 2).textContent).toBe('Picture Day');
    expect(render1(run, 1).textContent).toBe('Away');
    // A continuation still holds its line box, so the run keeps one height.
    expect(render1(run, 2).textContent!.trim()).toBe('');
  });

  it('joins cards into one pill, labelled once, with no seam mid-run', () => {
    // Cards join the same way bars do: the run is one outlined pill carrying a
    // single label, with no border drawn on the edges a neighbouring slice
    // covers. The earlier failure mode this still guards is a slice that is
    // unlabelled AND unjoined, which renders as an empty white box.
    const rowDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 27 + i));
    const trip: CalendarEvent = {
      ...event,
      id: 'trip',
      title: 'Trip away',
      startTime: new Date('2026-09-28T00:00:00.000Z'),
      endTime: new Date('2026-10-01T00:00:00.000Z'),
    };
    const onDay = (index: number) => {
      const { container } = render(
        <SpanningEventRows
          date={rowDates[index]!} rowDates={rowDates} events={[trip]}
          onEventClick={() => {}} cards
        />,
      );
      return container.querySelector('button')!;
    };

    // Labelled where it starts, one line, like every other slice in the band.
    expect(onDay(1).textContent).toBe('Trip away');
    expect(onDay(1).style.marginLeft).toBe('');
    // Continuation days join back over the seam and drop the left border, so
    // the run is one object rather than a line of separate cards.
    for (const index of [2, 3]) {
      expect(onDay(index).style.marginLeft).toBe('calc(-1.5rem)');
      expect(onDay(index).className).toContain('border-l-0');
    }
    // Outlined in the event's own colour rather than the generic border.
    expect(onDay(2).style.borderColor).not.toBe('');
  });

  it('keeps filling with the event colour when cards mode is off', () => {
    const rowDates = [new Date(2026, 7, 10), new Date(2026, 7, 11)];

    const { container } = render(
      <SpanningEventRows
        date={new Date(2026, 7, 10)}
        rowDates={rowDates}
        events={[event]}
        onEventClick={() => {}}
      />,
    );

    const bar = container.querySelector('button')!;
    expect(bar.style.backgroundColor).not.toBe('');
    expect(bar.className).not.toContain('bg-card/85');
  });

  it('caps a week-wrapping event at the row edges and joins it mid-row', () => {
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
    // A week-wrapping event ends in a cap like everything else. Chevrons are
    // gone: one end treatment across the whole grid, and the radius follows
    // --radius so a square theme squares these off too.
    expect(buttons[0]!.className).toContain('rounded-l-md');
    expect(buttons[6]!.className).toContain('rounded-r-md');
    expect(buttons[0]!.style.clipPath).toBe('');
    expect(buttons[6]!.style.clipPath).toBe('');
    // Mid-row edges stay open, so adjacent slices still read as one bar.
    expect(buttons[3]!.className).not.toContain('rounded-l-md');
    expect(buttons[3]!.className).not.toContain('rounded-r-md');
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
    // No title repeated, but not empty either: a slice with no content at all
    // has no line box and collapses to its padding.
    expect(buttons[1]!.textContent!.trim()).toBe('');
    expect(buttons[1]!.textContent).not.toBe('');
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
