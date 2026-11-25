/**
 * @jest-environment jsdom
 */
/**
 * "Sync now" on a photo source says when the sync failed, and why (#1286).
 * The button used to spin for a moment and stop, with no message, whatever
 * the route answered.
 */
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';

const toastMock = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({ toast: (arg: unknown) => toastMock(arg) }));
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock('@/components/providers', () => ({ useDisplayTimestampFormat: () => ({ date: (s: string) => s }) }));
jest.mock('@/components/layout/WallpaperBackground', () => ({
  usePinnedPhoto: () => ({ pinnedId: null, setPinnedId: jest.fn() }),
}));
jest.mock('@/lib/hooks/usePhotos', () => ({ usePhotos: () => ({ photos: [], loading: false }) }));
jest.mock('@/app/settings/SettingsView', () => ({
  useTargetResolution: () => ({
    resolution: { width: 1920, height: 1080 },
    setResolution: jest.fn(),
    screenSize: { width: 1920, height: 1080 },
  }),
}));

import { PhotosSettingsSection } from '../PhotosSettingsSection';

const source = {
  id: 's1',
  type: 'immich',
  name: 'Garden album',
  priority: 100,
  onedriveFolderId: null,
  enabled: true,
  lastSynced: null,
  photoCount: 3,
};

const json = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

/** GET /api/photo-sources lists one Immich source; the sync POST answers `sync`. */
function mockApi(sync: () => Promise<Response>) {
  const fetchMock = jest.fn((url: string, init?: RequestInit) => {
    if (url === '/api/photo-sources/s1/sync' && init?.method === 'POST') return sync();
    if (url === '/api/photo-sources') return json(200, { sources: [source] });
    return json(404, {});
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** Click "Sync now" and wait until the button is usable again (the sync ended). */
async function clickSync() {
  render(<PhotosSettingsSection />);
  const button = (await screen.findByTitle('Sync now')) as HTMLButtonElement;
  fireEvent.click(button);
  expect(button.disabled).toBe(true);
  await waitFor(() => expect((screen.getByTitle('Sync now') as HTMLButtonElement).disabled).toBe(false));
}

const sourceListLoads = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.filter(([url]) => url === '/api/photo-sources').length;

beforeEach(() => toastMock.mockClear());
afterEach(() => jest.restoreAllMocks());

describe('PhotosSettingsSection "Sync now"', () => {
  it('says the sync failed and gives the reason the route sent', async () => {
    const reason = 'Immich shared-link fetch failed: 503 Service Unavailable';
    const fetchMock = mockApi(() => json(500, { error: reason }));

    await clickSync();

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Sync failed', description: reason, variant: 'destructive' }),
    );
    // The list still refreshes: a sync that failed part way may have added photos.
    expect(sourceListLoads(fetchMock)).toBe(2);
  });

  it('says the sync failed when Prism cannot be reached', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockApi(() => Promise.reject(new TypeError('Failed to fetch')));

    await clickSync();

    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sync failed', variant: 'destructive' }));
  });

  it('shows no error after a sync that worked, and refreshes the list as before', async () => {
    const fetchMock = mockApi(() => json(200, { success: true }));

    await clickSync();

    expect(sourceListLoads(fetchMock)).toBe(2);
    expect(toastMock).not.toHaveBeenCalled();
  });
});

// #1351: captions and On this day are household settings for every screen,
// here in Settings > Photos, not behind the wallpaper switch in Appearance.
describe('PhotosSettingsSection captions and On this day', () => {
  it('shows the three switches with their saved values, and a change saves at once', async () => {
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (url === '/api/settings' && !init?.method) return json(200, { settings: { photoCaptionDate: false, photoCaptionPlace: true } });
      if (url === '/api/settings') return json(200, {});
      if (url === '/api/photo-sources') return json(200, { sources: [] });
      return json(404, {});
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PhotosSettingsSection />);
    const date = await screen.findByRole('switch', { name: 'Show when photos were taken' });
    expect(date.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Show where photos were taken' }).getAttribute('aria-checked')).toBe('true');
    const onThisDay = screen.getByRole('switch', { name: 'On this day' });
    expect(onThisDay.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(onThisDay);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ key: 'photoOnThisDay', value: true }),
    })));
  });
});
