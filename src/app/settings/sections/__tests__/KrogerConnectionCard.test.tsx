/**
 * @jest-environment jsdom
 */
/**
 * The redirect URI copy button must say whether the copy worked: on a plain
 * http:// page the clipboard API is missing and the copy used to fail silently.
 */
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';

const toastMock = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({ toast: (arg: unknown) => toastMock(arg) }));

import { KrogerConnectionCard } from '../KrogerConnectionCard';

beforeEach(() => {
  toastMock.mockClear();
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: async () => ({ configured: false, connected: false, tokenExpiresAt: null, preferredLocationId: null, preferredLocationName: null }),
  } as Response)) as unknown as typeof fetch;
});

function setClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
}

async function copy() {
  render(<KrogerConnectionCard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Copy' }));
  await waitFor(() => expect(toastMock).toHaveBeenCalled());
  return toastMock.mock.calls.map(([arg]) => (arg as { title: string }).title);
}

describe('KrogerConnectionCard redirect URI copy', () => {
  it('says copied when the clipboard took the address', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    expect(await copy()).toEqual(['Redirect URI copied']);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/api/auth/kroger/callback'));
  });

  it('says it could not copy when there is no clipboard (plain http://)', async () => {
    setClipboard(undefined);
    expect(await copy()).toEqual(["Couldn't copy the redirect URI"]);
  });

  it('says it could not copy when the browser refuses', async () => {
    setClipboard({ writeText: jest.fn().mockRejectedValue(new Error('denied')) });
    expect(await copy()).toEqual(["Couldn't copy the redirect URI"]);
  });
});
