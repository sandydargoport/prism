/**
 * @jest-environment jsdom
 */
/**
 * Today's list (#1186): what is still to come is under "Later today", and what
 * is over is under its own "Earlier today", not mixed in with the rest.
 */
import { render, screen, within } from '@testing-library/react';
import { TodayList } from '../TodayList';
import type { CalendarEvent } from '@/types/calendar';

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'America/Chicago' }),
}));

// A June day in Chicago (UTC-5): 4 pm is 21:00Z.
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 5, 17, h + 5, m));
const event = (id: string, title: string, from: number, to: number): CalendarEvent => ({
  id, title, startTime: at(from), endTime: at(to), allDay: false, calendarId: 'c', color: '#3b82f6',
} as unknown as CalendarEvent);

const day = [
  event('soccer', 'Soccer Practice', 16, 17.5),
  event('scouts', 'Scouts Meeting', 18, 19),
  event('movie', 'Family Movie Night', 19, 21),
];

const group = (key: string) => document.querySelector(`[data-today-group="${key}"]`) as HTMLElement | null;
const rows = (key: string) => [...(group(key)?.querySelectorAll('[data-today-later-row]') ?? [])].map((r) => r.textContent);

describe('the Today list', () => {
  it('at 8:45 pm puts what has ended under Earlier today, and nothing under Later today', () => {
    render(<TodayList events={day} now={at(20, 45)} variant="wall" />);
    expect(group('laterToday')).toBeNull();
    expect(within(group('earlierToday')!).getByText('Earlier today')).toBeTruthy();
    expect(rows('earlierToday').join(' | ')).toMatch(/Scouts Meeting.*\|.*Soccer Practice/);
    expect(screen.queryByText('Later today')).toBeNull();
  });

  it('at 4:10 pm keeps what is still to come under Later today', () => {
    render(<TodayList events={day} now={at(16, 10)} variant="wall" />);
    expect(rows('laterToday').join(' | ')).toMatch(/Scouts Meeting.*\|.*Family Movie Night/);
    expect(group('earlierToday')).toBeNull();
  });

  it('marks ended rows as past', () => {
    render(<TodayList events={day} now={at(18, 30)} variant="phone" />);
    const ended = group('earlierToday')!.querySelectorAll('[data-today-later-row][data-past]');
    expect(ended).toHaveLength(1);
    expect(rows('laterToday').some((r) => r?.includes('Family Movie Night'))).toBe(true);
  });
});
