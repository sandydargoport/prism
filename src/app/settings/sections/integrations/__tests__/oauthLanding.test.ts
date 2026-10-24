/**
 * @jest-environment jsdom
 */
/**
 * An OAuth redirect back to Settings carries its result in the URL. The hook
 * that backs a provider card has to show the status, or open the list picker
 * with the provider's lists, from that URL alone.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useIntegrationSources } from '../useIntegrationSources';
import type { IntegrationConfig } from '../types';

let search = '';
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search) }));
jest.mock('@/lib/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: jest.fn(), dialogProps: {} }),
}));

const config = {
  section: 'tasks',
  apiBase: '/api/task-sources',
  finalizeEndpoint: '/api/task-sources/finalize',
  oauthEntityParam: 'taskListId',
  returnSection: 'tasks',
  deleteConfirmSuffix: '',
  providers: {},
  errorMessages: { denied: 'Access was denied' },
  successMessages: {},
} as unknown as IntegrationConfig;

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(url.includes('lists') ? { lists: [{ id: 'l1', name: 'Groceries' }] } : []),
    }),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('OAuth landing', () => {
  it('shows the error from the redirect', () => {
    search = 'section=integrations&error=denied';
    const { result } = renderHook(() => useIntegrationSources(config));
    expect(result.current.statusMessage).toEqual({ type: 'error', text: 'Access was denied' });
  });

  it('opens the Microsoft list picker with the lists for the list being connected', async () => {
    search = 'section=integrations&selectMsList=true&taskListId=t9';
    const { result } = renderHook(() => useIntegrationSources(config));
    await waitFor(() => expect(result.current.showMsListModal).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith('/api/task-sources/microsoft-lists?taskListId=t9');
    expect(result.current.listSelectionProvider).toBe('microsoft_todo');
    expect(result.current.msLists).toEqual([{ id: 'l1', name: 'Groceries' }]);
  });

  it('a card filtered to the other provider ignores the redirect', async () => {
    search = 'section=integrations&selectGoogleTasksList=true&newConnection=true';
    const { result } = renderHook(() =>
      useIntegrationSources({ ...config, respondsToProvider: 'microsoft_todo' } as IntegrationConfig),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalledWith('/api/task-sources/google-lists');
    expect(result.current.showMsListModal).toBe(false);
  });

  it('ignores a URL for another section', () => {
    search = 'section=photos&error=denied';
    const { result } = renderHook(() => useIntegrationSources(config));
    expect(result.current.statusMessage).toBeNull();
  });
});
