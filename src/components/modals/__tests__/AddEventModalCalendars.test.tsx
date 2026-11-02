/**
 * @jest-environment jsdom
 */
/**
 * Which calendars the event form offers: CalDAV calendars too, since an event
 * made in Prism is created on the server (#687), but not iCal feeds.
 */
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';

jest.mock('@/lib/hooks', () => ({
  useCalendarSources: () => ({
    calendars: [
      { id: 'feed-1', provider: 'ical', enabled: true, displayName: 'School feed', dashboardCalendarName: 'School feed', isFamily: true, color: '#111111' },
      { id: 'dav-1', provider: 'caldav', enabled: true, displayName: 'Family', dashboardCalendarName: 'Family', isFamily: true, color: '#336699' },
    ],
  }),
}));
jest.mock('@/components/providers', () => ({
  useAuth: () => ({ activeUser: null }),
  useTimeFormat: () => ({ timeFormat: '24h', displayTimezone: 'America/Chicago' }),
}));
jest.mock('@/components/ui/use-toast', () => ({ toast: jest.fn() }));

import { AddEventModal } from '../AddEventModal';

const fetchMock = jest.fn((_url: string, _init?: RequestInit) =>
  Promise.resolve({ ok: true, json: async () => ({}) } as Response));
beforeEach(() => {
  fetchMock.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

it('adds a new event to a CalDAV calendar, and never to an iCal feed', async () => {
  render(<AddEventModal open onOpenChange={jest.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('Add title'), { target: { value: 'Book fair' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === '/api/events')).toBe(true));
  const call = fetchMock.mock.calls.find(([url]) => url === '/api/events')!;
  expect(JSON.parse(call[1]!.body as string).calendarSourceId).toBe('dav-1');
});
