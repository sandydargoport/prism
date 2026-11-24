/**
 * @jest-environment jsdom
 */
/**
 * More > This phone > Cards and Reorder (#1354). They reach the phone's
 * dashboard of cards as events sent once More has closed. Cards opens a sheet
 * whose taps show at once (no reload on Done); Reorder puts a Done bar above
 * the dock, and Done ends it.
 */
import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react';
import { PHONE_CARDS_EVENT, PHONE_REORDER_EVENT } from '@/lib/constants/dock';

jest.mock('next/dynamic', () => () => () => null);
jest.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ requireAuth: async () => null }) }));
jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', displayTimezone: 'UTC' }),
}));
jest.mock('@/lib/hooks/usePullToRefresh', () => ({ usePullToRefresh: () => ({ pullDistance: 0, refreshing: false }) }));
jest.mock('@/lib/hooks/useBusTracking', () => ({ useBusTracking: () => ({ routes: [], allRoutes: [] }) }));
jest.mock('@/lib/hooks/useBusLive', () => ({
  ...jest.requireActual('@/lib/hooks/useBusLive'),
  useBusLive: () => ({ tracks: [], provider: null, clockOffsetMs: 0 }),
}));
jest.mock('../useMobileCardOrder', () => ({
  ...jest.requireActual('../useMobileCardOrder'),
  useMobileCardOrder: () => ({ order: ['birthdays'], setOrder: jest.fn() }),
}));

import { MobileDashboard } from '../MobileDashboard';

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
beforeEach(() => { localStorage.clear(); });

const data = new Proxy({
  birthdays: {
    birthdays: [{ id: '1', name: 'Robin', birthDate: '2015-11-02', eventType: 'birthday' as const, age: 11, daysUntil: 2, nextBirthday: '2026-11-02' }],
    loading: false,
    error: null,
  },
}, { get: (t, k) => (t as Record<string | symbol, unknown>)[k] ?? {} }) as React.ComponentProps<typeof MobileDashboard>['data'];

const send = (event: string) => act(() => { window.dispatchEvent(new CustomEvent(event, { detail: { active: true } })); });
const birthdaysCard = () => { const cards = document.querySelector<HTMLElement>('[data-mobile-cards]'); return cards && within(cards).queryByRole('button', { name: /Birthdays/, hidden: true }); };

describe('This phone on a dashboard of cards (#1354)', () => {
  it('Cards opens a sheet; hiding a card shows at once, and Done only closes it', () => {
    render(<MobileDashboard data={data} />);
    expect(document.querySelector('[data-phone-cards]')).toBeNull();
    send(PHONE_CARDS_EVENT);
    const sheet = document.querySelector<HTMLElement>('[data-phone-cards]')!;
    expect(sheet).not.toBeNull();
    expect(within(sheet).getByText('Rows')).toBeTruthy();
    expect(within(sheet).queryByText('Theme')).toBeNull();

    // The dashboard behind the sheet changes on the tap itself, so Done
    // needs no reload.
    expect(birthdaysCard()).not.toBeNull();
    act(() => { fireEvent.click(sheet.querySelector('[data-phone-card="birthdays"]')!); });
    expect(birthdaysCard()).toBeNull();
    expect(localStorage.getItem('prism-mobile-hidden-cards')).toContain('birthdays');

    act(() => { fireEvent.click(sheet.querySelector('[data-phone-cards-done]')!); });
    expect(document.querySelector('[data-phone-cards]')).toBeNull();
    expect(birthdaysCard()).toBeNull();
  });

  it('Reorder puts a Done bar above the dock; Done ends reordering', () => {
    render(<MobileDashboard data={data} />);
    expect(document.querySelector('[data-reorder-done-bar]')).toBeNull();
    send(PHONE_REORDER_EVENT);
    const bar = document.querySelector<HTMLElement>('[data-reorder-done-bar]')!;
    expect(bar).not.toBeNull();
    expect(bar.className).toContain('fixed');
    expect(bar.style.bottom).toBe('calc(var(--nav-bottom, 0px) + 0.5rem)');
    expect(document.querySelector('[data-mobile-reorder]')).not.toBeNull();
    act(() => { fireEvent.click(bar.querySelector('[data-reorder-done]')!); });
    expect(document.querySelector('[data-reorder-done-bar]')).toBeNull();
    expect(document.querySelector('[data-mobile-reorder]')).toBeNull();
    expect(document.querySelector('[data-mobile-cards]')).not.toBeNull();
  });
});
