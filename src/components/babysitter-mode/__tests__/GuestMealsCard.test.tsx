/**
 * @jest-environment jsdom
 */

/**
 * Today's meals on the Babysitter Mode overlay (#638): a list of name and
 * slot when the server has some, and nothing at all otherwise.
 */

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { GuestMealsCard } from '../GuestMealsCard';

jest.mock('@/lib/hooks/useVisibilityPolling', () => ({
  useVisibilityPolling: jest.fn(),
}));

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

const respond = (status: number, body: unknown) =>
  mockFetch.mockResolvedValue({ ok: status < 400, status, json: async () => body });

describe('GuestMealsCard', () => {
  it("lists today's meals with their slot", async () => {
    respond(200, {
      date: '2026-10-03',
      meals: [
        { name: 'Pancakes', mealType: 'breakfast' },
        { name: 'Tacos', mealType: 'dinner' },
      ],
    });
    render(<GuestMealsCard />);
    expect(await screen.findByText("Today's Meals")).toBeTruthy();
    expect(screen.getByText('Pancakes')).toBeTruthy();
    expect(screen.getByText('breakfast')).toBeTruthy();
    expect(screen.getByText('Tacos')).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledWith('/api/guest-meals');
  });

  it('renders nothing when nothing is planned', async () => {
    respond(200, { date: '2026-10-03', meals: [] });
    const { container } = render(<GuestMealsCard />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the mode is off', async () => {
    respond(403, { error: 'Babysitter Mode is off.' });
    const { container } = render(<GuestMealsCard />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });
});
