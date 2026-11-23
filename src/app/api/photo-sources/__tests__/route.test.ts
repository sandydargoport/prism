/**
 * Adding an Immich shared album (POST /api/photo-sources) accepts a server on
 * the home network (#1286): a LAN address, or a name that resolves into
 * 100.64.0.0/10 or IPv6 unique-local space. Loopback is still refused, and the
 * answer names the address and how to allow it. The real Immich client and
 * SSRF guard run; only fetch, DNS and the database are stand-ins. Names,
 * addresses and share keys are made up.
 */
const mockLookup = jest.fn();
const mockInsertValues = jest.fn();

jest.mock('node:dns/promises', () => ({ lookup: (...args: unknown[]) => mockLookup(...args) }));
jest.mock('sharp', () => ({ __esModule: true, default: jest.fn() }));
const mockRole = { current: 'parent' };
jest.mock('@/lib/auth', () => ({
  requireAuth: () => Promise.resolve({ userId: 'u1', role: mockRole.current }),
  requireRole: jest.requireActual('@/lib/auth/requireAuth').requireRole,
}));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: () => Promise.resolve(null) }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: () => Promise.resolve() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/utils/crypto', () => ({ encrypt: (s: string) => `enc:${s}` }));
jest.mock('@/lib/db/schema', () => ({ photoSources: {} }));
jest.mock('drizzle-orm', () => ({ sql: () => ({}) }));
jest.mock('@/lib/db/client', () => ({
  db: {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        mockInsertValues(v);
        return { returning: () => Promise.resolve([{ id: 'src-1', ...v }]) };
      },
    }),
  },
}));

import { NextRequest } from 'next/server';
import { POST } from '../route';

const sharePage = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: () => Promise.resolve({ album: { id: 'album-1', albumName: 'Garden' }, password: null, assets: [] }),
  } as unknown as Response);

const addImmich = (shareUrl: string) =>
  POST(
    new NextRequest('http://localhost/api/photo-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'immich', shareUrl }),
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockRole.current = 'parent';
  // Production is where the guard refuses private addresses and resolves names.
  jest.replaceProperty(process.env, 'NODE_ENV', 'production');
  mockLookup.mockReset();
  mockLookup.mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
  global.fetch = jest.fn(sharePage) as unknown as typeof fetch;
});

describe('POST /api/photo-sources (Immich) on the home network (#1286)', () => {
  it('adds a share whose server has a LAN address', async () => {
    const res = await addImmich('http://192.168.77.10:2283/share/fictional-key-1');
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ type: 'immich', name: 'Garden', immichServerUrl: 'http://192.168.77.10:2283' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://192.168.77.10:2283/api/shared-links/me?key=fictional-key-1',
      expect.anything(),
    );
  });

  it('adds a share whose server name resolves into 100.64.0.0/10 and unique-local IPv6', async () => {
    mockLookup.mockResolvedValue([
      { address: '100.101.102.103', family: 4 },
      { address: 'fd7a:1234:5678::9', family: 6 },
    ]);
    const res = await addImmich('https://photos.vpn.example/share/fictional-key-2');
    expect(res.status).toBe(201);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ immichServerUrl: 'https://photos.vpn.example', immichShareKey: 'fictional-key-2' }),
    );
  });

  it('still refuses a loopback server, and says which address and how to allow it', async () => {
    const res = await addImmich('http://127.0.0.1:2283/share/fictional-key-3');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('unsafe_url');
    expect(body.message).toContain('127.0.0.1');
    expect(body.message).toContain('PRISM_ALLOWED_INTERNAL_HOSTS');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('still refuses a name that resolves to the cloud metadata address', async () => {
    mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    const res = await addImmich('https://photos.vpn.example/share/fictional-key-4');
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('POST /api/photo-sources: who may add a source (#1286)', () => {
  it('refuses a child, before anything is fetched or saved', async () => {
    mockRole.current = 'child';
    const res = await addImmich('http://192.168.77.10:2283/share/fictional-key-1');
    expect(res.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});
