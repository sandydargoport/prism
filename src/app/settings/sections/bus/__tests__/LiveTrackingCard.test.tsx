/**
 * @jest-environment jsdom
 */
/**
 * The provider token is shown once, so its copy button must not say "copied"
 * when nothing was: on a plain http:// page the clipboard API is missing.
 */
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';

const toastMock = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({ toast: (arg: unknown) => toastMock(arg) }));

import { LiveTrackingCard } from '../LiveTrackingCard';

const TOKEN = 'prism_test_token_123';

beforeEach(() => {
  toastMock.mockClear();
  global.fetch = jest.fn((url: string) => {
    const body = url === '/api/auth/tokens' ? { token: TOKEN } : url.includes('tracks') ? { tracks: [], lastReceivedAt: null } : {};
    return Promise.resolve({ ok: true, json: async () => body } as Response);
  }) as unknown as typeof fetch;
});

function setClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
}

async function createAndCopy() {
  render(<LiveTrackingCard routes={[]} onBound={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /create provider token/i }));
  fireEvent.click(await screen.findByRole('button', { name: /copy token/i }));
  await waitFor(() => expect(toastMock).toHaveBeenCalled());
  return toastMock.mock.calls.map(([arg]) => (arg as { title: string }).title);
}

describe('LiveTrackingCard token copy', () => {
  it('says copied when the clipboard took the token', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    expect(await createAndCopy()).toEqual(['Token copied']);
    expect(writeText).toHaveBeenCalledWith(TOKEN);
  });

  it('says it could not copy when there is no clipboard (plain http://)', async () => {
    setClipboard(undefined);
    expect(await createAndCopy()).toEqual(["Couldn't copy the token"]);
  });

  it('says it could not copy when the browser refuses', async () => {
    setClipboard({ writeText: jest.fn().mockRejectedValue(new Error('denied')) });
    expect(await createAndCopy()).toEqual(["Couldn't copy the token"]);
  });
});
