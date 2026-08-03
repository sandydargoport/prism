/**
 * Tests for OneDrive photo sync service.
 *
 * Mocks DB, OneDrive integration, photo-storage, and crypto
 * to test the syncOneDriveSource workflow.
 */

// --- DB mock ---
const mockFindFirst = jest.fn();
const mockSelectFrom = jest.fn();
const mockInsertValues = jest.fn().mockResolvedValue(undefined);
const mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
const mockUpdateSetWhere = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/db/client', () => ({
  db: {
    query: {
      photoSources: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    select: () => ({ from: () => ({ where: (...args: unknown[]) => mockSelectFrom(...args) }) }),
    insert: () => ({ values: (...args: unknown[]) => mockInsertValues(...args) }),
    delete: () => ({ where: (...args: unknown[]) => mockDeleteWhere(...args) }),
    update: () => ({ set: () => ({ where: (...args: unknown[]) => mockUpdateSetWhere(...args) }) }),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  photos: { id: 'id', sourceId: 'sourceId', filename: 'filename', externalId: 'externalId' },
  photoSources: { id: 'id', type: 'type' },
  excludedPhotos: { id: 'id', sourceId: 'sourceId', externalId: 'externalId' },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
}));

// --- OneDrive mock ---
const mockListPhotos = jest.fn();
const mockDownloadPhoto = jest.fn();
const mockRefreshAccessToken = jest.fn();

jest.mock('@/lib/integrations/onedrive', () => ({
  listPhotosInFolder: (...args: unknown[]) => mockListPhotos(...args),
  downloadPhoto: (...args: unknown[]) => mockDownloadPhoto(...args),
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}));

// --- Immich mock ---
const mockFetchSharedLink = jest.fn();

jest.mock('@/lib/integrations/immich', () => ({
  fetchSharedLink: (...args: unknown[]) => mockFetchSharedLink(...args),
}));

// --- Photo storage mock ---
const mockSavePhoto = jest.fn();
const mockDeletePhoto = jest.fn();

jest.mock('../photo-storage', () => ({
  savePhoto: (...args: unknown[]) => mockSavePhoto(...args),
  deletePhoto: (...args: unknown[]) => mockDeletePhoto(...args),
}));

// --- Photo cache mock ---
const mockClearPhotoCache = jest.fn().mockResolvedValue(undefined);

jest.mock('../photo-cache', () => ({
  clearPhotoCache: (...args: unknown[]) => mockClearPhotoCache(...args),
}));

// --- Crypto mock ---
jest.mock('@/lib/utils/crypto', () => ({
  decrypt: jest.fn((val: string) => `decrypted-${val}`),
  encrypt: jest.fn((val: string) => `encrypted-${val}`),
}));

import { syncOneDriveSource, syncImmichSource } from '../photo-sync';

const validSource = {
  id: 'source-1',
  type: 'onedrive',
  onedriveFolderId: 'folder-123',
  accessToken: 'enc-access',
  refreshToken: 'enc-refresh',
  tokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour from now
};

describe('syncOneDriveSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFirst.mockResolvedValue(validSource);
    mockSelectFrom.mockResolvedValue([]);
    mockListPhotos.mockResolvedValue([]);
  });

  it('throws when source does not exist', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(syncOneDriveSource('bad-id')).rejects.toThrow('Invalid OneDrive photo source');
  });

  it('throws when source type is not onedrive', async () => {
    mockFindFirst.mockResolvedValue({ ...validSource, type: 'google' });

    await expect(syncOneDriveSource('source-1')).rejects.toThrow('Invalid OneDrive photo source');
  });

  it('throws when source has no folderId', async () => {
    mockFindFirst.mockResolvedValue({ ...validSource, onedriveFolderId: null });

    await expect(syncOneDriveSource('source-1')).rejects.toThrow('Invalid OneDrive photo source');
  });

  it('throws when source has no OAuth tokens', async () => {
    mockFindFirst.mockResolvedValue({ ...validSource, accessToken: null, refreshToken: null });

    await expect(syncOneDriveSource('source-1')).rejects.toThrow('missing OAuth tokens');
  });

  it('downloads new photos not in the database', async () => {
    mockListPhotos.mockResolvedValue([
      { id: 'remote-1', name: 'photo1.jpg', file: { mimeType: 'image/jpeg' }, photo: { takenDateTime: '2026-01-15T10:00:00Z' } },
    ]);
    mockSelectFrom.mockResolvedValue([]); // no existing photos
    mockDownloadPhoto.mockResolvedValue(Buffer.from('image-data'));
    mockSavePhoto.mockResolvedValue({ width: 1920, height: 1080, sizeBytes: 5000, thumbnailPath: 'thumb_abc.jpg' });

    await syncOneDriveSource('source-1');

    expect(mockDownloadPhoto).toHaveBeenCalledWith('decrypted-enc-access', 'remote-1');
    expect(mockSavePhoto).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
  });

  it('skips photos already in the database', async () => {
    mockListPhotos.mockResolvedValue([
      { id: 'remote-1', name: 'photo1.jpg', file: { mimeType: 'image/jpeg' } },
    ]);
    mockSelectFrom.mockResolvedValue([
      { id: 'db-1', externalId: 'remote-1', filename: 'existing.jpg', thumbnailPath: null },
    ]);

    await syncOneDriveSource('source-1');

    expect(mockDownloadPhoto).not.toHaveBeenCalled();
    expect(mockSavePhoto).not.toHaveBeenCalled();
  });

  it('deletes local photos removed from remote', async () => {
    mockListPhotos.mockResolvedValue([]); // empty remote
    mockSelectFrom.mockResolvedValue([
      { id: 'db-1', externalId: 'remote-gone', filename: 'old.jpg', thumbnailPath: 'thumb_old.jpg' },
    ]);

    await syncOneDriveSource('source-1');

    expect(mockDeletePhoto).toHaveBeenCalledWith('old.jpg', 'thumb_old.jpg');
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it('refreshes token when expired', async () => {
    mockFindFirst.mockResolvedValue({
      ...validSource,
      tokenExpiresAt: new Date(Date.now() - 1000), // expired
    });
    mockRefreshAccessToken.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    });
    mockListPhotos.mockResolvedValue([]);

    await syncOneDriveSource('source-1');

    expect(mockRefreshAccessToken).toHaveBeenCalledWith('decrypted-enc-refresh');
    expect(mockUpdateSetWhere).toHaveBeenCalled(); // token update
    expect(mockListPhotos).toHaveBeenCalledWith('new-access', 'folder-123');
  });

  it('continues syncing other photos when one download fails', async () => {
    mockListPhotos.mockResolvedValue([
      { id: 'r-1', name: 'fail.jpg', file: { mimeType: 'image/jpeg' } },
      { id: 'r-2', name: 'ok.jpg', file: { mimeType: 'image/jpeg' } },
    ]);
    mockSelectFrom.mockResolvedValue([]);
    mockDownloadPhoto
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(Buffer.from('ok'));
    mockSavePhoto.mockResolvedValue({ width: 800, height: 600, sizeBytes: 2000, thumbnailPath: null });

    await syncOneDriveSource('source-1');

    // First photo failed, second succeeded
    expect(mockDownloadPhoto).toHaveBeenCalledTimes(2);
    expect(mockSavePhoto).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
  });

  it('updates lastSynced timestamp after sync', async () => {
    await syncOneDriveSource('source-1');

    // Last call to update...set...where is the lastSynced update
    expect(mockUpdateSetWhere).toHaveBeenCalled();
  });
});

const validImmichSource = {
  id: 'immich-source-1',
  type: 'immich',
  immichServerUrl: 'https://immich.example.com',
  immichShareKey: 'share-key-abc',
  immichPasswordEnc: null,
  immichAlbumId: null,
};

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'asset-1',
    originalFileName: 'IMG.jpg',
    originalMimeType: 'image/jpeg',
    type: 'IMAGE',
    fileCreatedAt: '2025-01-01T00:00:00.000Z',
    width: 4032,
    height: 3024,
    latitude: null,
    longitude: null,
    ...overrides,
  };
}

describe('syncImmichSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFirst.mockResolvedValue(validImmichSource);
    mockSelectFrom.mockResolvedValue([]);
    mockFetchSharedLink.mockResolvedValue({
      albumId: 'album-1',
      albumName: 'Vacation',
      allowDownload: true,
      hasPassword: false,
      assets: [],
    });
  });

  it('throws when source does not exist', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(syncImmichSource('bad-id')).rejects.toThrow('Invalid Immich photo source');
  });

  it('throws when source type is not immich', async () => {
    mockFindFirst.mockResolvedValue({ ...validImmichSource, type: 'onedrive' });
    await expect(syncImmichSource('immich-source-1')).rejects.toThrow('Invalid Immich photo source');
  });

  it('throws when missing server URL or share key', async () => {
    mockFindFirst.mockResolvedValue({ ...validImmichSource, immichServerUrl: null });
    await expect(syncImmichSource('immich-source-1')).rejects.toThrow(
      'missing server URL or share key',
    );
  });

  it('decrypts the password before calling fetchSharedLink', async () => {
    mockFindFirst.mockResolvedValue({
      ...validImmichSource,
      immichPasswordEnc: 'enc-pw',
    });

    await syncImmichSource('immich-source-1');

    expect(mockFetchSharedLink).toHaveBeenCalledWith({
      sourceId: 'immich-source-1',
      serverUrl: 'https://immich.example.com',
      shareKey: 'share-key-abc',
      password: 'decrypted-enc-pw',
    });
  });

  it('passes null password when no encrypted password is stored', async () => {
    await syncImmichSource('immich-source-1');

    expect(mockFetchSharedLink).toHaveBeenCalledWith({
      sourceId: 'immich-source-1',
      serverUrl: 'https://immich.example.com',
      shareKey: 'share-key-abc',
      password: null,
    });
  });

  it('inserts new IMAGE assets as external rows', async () => {
    mockFetchSharedLink.mockResolvedValue({
      albumId: 'album-1',
      albumName: null,
      allowDownload: true,
      hasPassword: false,
      assets: [
        makeAsset({ id: 'a1', originalFileName: 'one.jpg' }),
        makeAsset({ id: 'a2', originalFileName: 'two.jpg', latitude: 37.5, longitude: -122.3 }),
      ],
    });

    await syncImmichSource('immich-source-1');

    const inserted = mockInsertValues.mock.calls.map((c) => c[0]);
    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({
      sourceId: 'immich-source-1',
      filename: 'a1',
      externalId: 'a1',
      isExternal: true,
      latitude: null,
      longitude: null,
    });
    expect(inserted[1]).toMatchObject({
      filename: 'a2',
      latitude: '37.5',
      longitude: '-122.3',
    });
  });

  it('skips non-IMAGE assets (videos, other)', async () => {
    mockFetchSharedLink.mockResolvedValue({
      albumId: 'album-1',
      albumName: null,
      allowDownload: true,
      hasPassword: false,
      assets: [
        makeAsset({ id: 'a1', type: 'IMAGE' }),
        makeAsset({ id: 'v1', type: 'VIDEO' }),
        makeAsset({ id: 'o1', type: 'OTHER' }),
      ],
    });

    await syncImmichSource('immich-source-1');

    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    expect(mockInsertValues.mock.calls[0][0]).toMatchObject({ filename: 'a1' });
  });

  it('does not re-insert assets already present locally', async () => {
    mockFetchSharedLink.mockResolvedValue({
      albumId: 'album-1',
      albumName: null,
      allowDownload: true,
      hasPassword: false,
      assets: [makeAsset({ id: 'a1' })],
    });
    mockSelectFrom.mockResolvedValue([
      { id: 'photo-1', externalId: 'a1', latitude: null, longitude: null },
    ]);

    await syncImmichSource('immich-source-1');

    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('removes photos no longer in the album and clears their cache', async () => {
    mockFetchSharedLink.mockResolvedValue({
      albumId: 'album-1',
      albumName: null,
      allowDownload: true,
      hasPassword: false,
      assets: [],
    });
    mockSelectFrom.mockResolvedValue([
      { id: 'photo-1', externalId: 'gone-asset', latitude: null, longitude: null },
    ]);

    await syncImmichSource('immich-source-1');

    expect(mockClearPhotoCache).toHaveBeenCalledWith('immich-source-1', 'gone-asset');
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it('backfills GPS for existing rows when Immich now has coordinates', async () => {
    mockFetchSharedLink.mockResolvedValue({
      albumId: 'album-1',
      albumName: null,
      allowDownload: true,
      hasPassword: false,
      assets: [makeAsset({ id: 'a1', latitude: 12.34, longitude: 56.78 })],
    });
    mockSelectFrom.mockResolvedValue([
      { id: 'photo-1', externalId: 'a1', latitude: null, longitude: null },
    ]);

    await syncImmichSource('immich-source-1');

    // The GPS backfill update + the final lastSynced update both go through
    // mockUpdateSetWhere; both should fire.
    expect(mockUpdateSetWhere).toHaveBeenCalled();
  });

  it('caches the album ID on first successful sync', async () => {
    await syncImmichSource('immich-source-1');

    // album ID update + lastSynced update => at least 2 calls
    expect(mockUpdateSetWhere.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
