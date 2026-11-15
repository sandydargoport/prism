/**
 * A deleted photo leaves the list at once, and a favourite stays set (#1226):
 * the photo list is cached, so changing or deleting one photo drops it.
 */
const mockInvalidate = jest.fn();
const mockReturning = jest.fn();
const photo = { id: 'p1', filename: 'p1.jpg', thumbnailPath: 'p1-thumb.jpg', favorite: false };

jest.mock('@/lib/auth', () => ({ requireAuth: () => Promise.resolve({ userId: 'u1', role: 'parent' }) }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: (e: unknown) => mockInvalidate(e) }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/services/photo-storage', () => ({ deletePhoto: jest.fn() }));
jest.mock('@/lib/db/schema', () => ({ photos: { id: 'id' } }));
jest.mock('drizzle-orm', () => ({ eq: () => ({}) }));
jest.mock('@/lib/db/client', () => ({
  db: {
    query: { photos: { findFirst: () => Promise.resolve(photo) } },
    update: () => ({ set: () => ({ where: () => ({ returning: () => mockReturning() }) }) }),
    delete: () => ({ where: () => Promise.resolve() }),
  },
}));

import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '../route';

const params = { params: Promise.resolve({ id: 'p1' }) };
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/photos/p1', { method, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  mockReturning.mockResolvedValue([{ ...photo, favorite: true }]);
});

describe('/api/photos/[id] drops the cached photo list', () => {
  it('after a favourite is set', async () => {
    const res = await PATCH(req('PATCH', { favorite: true }), params);
    expect(res.status).toBe(200);
    expect(mockInvalidate).toHaveBeenCalledWith('photos');
  });

  it('after a delete', async () => {
    const res = await DELETE(req('DELETE'), params);
    expect(res.status).toBe(200);
    expect(mockInvalidate).toHaveBeenCalledWith('photos');
  });

  it('not when the photo does not exist', async () => {
    mockReturning.mockResolvedValue([]);
    expect((await PATCH(req('PATCH', { favorite: true }), params)).status).toBe(404);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
