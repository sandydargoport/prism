/**
 * The display registry (#690): naming, renaming and removing a screen is for
 * parents only, a screen's identity comes from a signed cookie that cannot be
 * forged to claim another screen, and a removed screen goes back to being an
 * unnamed browser.
 */
const mockRequireAuth = jest.fn();
const mockGetDisplayAuth = jest.fn();
const mockLogActivity = jest.fn();

// The rows a select...where returns, in call order.
const mockSelectWhere = jest.fn();
const mockSelectAll = jest.fn();
const mockInsertValues = jest.fn();
const mockUpdateSet = jest.fn();
const mockUpdateReturning = jest.fn();
const mockDeleteReturning = jest.fn();
const mockApply = jest.fn();

// One cookie jar per test, standing in for the browser.
let mockJar: Map<string, string>;
const mockCookieSets: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (mockJar.has(name) ? { name, value: mockJar.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      mockCookieSets.push({ name, value, options });
      if (options.maxAge === 0) mockJar.delete(name);
      else mockJar.set(name, value);
    },
  }),
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
  getDisplayAuth: () => mockGetDisplayAuth(),
  requireRole: (auth: { role: string }) => {
    const { NextResponse } = jest.requireActual('next/server');
    return auth.role === 'parent' ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  },
}));

jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(mockSelectWhere()),
        orderBy: () => Promise.resolve(mockSelectAll()),
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        mockInsertValues(v);
        return { returning: () => Promise.resolve([{ id: NEW_ID, name: v.name }]) };
      },
    }),
    update: () => ({
      set: (v: unknown) => {
        mockUpdateSet(v);
        return {
          where: () => {
            const p = Promise.resolve(undefined);
            return Object.assign(p, { returning: () => Promise.resolve(mockUpdateReturning()) });
          },
        };
      },
    }),
    delete: () => ({
      where: () => ({ returning: () => Promise.resolve(mockDeleteReturning()) }),
    }),
  },
}));
jest.mock('@/lib/db/schema', () => ({
  displays: { id: 'id', name: 'name', lastSeenAt: 'last_seen_at' },
  layouts: { id: 'id' },
}));
jest.mock('@/lib/displays/displaySettingsStore', () => ({
  applySettingChanges: (...a: unknown[]) => mockApply(...a),
}));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: (...a: unknown[]) => mockLogActivity(...a) }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

const NEW_ID = '11111111-1111-4111-8111-111111111111';
const KITCHEN = '22222222-2222-4222-8222-222222222222';
const HALL = '33333333-3333-4333-8333-333333333333';

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { PATCH, DELETE } from '../[id]/route';
import { POST as HEARTBEAT } from '../heartbeat/route';
import { DISPLAY_COOKIE, DISPLAY_MARKER_COOKIE, issueDisplayToken } from '@/lib/auth/displayIdentity';

const PARENT = { userId: 'p1', role: 'parent' };
const CHILD = { userId: 'c1', role: 'child' };

const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const ORIGINAL_SECRET = process.env.SESSION_SECRET;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SESSION_SECRET = 'test_secret_for_display_tokens';
  mockJar = new Map();
  mockCookieSets.length = 0;
  mockRequireAuth.mockResolvedValue(PARENT);
  mockGetDisplayAuth.mockResolvedValue({ userId: 'd', role: 'guest' });
  mockSelectWhere.mockReturnValue([]);
  mockSelectAll.mockReturnValue([]);
});

afterAll(() => {
  process.env.SESSION_SECRET = ORIGINAL_SECRET;
});

describe('POST /api/displays (name this screen)', () => {
  it('creates a row and gives this browser a signed cookie for it', async () => {
    const res = await POST(json('/api/displays', 'POST', { name: '  Kitchen   wall ' }));
    expect(res.status).toBe(201);
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kitchen wall' }));
    expect(mockJar.get(DISPLAY_COOKIE)).toBe(issueDisplayToken(NEW_ID));
    const set = mockCookieSets.find((c) => c.name === DISPLAY_COOKIE)!;
    expect(set.options.httpOnly).toBe(true);
    expect(mockJar.get(DISPLAY_MARKER_COOKIE)).toBe('1');
  });

  it('renames this screen instead of adding a second row when it is already named', async () => {
    mockJar.set(DISPLAY_COOKIE, issueDisplayToken(KITCHEN));
    mockSelectWhere.mockReturnValue([{ id: KITCHEN, name: 'Kitchen' }]);
    mockUpdateReturning.mockReturnValue([{ id: KITCHEN, name: 'Big kitchen' }]);
    const res = await POST(json('/api/displays', 'POST', { name: 'Big kitchen' }));
    expect(res.status).toBe(200);
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'Big kitchen' }));
  });

  it('refuses a child, and a caller who is not signed in', async () => {
    mockRequireAuth.mockResolvedValue(CHILD);
    expect((await POST(json('/api/displays', 'POST', { name: 'Kitchen' }))).status).toBe(403);
    const { NextResponse } = jest.requireActual('next/server');
    mockRequireAuth.mockResolvedValue(NextResponse.json({}, { status: 401 }));
    expect((await POST(json('/api/displays', 'POST', { name: 'Kitchen' }))).status).toBe(401);
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockJar.has(DISPLAY_COOKIE)).toBe(false);
  });

  it.each([
    ['empty', { name: '   ' }],
    ['not text', { name: 7 }],
    ['too long', { name: 'x'.repeat(61) }],
  ])('rejects a name that is %s', async (_label, body) => {
    expect((await POST(json('/api/displays', 'POST', body))).status).toBe(400);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});

describe('POST /api/displays with an id (this is an existing screen)', () => {
  it('points this browser at that screen', async () => {
    mockSelectWhere.mockReturnValue([{ id: HALL, name: 'Hall' }]);
    const res = await POST(json('/api/displays', 'POST', { id: HALL }));
    expect(res.status).toBe(200);
    expect(mockJar.get(DISPLAY_COOKIE)).toBe(issueDisplayToken(HALL));
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('answers 404 for a screen that does not exist, and is parent only', async () => {
    expect((await POST(json('/api/displays', 'POST', { id: HALL }))).status).toBe(404);
    expect((await POST(json('/api/displays', 'POST', { id: 'nope' }))).status).toBe(404);
    mockRequireAuth.mockResolvedValue(CHILD);
    mockSelectWhere.mockReturnValue([{ id: HALL, name: 'Hall' }]);
    expect((await POST(json('/api/displays', 'POST', { id: HALL }))).status).toBe(403);
    expect(mockJar.has(DISPLAY_COOKIE)).toBe(false);
  });
});

describe('GET /api/displays', () => {
  it('lists screens with online status and says which one this browser is', async () => {
    const now = Date.now();
    mockSelectAll.mockReturnValue([
      { id: HALL, name: 'Hall', lastSeenAt: new Date(now - 2 * 60 * 1000) },
      { id: KITCHEN, name: 'Kitchen', lastSeenAt: new Date(now - 60 * 60 * 1000) },
      { id: NEW_ID, name: 'Spare', lastSeenAt: null },
    ]);
    mockJar.set(DISPLAY_COOKIE, issueDisplayToken(KITCHEN));
    mockSelectWhere.mockReturnValue([{ id: KITCHEN, name: 'Kitchen' }]);
    const body = await (await GET()).json();
    expect(body.currentId).toBe(KITCHEN);
    expect(body.displays.map((d: { online: boolean }) => d.online)).toEqual([true, false, false]);
  });

  it('a forged cookie claiming another screen is not that screen', async () => {
    // Kitchen's id, carrying the signature issued for Hall.
    const hallMac = issueDisplayToken(HALL).split('.')[2];
    mockJar.set(DISPLAY_COOKIE, `d1.${KITCHEN}.${hallMac}`);
    mockSelectWhere.mockReturnValue([{ id: KITCHEN, name: 'Kitchen' }]);
    const body = await (await GET()).json();
    expect(body.currentId).toBeNull();
  });

  it('answers 401 when the caller gets no display identity', async () => {
    mockGetDisplayAuth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });
});

describe('PATCH and DELETE /api/displays/:id', () => {
  it('renames a screen from another device', async () => {
    mockUpdateReturning.mockReturnValue([{ id: HALL, name: 'Upstairs hall' }]);
    const res = await PATCH(json(`/api/displays/${HALL}`, 'PATCH', { name: 'Upstairs hall' }), params(HALL));
    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'Upstairs hall' }));
  });

  it('changes another screen\'s settings from this device', async () => {
    mockUpdateReturning.mockReturnValue([{ id: HALL, name: 'Hall', dashboardId: null, settings: {} }]);
    mockApply.mockResolvedValue({ settings: { 'prism-perf-mode': 'true' }, settingsUpdatedAt: new Date() });
    const res = await PATCH(
      json(`/api/displays/${HALL}`, 'PATCH', { settings: { 'prism-perf-mode': 'true' } }),
      params(HALL),
    );
    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith(HALL, { 'prism-perf-mode': 'true' });
    expect((await res.json()).display.settings).toEqual({ 'prism-perf-mode': 'true' });
  });

  it('refuses settings that are not screen settings', async () => {
    const res = await PATCH(json(`/api/displays/${HALL}`, 'PATCH', { settings: { 'prism-theme': 'dark' } }), params(HALL));
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('sets the screen\'s dashboard and moves its settings timestamp so it notices', async () => {
    const DASH = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    mockSelectWhere.mockReturnValue([{ id: DASH }]);
    mockUpdateReturning.mockReturnValue([{ id: HALL, name: 'Hall', dashboardId: DASH, settings: {} }]);
    const res = await PATCH(json(`/api/displays/${HALL}`, 'PATCH', { dashboardId: DASH }), params(HALL));
    expect(res.status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      dashboardId: DASH,
      settingsUpdatedAt: expect.any(Date),
    }));
  });

  it('refuses a dashboard that does not exist, and an empty change', async () => {
    mockSelectWhere.mockReturnValue([]);
    const DASH = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect((await PATCH(json(`/api/displays/${HALL}`, 'PATCH', { dashboardId: DASH }), params(HALL))).status).toBe(400);
    expect((await PATCH(json(`/api/displays/${HALL}`, 'PATCH', { dashboardId: 'x' }), params(HALL))).status).toBe(400);
    expect((await PATCH(json(`/api/displays/${HALL}`, 'PATCH', {}), params(HALL))).status).toBe(400);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('answers 404 for a screen that does not exist, and for an id that is not one', async () => {
    mockUpdateReturning.mockReturnValue([]);
    expect((await PATCH(json(`/api/displays/${HALL}`, 'PATCH', { name: 'X' }), params(HALL))).status).toBe(404);
    expect((await DELETE(json('/api/displays/nope', 'DELETE'), params('nope'))).status).toBe(404);
  });

  it('is parent only', async () => {
    mockRequireAuth.mockResolvedValue(CHILD);
    expect((await PATCH(json(`/api/displays/${HALL}`, 'PATCH', { name: 'X' }), params(HALL))).status).toBe(403);
    expect((await DELETE(json(`/api/displays/${HALL}`, 'DELETE'), params(HALL))).status).toBe(403);
    expect(mockUpdateSet).not.toHaveBeenCalled();
    expect(mockDeleteReturning).not.toHaveBeenCalled();
  });

  it('removing this screen clears its cookie; removing another leaves it alone', async () => {
    mockJar.set(DISPLAY_COOKIE, issueDisplayToken(KITCHEN));
    mockJar.set(DISPLAY_MARKER_COOKIE, '1');
    mockDeleteReturning.mockReturnValue([{ id: HALL, name: 'Hall' }]);
    await DELETE(json(`/api/displays/${HALL}`, 'DELETE'), params(HALL));
    expect(mockJar.has(DISPLAY_COOKIE)).toBe(true);

    mockDeleteReturning.mockReturnValue([{ id: KITCHEN, name: 'Kitchen' }]);
    const res = await DELETE(json(`/api/displays/${KITCHEN}`, 'DELETE'), params(KITCHEN));
    expect(res.status).toBe(200);
    expect(mockJar.has(DISPLAY_COOKIE)).toBe(false);
    expect(mockJar.has(DISPLAY_MARKER_COOKIE)).toBe(false);
  });
});

describe('POST /api/displays/heartbeat', () => {
  it('does nothing for an unnamed browser', async () => {
    const body = await (await HEARTBEAT(json('/api/displays/heartbeat', 'POST'))).json();
    expect(body.display).toBeNull();
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('touches last seen for a named screen', async () => {
    mockJar.set(DISPLAY_COOKIE, issueDisplayToken(KITCHEN));
    const edited = new Date('2026-10-27T18:00:00Z');
    mockSelectWhere.mockReturnValue([{ id: KITCHEN, name: 'Kitchen', settingsUpdatedAt: edited }]);
    const body = await (await HEARTBEAT(json('/api/displays/heartbeat', 'POST'))).json();
    // The screen compares this with its last sync to notice a remote edit.
    expect(body.display).toEqual({ id: KITCHEN, name: 'Kitchen', settingsUpdatedAt: edited.toISOString() });
    expect(mockUpdateSet).toHaveBeenCalledWith({ lastSeenAt: expect.any(Date) });
  });

  it('ignores a forged cookie', async () => {
    mockJar.set(DISPLAY_COOKIE, `d1.${KITCHEN}.${'0'.repeat(64)}`);
    const body = await (await HEARTBEAT(json('/api/displays/heartbeat', 'POST'))).json();
    expect(body.display).toBeNull();
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('a screen removed elsewhere is told so and forgets its name', async () => {
    mockJar.set(DISPLAY_COOKIE, issueDisplayToken(KITCHEN));
    mockJar.set(DISPLAY_MARKER_COOKIE, '1');
    mockSelectWhere.mockReturnValue([]);
    const body = await (await HEARTBEAT(json('/api/displays/heartbeat', 'POST'))).json();
    expect(body.display).toBeNull();
    expect(mockJar.has(DISPLAY_COOKIE)).toBe(false);
    expect(mockJar.has(DISPLAY_MARKER_COOKIE)).toBe(false);
  });
});
