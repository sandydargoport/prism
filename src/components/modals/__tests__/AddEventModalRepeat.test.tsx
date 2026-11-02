/**
 * @jest-environment jsdom
 */
/**
 * The repeat builder in the event form (#59): what the form sends when a
 * custom repeat is edited, that a rule from another app survives a save
 * untouched, and that a weekly repeat starts on its first chosen day.
 */
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';

jest.mock('@/lib/hooks', () => ({
  useCalendarSources: () => ({
    calendars: [{ id: 'cal-1', provider: 'local', enabled: true, displayName: 'Family', dashboardCalendarName: 'Family', isFamily: true, color: '#336699' }],
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

/** An event to edit: 17:00-18:00 Chicago on the given date, with a rule. */
function eventOn(dateKey: string, recurrenceRule: string) {
  return {
    id: 'e1',
    title: 'Swim practice',
    description: null,
    location: null,
    // 17:00 CST is 23:00Z.
    startTime: `${dateKey}T23:00:00.000Z`,
    endTime: `${dateKey}T23:59:00.000Z`,
    allDay: false,
    recurrenceRule,
    calendarSourceId: 'cal-1',
  } as never;
}

async function save(): Promise<Record<string, unknown>> {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === '/api/events/e1')).toBe(true));
  const call = fetchMock.mock.calls.find(([url]) => url === '/api/events/e1')!;
  return JSON.parse(call[1]!.body as string);
}

describe('AddEventModal repeat builder', () => {
  it('opens a rule outside the presets in the builder and sends what was edited', async () => {
    // Wednesdays from Wed 18 Nov 2026.
    render(<AddEventModal open onOpenChange={jest.fn()} event={eventOn('2026-11-18', 'FREQ=WEEKLY;BYDAY=WE')} />);
    expect(screen.getByTestId('repeat-builder')).toBeTruthy();

    // Every 2 weeks, on Wednesday and Friday, until 15 Jun 2027.
    fireEvent.change(screen.getByLabelText('How often'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Friday' }));
    fireEvent.click(screen.getByRole('button', { name: 'On a date' }));
    fireEvent.change(screen.getByLabelText('Last date'), { target: { value: '2027-06-15' } });

    const body = await save();
    expect(body.recurrenceRule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=WE,FR;UNTIL=20270616T045959Z');
    expect(body.recurring).toBe(true);
    expect(body.startTime).toBe('2026-11-18T23:00:00.000Z');
  });

  it('keeps the last day of a weekly repeat switched on', () => {
    render(<AddEventModal open onOpenChange={jest.fn()} event={eventOn('2026-11-18', 'FREQ=WEEKLY;BYDAY=WE')} />);
    const wednesday = screen.getByRole('button', { name: 'Wednesday' });
    fireEvent.click(wednesday);
    expect(wednesday.getAttribute('aria-pressed')).toBe('true');
  });

  it('offers the third Wednesday for a monthly repeat', async () => {
    render(<AddEventModal open onOpenChange={jest.fn()} event={eventOn('2026-11-18', 'FREQ=MONTHLY;BYDAY=3WE')} />);
    const choice = // The test translator leaves ICU selects raw, so match around the ordinal.
    screen.getByRole('button', { name: /^On the .* Wednesday$/ });
    expect(choice.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'On day 18' }));
    expect((await save()).recurrenceRule).toBe('FREQ=MONTHLY;BYMONTHDAY=18');
  });

  it('saves a rule from another app unchanged', async () => {
    const rule = 'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1';
    render(<AddEventModal open onOpenChange={jest.fn()} event={eventOn('2026-11-30', rule)} />);
    expect(screen.queryByTestId('repeat-builder')).toBeNull();
    expect((await save()).recurrenceRule).toBe(rule);
  });

  it('starts a weekly repeat on its first chosen day', async () => {
    // Monday 16 Nov, repeating on Tuesdays: the event moves to Tuesday 17 Nov.
    render(<AddEventModal open onOpenChange={jest.fn()} event={eventOn('2026-11-16', 'FREQ=WEEKLY;BYDAY=TU')} />);
    const body = await save();
    expect(body.startTime).toBe('2026-11-17T23:00:00.000Z');
    expect(body.endTime).toBe('2026-11-17T23:59:00.000Z');
  });
});
