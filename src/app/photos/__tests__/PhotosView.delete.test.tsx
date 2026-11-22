/**
 * @jest-environment jsdom
 */

/**
 * A photo the server refused to delete stays in the list and says so (#1226):
 * the delete used to ignore the response, so a failed delete looked like a
 * successful one.
 */
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';

const mockRefresh = jest.fn();
const mockToast = jest.fn();
const photo = { id: 'p1', usage: 'gallery', orientation: 'landscape' };

jest.mock('@/lib/hooks/usePhotos', () => ({
  usePhotos: () => ({
    photos: [photo],
    loading: false,
    error: null,
    total: 1,
    refresh: mockRefresh,
    loadMore: jest.fn(),
    updateUsage: jest.fn(),
  }),
}));
jest.mock('@/components/ui/use-toast', () => ({ toast: (...a: unknown[]) => mockToast(...a) }));
jest.mock('@/components/providers', () => ({ useAuth: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/components/layout/WallpaperBackground', () => ({ useAutoOrientationSetting: () => ({ enabled: false }) }));
jest.mock('@/lib/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
jest.mock('@/lib/hooks/useConfirmDialog', () => ({ useConfirmDialog: () => ({ confirm: jest.fn(), dialogProps: {} }) }));
jest.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: () => null }));
jest.mock('@/components/layout', () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SubpageHeader: () => null,
  FilterBar: () => null,
  FilterDropdown: () => null,
}));
jest.mock('@/components/photos/PhotoUpload', () => ({ PhotoUpload: () => null }));
jest.mock('@/components/photos/SlideshowCore', () => ({ SlideshowCore: () => null }));
jest.mock('@/components/photos/PhotoGallery', () => ({
  PhotoGallery: ({ onPhotoClick }: { onPhotoClick: (i: number) => void }) => (
    <button onClick={() => onPhotoClick(0)}>open photo</button>
  ),
}));
jest.mock('@/components/photos/PhotoLightbox', () => ({
  PhotoLightbox: ({ onDelete }: { onDelete: (id: string) => void }) => (
    <button onClick={() => onDelete('p1')}>delete photo</button>
  ),
}));

import { PhotosView } from '../PhotosView';

const respond = (ok: boolean) => {
  global.fetch = jest.fn(() => Promise.resolve({ ok, status: ok ? 200 : 500 } as Response)) as unknown as typeof fetch;
};

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  delete (global as { fetch?: unknown }).fetch;
});

async function deleteThePhoto() {
  render(<PhotosView />);
  fireEvent.click(screen.getByText('open photo'));
  fireEvent.click(screen.getByText('delete photo'));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/photos/p1', { method: 'DELETE' }));
}

describe('PhotosView delete', () => {
  it('a failed delete shows an error and leaves the list as it was', async () => {
    respond(false);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await deleteThePhoto();
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })),
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('a delete that worked refreshes the list without an error', async () => {
    respond(true);
    await deleteThePhoto();
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(mockToast).not.toHaveBeenCalled();
  });
});
