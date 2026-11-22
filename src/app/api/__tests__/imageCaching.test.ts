/**
 * @jest-environment node
 *
 * Household images are cached by the browser only (#1224). Photo files,
 * recipe images and avatars go out as `Cache-Control: private`, so a shared
 * cache in front of the install (a tunnel, a CDN) does not keep them.
 */
import { NextRequest } from 'next/server';

const mockPhoto = jest.fn();
const mockSource = jest.fn();
const mockReadCache = jest.fn();

const mockReadFile = jest.fn(async () => Buffer.from('img'));
jest.mock('fs', () => ({ promises: { readFile: () => mockReadFile() } }));
/** Who the caller is: a session, the display's identity, or (null) nobody. */
const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  getDisplayAuth: () => mockAuth(),
  requireAuth: jest.fn(),
  requireRole: jest.fn(),
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    query: {
      photos: { findFirst: () => mockPhoto() },
      photoSources: { findFirst: () => mockSource() },
    },
  },
}));
jest.mock('@/lib/db/schema', () => ({ photos: {}, photoSources: {}, recipes: {}, users: {} }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }));
jest.mock('@/lib/services/photo-storage', () => ({ getPhotoPath: (f: string) => `/photos/${f}` }));
jest.mock('@/lib/services/photo-cache', () => ({
  readPhotoCache: (...a: unknown[]) => mockReadCache(...a),
  writePhotoCache: jest.fn(),
}));
jest.mock('@/lib/services/recipe-image-storage', () => ({
  getRecipeImagePath: (id: string) => `/recipes/${id}.jpg`,
  saveRecipeImage: jest.fn(),
  deleteRecipeImage: jest.fn(),
}));
jest.mock('@/lib/services/avatar-storage', () => ({
  getAvatarPath: (id: string) => `/avatars/${id}.jpg`,
  saveAvatar: jest.fn(),
  deleteAvatar: jest.fn(),
}));
jest.mock('@/lib/utils/crypto', () => ({ decrypt: (v: string) => v, encrypt: (v: string) => v }));
jest.mock('@/lib/integrations/onedrive', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('@/lib/integrations/immich', () => ({ downloadImmichAsset: jest.fn() }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET as getPhoto } from '../photos/[id]/file/route';
import { GET as getRecipeImage } from '../recipes/[id]/image/route';
import { GET as getAvatar } from '../family/[id]/avatar/route';

const params = { params: Promise.resolve({ id: 'x1' }) };
const req = (path: string) => new NextRequest(`http://localhost${path}`);

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'display', role: 'guest' });
});

describe('image responses are private to the browser (#1224)', () => {
  it('a local photo file', async () => {
    mockPhoto.mockResolvedValue({ id: 'x1', filename: 'a.jpg', mimeType: 'image/jpeg', isExternal: false });
    const res = await getPhoto(req('/api/photos/x1/file'), params);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=86400, immutable');
  });

  it('an Immich photo from the local cache', async () => {
    mockPhoto.mockResolvedValue({ id: 'x1', isExternal: true, externalId: 'e1', sourceId: 's1', mimeType: 'image/jpeg' });
    mockSource.mockResolvedValue({ id: 's1', type: 'immich' });
    mockReadCache.mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/jpeg' });
    const res = await getPhoto(req('/api/photos/x1/file?thumb=1'), params);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600');
  });

  it('a recipe image', async () => {
    const res = await getRecipeImage(req('/api/recipes/x1/image'), params);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600, must-revalidate');
  });

  it('an avatar', async () => {
    const res = await getAvatar(req('/api/family/x1/avatar'), params);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600, must-revalidate');
  });
});

// #1244: an image needs what the page that shows it needs.
describe('who may fetch an image', () => {
  beforeEach(() => mockAuth.mockResolvedValue(null));

  it('a recipe image needs a session or the display, as the Recipes page does', async () => {
    const res = await getRecipeImage(req('/api/recipes/x1/image'), params);
    expect(res.status).toBe(401);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('a photo file needs the same', async () => {
    expect((await getPhoto(req('/api/photos/x1/file'), params)).status).toBe(401);
  });

  it('an avatar answers anyone, as the sign-in page shows it before anyone signs in', async () => {
    const res = await getAvatar(req('/api/family/x1/avatar'), params);
    expect(res.status).toBe(200);
  });
});
