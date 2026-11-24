/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { AgendaView } from '../AgendaView';
import { resetPastEventsSync } from '@/lib/hooks/usePastEventsMode';
import type { CalendarEvent } from '@/types/calendar';

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'America/Chicago' }),
}));

// Where the list would open (#1369): the scroll itself needs a real layout
// and is measured in e2e/calendar-geometry.spec.ts; this records the anchor.
const mockAnchors: Array<string | null> = [];
jest.mock('@/lib/hooks/useStartAtNext', () => ({
  useStartAtNext: (anchor: string | null) => {
    mockAnchors.push(anchor);
    return () => {};
  },
}));
const lastAnchor = () => mockAnchors[mockAnchors.length - 1];

const CACHE_KEY = 'prism:calendar-past-events';

function event(id: string, title: string, start: string, end: string): CalendarEvent {
  return {
    id,
    title,
    startTime: new Date(start),
    endTime: new Date(end),
    allDay: false,
    color: '#5b7fea',
    calendarName: 'Family',
    calendarId: 'family',
  };
}

// Tuesday 3 Nov 2026 in Springfield (America/Chicago, UTC-6).
const events = [
  event('dentist', 'Emma dentist', '2026-11-03T15:00:00Z', '2026-11-03T16:00:00Z'), //  9–10 AM
  event('practice', 'Soccer practice', '2026-11-03T20:30:00Z', '2026-11-03T22:00:00Z'), // 2:30–4 PM
  event('dinner', 'Parker family dinner', '2026-11-04T00:00:00Z', '2026-11-04T01:00:00Z'), // 6–7 PM
];

let settingsFromServer: Record<string, unknown> = {};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-03T21:00:00.000Z') }); // 3:00 PM
  window.localStorage.clear();
  resetPastEventsSync();
  settingsFromServer = {};
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ settings: settingsFromServer }),
  })) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

async function renderAgenda() {
  render(<AgendaView events={events} days={7} onEventClick={() => {}} />);
  // Let the one settings fetch resolve.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('AgendaView past events', () => {
  it('dims ended events by default, as every other view does, and hides none', async () => {
    await renderAgenda();

    const dentist = screen.getByText('Emma dentist').closest('button');
    expect(dentist?.hasAttribute('data-ended')).toBe(true);
    expect(dentist?.className).toContain('opacity-60');
    for (const title of ['Soccer practice', 'Parker family dinner']) {
      const row = screen.getByText(title).closest('button');
      expect(row?.hasAttribute('data-ended')).toBe(false);
      expect(row?.className).not.toContain('opacity-60');
    }
  });

  it('treats a stored "show" from before the switch as the default, dimmed', async () => {
    settingsFromServer = { calendarPastEvents: 'show' };
    await renderAgenda();
    expect(screen.getByText('Emma dentist').closest('button')?.hasAttribute('data-ended')).toBe(true);
  });

  it('dims ended events, and only ended ones, when the household chose Dimmed', async () => {
    settingsFromServer = { calendarPastEvents: 'dim' };
    await renderAgenda();

    const dentist = screen.getByText('Emma dentist').closest('button');
    const practice = screen.getByText('Soccer practice').closest('button');
    const dinner = screen.getByText('Parker family dinner').closest('button');

    expect(dentist?.hasAttribute('data-ended')).toBe(true);
    expect(dentist?.className).toContain('opacity-60');
    expect(practice?.hasAttribute('data-ended')).toBe(false);
    expect(dinner?.hasAttribute('data-ended')).toBe(false);
  });

  it('dims rather than strikes through: an ended event was not "done"', async () => {
    settingsFromServer = { calendarPastEvents: 'dim' };
    await renderAgenda();
    const title = screen.getByText('Emma dentist').parentElement;
    expect(title?.className).not.toContain('line-through');
  });

  it('hides ended events when the household chose Hidden', async () => {
    settingsFromServer = { calendarPastEvents: 'hide' };
    await renderAgenda();

    expect(screen.queryByText('Emma dentist')).toBeNull();
    // Still in progress, so it stays.
    expect(screen.getByText('Soccer practice')).toBeTruthy();
    expect(screen.getByText('Parker family dinner')).toBeTruthy();
  });

  it('paints the cached choice on the first render, before the fetch lands', () => {
    window.localStorage.setItem(CACHE_KEY, 'hide');
    render(<AgendaView events={events} days={7} onEventClick={() => {}} />);
    expect(screen.queryByText('Emma dentist')).toBeNull();
  });

  it('drops an event when it ends, without new data', async () => {
    window.localStorage.setItem(CACHE_KEY, 'hide');
    await renderAgenda();
    expect(screen.getByText('Soccer practice')).toBeTruthy();

    // Practice ends at 4:00 PM; move past it and let the minute tick fire.
    await act(async () => {
      jest.setSystemTime(new Date('2026-11-03T22:01:00.000Z'));
      jest.advanceTimersByTime(61_000);
    });

    expect(screen.queryByText('Soccer practice')).toBeNull();
    expect(screen.getByText('Parker family dinner')).toBeTruthy();
  });

  it('ignores a value it does not recognise', async () => {
    settingsFromServer = { calendarPastEvents: 'nonsense' };
    await renderAgenda();
    expect(screen.getByText('Emma dentist')).toBeTruthy();
  });
});

describe('AgendaView starts at the next event (#1369)', () => {
  async function renderStart(list: CalendarEvent[] = events) {
    mockAnchors.length = 0;
    render(<AgendaView events={list} days={7} onEventClick={() => {}} startAtNext />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('opens at the event in progress, below the ones that are over', async () => {
    await renderStart();
    // 3:00 PM: the dentist (9-10 AM) is over, practice (2:30-4 PM) is on.
    expect(lastAnchor()).toBe('2026-11-03:event-practice');
    const anchored = document.querySelector('[data-scroll-anchor="2026-11-03:event-practice"]');
    expect(anchored?.textContent).toContain('Soccer practice');
  });

  it('moves on when an event ends, without new data', async () => {
    await renderStart();
    await act(async () => {
      jest.setSystemTime(new Date('2026-11-03T22:01:00.000Z')); // 4:01 PM
      jest.advanceTimersByTime(61_000);
    });
    expect(lastAnchor()).toBe('2026-11-03:event-dinner');
  });

  it('opens at the day heading when nothing that day is over', async () => {
    window.localStorage.setItem(CACHE_KEY, 'hide');
    await renderStart();
    expect(lastAnchor()).toBe('day-2026-11-03');
  });

  it('passes over all-day events: the backdrop is never the next thing', async () => {
    const allDay: CalendarEvent = { ...event('fair', 'School book fair', '2026-11-03T06:00:00Z', '2026-11-04T06:00:00Z'), allDay: true };
    await renderStart([allDay, ...events]);
    expect(lastAnchor()).toBe('2026-11-03:event-practice');
  });

  it('opens at the next day when today is over', async () => {
    const tomorrow = event('swim', 'Swim lesson', '2026-11-04T15:00:00Z', '2026-11-04T16:00:00Z');
    jest.setSystemTime(new Date('2026-11-04T02:00:00.000Z')); // 8:00 PM on the 3rd
    await renderStart([...events, tomorrow]);
    expect(lastAnchor()).toBe('day-2026-11-04');
  });

  it('does nothing on the Calendar page (no startAtNext)', () => {
    mockAnchors.length = 0;
    render(<AgendaView events={events} days={7} onEventClick={() => {}} />);
    expect(lastAnchor()).toBeNull();
  });
});
