/**
 * Whether a recipe source's token can write (#1205). Connecting records it and
 * a token that only reads still connects; the list reports it per source, and
 * a source connected before it was recorded is checked once and the answer
 * kept. A Mealie token always writes: Mealie has no read-only tokens.
 */
const mockRequireAuth = jest.fn();
const mockOrderBy = jest.fn();
const mockInsertValues = jest.fn();
const mockUpdateSet = jest.fn();
const mockTest = jest.fn();
const mockCheck = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: jest.requireActual('@/lib/auth/requireAuth').requireRole,
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ orderBy: (...a: unknown[]) => mockOrderBy(...a) }) }),
    insert: () => ({
      values: (v: unknown) => {
        mockInsertValues(v);
        return { returning: () => Promise.resolve([{ id: 's-new' }]) };
      },
    }),
    update: () => ({
      set: (v: unknown) => {
        mockUpdateSet(v);
        return { where: () => Promise.resolve() };
      },
    }),
  },
}));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/utils/crypto', () => ({
  encrypt: (t: string) => `enc:${t}`,
  decrypt: (t: string) => t.replace(/^enc:/, ''),
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/sync/adapters/registry', () => ({
  isSupportedProvider: (p: string) => p === 'tandoor' || p === 'mealie',
  testProviderConnection: (...a: unknown[]) => mockTest(...a),
  checkProviderWriteAccess: (...a: unknown[]) => mockCheck(...a),
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { checkMealieWriteAccess } from '@/lib/integrations/mealie';

const connect = (body: Record<string, unknown>) => POST(new NextRequest('http://localhost/api/recipe-sources', {
  method: 'POST',
  body: JSON.stringify(body),
}));

const row = (over: Record<string, unknown>) => ({
  id: 's1',
  provider: 'tandoor',
  name: null,
  serverUrl: 'https://tandoor.example.com',
  enabled: true,
  lastSynced: null,
  syncErrors: null,
  accessToken: 'enc:secret-token',
  providerConfig: null,
  createdAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  mockTest.mockResolvedValue(undefined);
});

describe('POST /api/recipe-sources', () => {
  it('connects a token that only reads, and records that it reads only', async () => {
    mockCheck.mockResolvedValue(false);
    const res = await connect({ provider: 'tandoor', serverUrl: 'https://tandoor.example.com', token: 'tok' });
    expect(res.status).toBe(201);
    expect((await res.json()).canWrite).toBe(false);
    expect(mockInsertValues.mock.calls[0][0].providerConfig.canWrite).toBe(false);
  });

  it('records a token that writes', async () => {
    mockCheck.mockResolvedValue(true);
    const res = await connect({ provider: 'tandoor', serverUrl: 'https://tandoor.example.com', token: 'tok' });
    expect((await res.json()).canWrite).toBe(true);
    expect(mockInsertValues.mock.calls[0][0].providerConfig.canWrite).toBe(true);
  });
});

describe('GET /api/recipe-sources', () => {
  it('reports each source from what was recorded, without asking again, and never returns the token', async () => {
    const now = new Date().toISOString();
    mockOrderBy.mockResolvedValue([
      row({ id: 'a', providerConfig: { canWrite: true, writeCheckedAt: now } }),
      row({ id: 'b', providerConfig: { canWrite: false, writeCheckedAt: now } }),
    ]);
    const body = await (await GET()).json();
    expect(body.sources.map((s: { id: string; canWrite: boolean }) => [s.id, s.canWrite]))
      .toEqual([['a', true], ['b', false]]);
    expect(mockCheck).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain('secret-token');
  });

  it('checks a source connected before access was recorded, once, and keeps the answer', async () => {
    mockOrderBy.mockResolvedValue([row({ id: 'old', providerConfig: null })]);
    mockCheck.mockResolvedValue(true);
    const body = await (await GET()).json();
    expect(body.sources[0].canWrite).toBe(true);
    expect(mockCheck).toHaveBeenCalledWith('tandoor', 'https://tandoor.example.com', 'secret-token');
    expect(mockUpdateSet.mock.calls[0][0].providerConfig.canWrite).toBe(true);
  });

  it('asks again about a "reads only" answer more than a day old', async () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    mockOrderBy.mockResolvedValue([row({ providerConfig: { canWrite: false, writeCheckedAt: old } })]);
    mockCheck.mockResolvedValue(true);
    expect((await (await GET()).json()).sources[0].canWrite).toBe(true);
  });
});

describe('checkMealieWriteAccess', () => {
  const answer = (status: number) => jest.fn().mockResolvedValue({
    ok: status === 200,
    status,
    statusText: '',
    headers: new Headers(),
    json: () => Promise.resolve({ id: 'u1' }),
  });

  it('reports a token that authenticates as writing: Mealie has no read-only tokens', async () => {
    global.fetch = answer(200) as unknown as typeof fetch;
    expect(await checkMealieWriteAccess('https://mealie.example.com', 'tok')).toBe(true);
  });

  it('reports false, never throws, for a rejected token', async () => {
    global.fetch = answer(401) as unknown as typeof fetch;
    expect(await checkMealieWriteAccess('https://mealie.example.com', 'tok')).toBe(false);
  });
});
