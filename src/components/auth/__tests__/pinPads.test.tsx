/**
 * @jest-environment jsdom
 */
/**
 * One PIN pad (#1196): sign-in, the Settings gate and leaving Away mode and
 * Babysitter mode all draw the shared pad, at their own size, with every key
 * named for a screen reader, and a PIN typed on it reaches that screen's own
 * unlock request.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const alex = { id: 'm1', loginIndex: 0, name: 'Alex', color: '#3b82f6', role: 'parent' as const, pinLength: 4, hasPin: true };
jest.mock('@/components/providers', () => ({
  useFamily: () => ({ loading: false, members: [alex] }),
  useAuth: () => ({ setActiveUser: jest.fn() }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
jest.mock('@/lib/hooks/useStoredValue', () => ({ useHydrated: () => true }));
jest.mock('@/app/settings/SettingsView', () => ({ SettingsView: () => <div>Settings</div> }));

import { QuickPinModal } from '../QuickPinModal';
import { ExitAwayModeModal } from '@/components/away-mode/ExitAwayModeModal';
import { ExitBabysitterModeModal } from '@/components/babysitter-mode/ExitBabysitterModeModal';
import { SettingsPinGate } from '@/app/settings/SettingsPinGate';

const calls: Array<{ url: string; body: string }> = [];
beforeEach(() => {
  calls.length = 0;
  global.fetch = jest.fn(async (url: string, init?: { body?: string }) => {
    calls.push({ url, body: init?.body ?? '' });
    if (url.includes('settings-verified')) return { ok: true, json: async () => ({ verified: false, pinRequired: true }) };
    return { ok: false, status: 401, json: async () => ({ error: 'Wrong PIN', attemptsRemaining: 4 }) };
  }) as unknown as typeof fetch;
});

const screens: Array<[string, () => React.ReactElement, 'compact' | 'large', string]> = [
  ['sign-in', () => <QuickPinModal open onOpenChange={jest.fn()} title="Sign in" onAuthenticated={jest.fn()} preSelectedMember={alex} />, 'compact', '/api/auth/login'],
  ['the Settings gate', () => <SettingsPinGate />, 'compact', '/api/auth/verify-pin'],
  ['leaving Away mode', () => <ExitAwayModeModal open onOpenChange={jest.fn()} onSuccess={jest.fn()} />, 'large', '/api/auth/login'],
  ['leaving Babysitter mode', () => <ExitBabysitterModeModal open onOpenChange={jest.fn()} onSuccess={jest.fn()} />, 'large', '/api/auth/login'],
];

describe.each(screens)('the PIN pad on %s', (_name, ui, size, endpoint) => {
  it('is the shared pad at its size, with every key named, and a typed PIN is sent to unlock', async () => {
    render(ui());
    // Pick the parent where the screen asks who it is (sign-in is handed Alex).
    const alexButton = () => screen.queryAllByRole('button').find((b) => b.textContent?.includes('Alex') && !b.closest('[data-pin-pad]'));
    await waitFor(() => expect(document.querySelector('[data-pin-pad]') ?? alexButton()).toBeTruthy());
    if (!document.querySelector('[data-pin-pad]')) fireEvent.click(alexButton()!);
    await waitFor(() => expect(document.querySelector('[data-pin-pad]')).toBeTruthy());

    const pad = document.querySelector<HTMLElement>('[data-pin-pad]')!;
    expect(pad.dataset.pinPad).toBe(size);
    for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(screen.getByRole('button', { name: d })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeTruthy();
    for (const b of pad.querySelectorAll('button')) expect(b.getAttribute('type')).toBe('button');

    // The dots follow the digits, and Del takes the last one back off.
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete last digit' }));
    expect(document.querySelector<HTMLElement>('[data-pin-dots]')!.dataset.pinDots).toBe('2');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '3' }));
      fireEvent.click(screen.getByRole('button', { name: '9' }));
    });
    await waitFor(() => expect(calls.map((c) => c.url)).toContain(endpoint));
    expect(calls.find((c) => c.url.includes(endpoint))!.body).toContain('1239');
  });
});
