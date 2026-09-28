/**
 * @jest-environment jsdom
 */

/**
 * The dashboard Meals tile and mobile card find today's meal by its date.
 * weekOf depends on the week-start setting a meal was saved under, so a
 * Sunday-start plan never matched a Monday-computed weekOf (#531).
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import type { Meal } from '@/types';

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ displayTimezone: 'UTC', use24Hour: false }),
}));

import { MealsTile } from '../TileCards';
import { MealsCard } from '../MobileCards';

const meal = (overrides: Partial<Meal>): Meal => ({
  id: 'm',
  name: 'Meal',
  weekOf: '2026-09-27',
  date: '2026-09-28',
  dayOfWeek: 'monday',
  mealType: 'dinner',
  createdAt: new Date('2026-09-01T00:00:00Z'),
  ...overrides,
});

// Monday 2026-09-28. Its Sunday-start week began 09-27; a Monday-start one 09-28.
const meals = [
  meal({ id: 'a', name: 'Pancakes', mealType: 'breakfast' }),
  meal({ id: 'b', name: 'Tacos' }),
  meal({ id: 'c', name: 'Last Monday', weekOf: '2026-09-20', date: '2026-09-21' }),
];
const data = { meals, loading: false, error: null, refresh: jest.fn(), markCooked: jest.fn() };

describe.each([
  ['MealsTile', MealsTile],
  ['MealsCard', MealsCard],
] as const)('%s', (_name, Component) => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 28, 18, 0));
  });
  afterEach(() => jest.useRealTimers());

  it("shows today's dinner from a Sunday-start plan", () => {
    render(<Component data={data as never} />);
    expect(screen.getByText(/Tacos/)).toBeTruthy();
    expect(screen.queryByText(/No meal planned/)).toBeNull();
  });

  it('says nothing is planned when no meal falls today', () => {
    jest.setSystemTime(new Date(2026, 8, 29, 18, 0));
    render(<Component data={data as never} />);
    expect(screen.getByText(/No meal planned/)).toBeTruthy();
  });
});
