/**
 * @jest-environment node
 */
/**
 * The household's Away timer on /api/away-mode (#1159): read by every screen
 * with the state, set by a parent, and carried over from a screen only while
 * nobody has chosen.
 */
import { NextRequest, NextResponse } from 'next/server';

let person: unknown = null;
let display: unknown = { userId: 'display-1', role: 'guest' };
const rows = new Map<string, unknown>();
let currentKey = '';

jest.mock('@/lib/auth', () => ({
  requireAuth: async () => person ?? NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
  requireRole: (auth: { role: string }) => (auth.role === 'parent' ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 })),
  getDisplayAuth: async () => display,
}));
jest.mock('drizzle-orm', () => ({ eq: (_col: unknown, key: string) => { currentKey = key; return key; } }));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: async (key: string) => (rows.has(key) ? [{ key, value: rows.get(key) }] : []) }) }),
    insert: () => ({ values: async (v: { key: string; value: unknown }) => { rows.set(v.key, v.value); } }),
    update: () => ({ set: (v: { value: unknown }) => ({ where: async () => { rows.set(currentKey, v.value); } }) }),
  },
}));
jest.mock('@/lib/db/schema', () => ({ settings: { key: 'key' } }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: async () => null }));

import { GET, PATCH } from '../route';

const KEY = 'awayModeAutoAfterHours';
const sameOrigin = { origin: 'http://prism.test', host: 'prism.test' };
const patch = (body: unknown, headers: Record<string, string> = {}) => PATCH(new NextRequest('http://prism.test/api/away-mode', {
  method: 'PATCH',
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', ...headers },
}));

beforeEach(() => {
  rows.clear();
  person = null;
  display = { userId: 'display-1', role: 'guest' };
});

describe('GET /api/away-mode', () => {
  it('answers with the household hours, or null when nobody chose', async () => {
    expect((await (await GET()).json()).autoAfterHours).toBeNull();
    rows.set(KEY, 24);
    rows.set('awayMode', { enabled: false, enabledAt: null, enabledBy: null });
    const body = await (await GET()).json();
    expect(body).toMatchObject({ enabled: false, autoAfterHours: 24 });
  });
});

describe('PATCH /api/away-mode', () => {
  it('lets a parent set it, and every screen then reads it', async () => {
    person = { userId: 'p1', role: 'parent' };
    const res = await patch({ autoAfterHours: 48 });
    expect(res.status).toBe(200);
    expect(rows.get(KEY)).toBe(48);
    expect((await (await GET()).json()).autoAfterHours).toBe(48);
  });

  it('refuses anyone who is not a parent', async () => {
    expect((await patch({ autoAfterHours: 48 })).status).toBe(401);
    person = { userId: 'c1', role: 'child' };
    expect((await patch({ autoAfterHours: 48 })).status).toBe(403);
    expect(rows.has(KEY)).toBe(false);
  });

  it('refuses a value that is not one of the choices', async () => {
    person = { userId: 'p1', role: 'parent' };
    expect((await patch({ autoAfterHours: 5 })).status).toBe(400);
    expect((await patch({ autoAfterHours: '24' })).status).toBe(400);
  });

  it('keeps a screen\'s old value as the household\'s while nobody has chosen', async () => {
    const res = await patch({ autoAfterHours: 24, carryOver: true }, sameOrigin);
    expect(await res.json()).toEqual({ autoAfterHours: 24 });
    expect(rows.get(KEY)).toBe(24);
  });

  it('never lets a carried-over value change a choice already made', async () => {
    rows.set(KEY, 0);
    const res = await patch({ autoAfterHours: 168, carryOver: true }, sameOrigin);
    expect(await res.json()).toEqual({ autoAfterHours: 0 });
    expect(rows.get(KEY)).toBe(0);
  });

  it('takes a carry-over only from this install\'s own screen', async () => {
    expect((await patch({ autoAfterHours: 24, carryOver: true })).status).toBe(403);
    expect((await patch({ autoAfterHours: 24, carryOver: true }, { origin: 'http://elsewhere.test', host: 'prism.test' })).status).toBe(403);
    display = null;
    expect((await patch({ autoAfterHours: 24, carryOver: true }, sameOrigin)).status).toBe(401);
    expect(rows.has(KEY)).toBe(false);
  });
});
