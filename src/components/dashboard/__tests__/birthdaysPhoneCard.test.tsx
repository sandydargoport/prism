/**
 * @jest-environment jsdom
 */
/**
 * On a phone, tapping Birthdays opens the full birthdays widget. There is no
 * birthdays page, and the tile used to link to the calendar, which on a phone
 * opens in agenda view.
 */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

jest.mock('next/dynamic', () => () => () => null);
// The birthdays list's Remove asks for a parent; nobody is signed in here.
jest.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ requireAuth: async () => null }) }));
jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', displayTimezone: 'UTC' }),
}));
jest.mock('../useMobileCardOrder', () => ({
  useMobileCardOrder: () => ({ order: ['birthdays'], setOrder: jest.fn() }),
  useHiddenCards: () => [[]],
}));
jest.mock('@/lib/hooks/usePullToRefresh', () => ({ usePullToRefresh: () => ({ pullDistance: 0, refreshing: false }) }));
let layout: 'rows' | 'tiles' = 'tiles';
jest.mock('@/lib/hooks/useMobileLayout', () => ({ useMobileLayout: () => ({ layout }) }));
jest.mock('@/lib/hooks/useBusTracking', () => ({ useBusTracking: () => ({ routes: [], allRoutes: [] }) }));
jest.mock('@/lib/hooks/useBusLive', () => ({
  ...jest.requireActual('@/lib/hooks/useBusLive'),
  useBusLive: () => ({ tracks: [], provider: null, clockOffsetMs: 0 }),
}));

import { MobileDashboard } from '../MobileDashboard';

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const birthday = (id: string, name: string, daysUntil: number) => ({
  id, name, birthDate: '2015-11-02', eventType: 'birthday' as const, age: 11, daysUntil, nextBirthday: '2026-11-02',
});
const data = new Proxy({
  birthdays: {
    birthdays: [birthday('1', 'Robin', 2), birthday('2', 'Sam', 9), birthday('3', 'Alex', 40)],
    loading: false,
    error: null,
  },
}, { get: (t, k) => (t as Record<string | symbol, unknown>)[k] ?? {} }) as React.ComponentProps<typeof MobileDashboard>['data'];

describe('phone dashboard Birthdays', () => {
  for (const mode of ['tiles', 'rows'] as const) {
    it(`opens the full birthdays widget from the ${mode} view, not the calendar`, () => {
      layout = mode;
      render(<MobileDashboard data={data} />);
      expect(document.querySelector('a[href="/calendar"]')).toBeNull();

      act(() => { fireEvent.click(screen.getByRole('button', { name: /Birthdays/ })); });
      const sheet = screen.getByRole('dialog');
      // The widget's own table, every upcoming birthday, not the card's top two.
      for (const name of ['Robin', 'Sam', 'Alex']) expect(within(sheet).getByText(name)).toBeTruthy();
    });
  }
});
