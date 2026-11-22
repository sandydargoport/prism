/**
 * "Sync now" on a photo source shows new and removed photos at once (#1226):
 * the photo list is cached, so a sync drops it, also when the sync failed part
 * way through.
 */
const mockInvalidate = jest.fn((_entity: unknown) => Promise.resolve());
const mockSyncImmich = jest.fn();

jest.mock('@/lib/auth', () => ({ requireAuth: () => Promise.resolve({ userId: 'u1', role: 'parent' }) }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: (e: unknown) => mockInvalidate(e) }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/services/photo-sync', () => ({
  syncImmichSource: () => mockSyncImmich(),
  syncOneDriveSource: jest.fn(),
}));
jest.mock('@/lib/db/schema', () => ({ photoSources: { id: 'id' } }));
jest.mock('drizzle-orm', () => ({ eq: () => ({}) }));
jest.mock('@/lib/db/client', () => ({
  db: { query: { photoSources: { findFirst: () => Promise.resolve({ id: 's1', type: 'immich' }) } } },
}));

import { NextRequest } from 'next/server';
import { POST } from '../route';

const params = { params: Promise.resolve({ id: 's1' }) };
const req = () => new NextRequest('http://localhost/api/photo-sources/s1/sync', { method: 'POST' });

beforeEach(() => jest.clearAllMocks());

describe('POST /api/photo-sources/[id]/sync drops the cached photo list', () => {
  it('after a sync', async () => {
    mockSyncImmich.mockResolvedValue(undefined);
    const res = await POST(req(), params);
    expect(res.status).toBe(200);
    expect(mockInvalidate).toHaveBeenCalledWith('photos');
  });

  it('after a sync that failed part way', async () => {
    mockSyncImmich.mockRejectedValue(new Error('Server went away'));
    const res = await POST(req(), params);
    expect(res.status).toBe(500);
    expect(mockInvalidate).toHaveBeenCalledWith('photos');
  });
});
