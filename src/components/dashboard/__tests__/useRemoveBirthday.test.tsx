/**
 * @jest-environment jsdom
 *
 * Removing a birthday from the widget: a parent, a confirmation, then the
 * same removal as Settings.
 */

import { act, renderHook } from '@testing-library/react';
import { useRemoveBirthday } from '../useRemoveBirthday';
import type { Birthday } from '@/lib/hooks/useBirthdays';

let user: { id: string; role: string } | null = null;
jest.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ requireAuth: jest.fn(async () => user) }),
}));
jest.mock('@/components/ui/use-toast', () => ({ toast: jest.fn() }));

const birthday = { id: 'b1', name: 'Person One' } as Birthday;
let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn(async () => ({ ok: true }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

async function run(confirmed: boolean) {
  const confirm = jest.fn(async () => confirmed);
  const { result } = renderHook(() => useRemoveBirthday(confirm));
  await act(async () => { await result.current(birthday); });
  return confirm;
}

describe('useRemoveBirthday', () => {
  it('removes it once a parent confirms', async () => {
    user = { id: 'p', role: 'parent' };
    const confirm = await run(true);
    expect(confirm).toHaveBeenCalledWith('Remove Person One?', expect.any(String), expect.objectContaining({ confirmLabel: 'Remove' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/birthdays/b1', { method: 'DELETE' });
  });

  it('keeps it when the parent cancels', async () => {
    user = { id: 'p', role: 'parent' };
    await run(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps it for a child, and when nobody signs in', async () => {
    user = { id: 'c', role: 'child' };
    expect(await run(true)).not.toHaveBeenCalled();
    user = null;
    await run(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
