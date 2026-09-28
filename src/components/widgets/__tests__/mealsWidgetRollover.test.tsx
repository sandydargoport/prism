/**
 * @jest-environment jsdom
 */

/**
 * The Meals widget on a wall display that is never reloaded: the week it
 * shows has to move when midnight moves "today" into the next week.
 */

import * as React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import type { Meal } from '@/types';

jest.mock('@/lib/utils', () => ({ cn: (...c: unknown[]) => c.filter(Boolean).join(' ') }));
jest.mock('@/components/ui', () => ({
  Button: ({ children, onClick, ...p }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button onClick={onClick} {...p}>{children}</button>
  ),
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  UserAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}));
jest.mock('@/components/ui/input', () => ({ Input: () => <input /> }));
jest.mock('@/components/ui/Emoji', () => ({ Emoji: () => null }));
jest.mock('@/components/widgets/WidgetContainer', () => ({
  WidgetContainer: ({ children, actions }: React.PropsWithChildren<{ actions?: React.ReactNode }>) => (
    <div>{actions}{children}</div>
  ),
  WidgetEmpty: ({ message }: { message: string }) => <div>{message}</div>,
}));
jest.mock('@/lib/hooks/useWeekStartsOn', () => ({
  useWeekStartsOn: () => ({ weekStartsOn: 0, setWeekStartsOn: jest.fn(), loading: false }),
}));

import { MealsWidget } from '../MealsWidget';

const meal = (date: string, name: string): Meal => ({
  id: name,
  name,
  weekOf: date,
  date,
  dayOfWeek: 'sunday',
  mealType: 'dinner',
  createdAt: new Date('2026-09-01T00:00:00Z'),
});

describe('MealsWidget week at midnight', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Saturday, the last day of a Sunday-start week, just before midnight.
    jest.setSystemTime(new Date(2026, 9, 3, 23, 59, 30));
  });
  afterEach(() => jest.useRealTimers());

  it('moves to the new week when the date rolls over', () => {
    render(<MealsWidget meals={[meal('2026-10-04', 'Sunday roast')]} />);
    screen.getByText('Sep 27 - Oct 3');
    expect(screen.queryByText('Sunday roast')).toBeNull();

    act(() => { jest.advanceTimersByTime(60_000); });

    screen.getByText('Oct 4 - Oct 10');
    screen.getByText('Sunday roast');
    // Still on the current week, so no "back to today" button.
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
  });

  it('keeps a browsed week the same distance from today', () => {
    render(<MealsWidget meals={[]} />);
    fireEvent.click(screen.getByLabelText('Next week'));
    screen.getByText('Oct 4 - Oct 10');

    act(() => { jest.advanceTimersByTime(60_000); });

    screen.getByText('Oct 11 - Oct 17');
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    screen.getByText('Oct 4 - Oct 10');
  });
});
