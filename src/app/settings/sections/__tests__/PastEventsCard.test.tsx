/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PastEventsCard } from '../PastEventsCard';
import { resetPastEventsSync } from '@/lib/hooks/usePastEventsMode';

const mockToast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({ toast: (...a: unknown[]) => mockToast(...a) }));

let settingsFromServer: Record<string, unknown> = {};
let fetchMock: jest.Mock;

beforeEach(() => {
  mockToast.mockClear();
  window.localStorage.clear();
  resetPastEventsSync();
  settingsFromServer = {};
  fetchMock = jest.fn(async () => ({
    ok: true,
    json: async () => ({ settings: settingsFromServer }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(cleanup);

async function renderCard() {
  render(<PastEventsCard />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return screen.getByRole('switch', { name: 'Hide ended events in the agenda and list' });
}

function patchedValues(): unknown[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'PATCH')
    .map(([, init]) => JSON.parse(init.body as string).value);
}

describe('PastEventsCard', () => {
  it('is one switch, off by default: ended events are dimmed, not hidden', async () => {
    const toggle = await renderCard();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('shows the household\'s choice when it already hides them', async () => {
    settingsFromServer = { calendarPastEvents: 'hide' };
    const toggle = await renderCard();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('saves hide when switched on and dim when switched off', async () => {
    const toggle = await renderCard();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(patchedValues()).toEqual(['hide', 'dim']);
  });

  // #1229: a save the server refuses does not leave the switch showing a
  // choice the household setting does not have.
  it('puts the switch back and says so when the save is refused', async () => {
    const toggle = await renderCard();
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => (init?.method === 'PATCH'
      ? { ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) }
      : { ok: true, json: async () => ({ settings: settingsFromServer }) }));
    await act(async () => {
      fireEvent.click(toggle);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Not saved', description: 'Only a parent can change this.' }));
  });

  it('puts the switch back when the save cannot reach the server', async () => {
    const toggle = await renderCard();
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') throw new Error('offline');
      return { ok: true, json: async () => ({ settings: settingsFromServer }) };
    });
    await act(async () => {
      fireEvent.click(toggle);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Check the connection and try again.' }));
  });
});
