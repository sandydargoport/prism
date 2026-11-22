/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { WeekVerticalView } from '../WeekVerticalView';
import { resetPastEventsSync } from '@/lib/hooks/usePastEventsMode';
import type { CalendarEvent } from '@/types/calendar';

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'America/Chicago' }),
}));

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

// Tuesday 3 Nov 2026, 3:00 PM in Springfield (America/Chicago).
const NOW = new Date('2026-11-03T21:00:00.000Z');
const events = [
  event('monday', 'Sophie piano', '2026-11-02T23:00:00Z', '2026-11-03T00:00:00Z'),
  event('dentist', 'Emma dentist', '2026-11-03T15:00:00Z', '2026-11-03T16:00:00Z'),
  event('dinner', 'Parker family dinner', '2026-11-04T00:00:00Z', '2026-11-04T01:00:00Z'),
];

let settingsFromServer: Record<string, unknown> = {};

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
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

async function renderList() {
  render(<WeekVerticalView currentDate={new Date(2026, 10, 3)} events={events} onEventClick={() => {}} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('WeekVerticalView (list) past events', () => {
  it('keeps ended events by default', async () => {
    await renderList();
    expect(screen.getByText('Sophie piano')).toBeTruthy();
    expect(screen.getByText('Emma dentist')).toBeTruthy();
  });

  it('removes ended events, from earlier days too, when Hidden', async () => {
    settingsFromServer = { calendarPastEvents: 'hide' };
    await renderList();
    expect(screen.queryByText('Sophie piano')).toBeNull();
    expect(screen.queryByText('Emma dentist')).toBeNull();
    expect(screen.getByText('Parker family dinner')).toBeTruthy();
  });
});
