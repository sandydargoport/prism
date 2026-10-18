/**
 * @jest-environment jsdom
 */

/**
 * Signing in is offered, not described: a refused change and a requireAuth()
 * call open the PIN box, with no toast telling the user to go and find it.
 */

import React from 'react';
import { render, act, screen, fireEvent } from '@testing-library/react';

const toast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
jest.mock('@/lib/hooks/useVisibilityPolling', () => ({ useVisibilityPolling: () => {} }));
// The real PIN box needs the family list; a stand-in shows what it was opened with.
jest.mock('@/components/auth', () => ({
  QuickPinModal: ({ open, title, description }: { open: boolean; title: string; description: string }) =>
    open ? <div role="dialog">{title} / {description}</div> : null,
}));

import { AuthProvider, useAuth } from '../AuthProvider';

function Probe() {
  const { requireAuth } = useAuth();
  return <button onClick={() => { void requireAuth('Sign in to edit', 'Parents only'); }}>edit</button>;
}

// jsdom has no Response; the provider only reads ok, status and json().
function respond(status: number, body: unknown = {}) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body } as unknown as Response);
}

describe('AuthProvider sign-in prompts', () => {
  beforeEach(() => {
    toast.mockReset();
    // Session check: nobody signed in.
    global.fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).includes('/api/auth/me') ? respond(401) : respond(401),
    ) as typeof fetch;
  });

  async function mount() {
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { await Promise.resolve(); });
  }

  it('a change refused with 401 opens the PIN box, not a toast', async () => {
    await mount();
    await act(async () => { await window.fetch('/api/chores/1', { method: 'PATCH' }); });
    expect(screen.getByRole('dialog').textContent).toContain('Sign in to make changes');
    expect(toast).not.toHaveBeenCalled();
  });

  it('a refused GET does not prompt', async () => {
    await mount();
    await act(async () => { await window.fetch('/api/chores'); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('requireAuth opens the PIN box with no toast alongside it', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('dialog').textContent).toContain('Sign in to edit');
    expect(toast).not.toHaveBeenCalled();
  });
});
