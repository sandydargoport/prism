/**
 * Timelines on the server (#1266): every device can read them, only a parent
 * changes them. A duplicate starts as a copy of its source and goes last; the
 * household always keeps one; and a screen that picked none, or one since
 * deleted, counts towards the first.
 */
import { NextRequest } from 'next/server';

const mockRequireAuth = jest.fn();
const mockGetDisplayAuth = jest.fn();

// A stand-in for drizzle: every query is a chain that resolves to the next
// queued result, and records what it was asked.
const mockResults: unknown[][] = [];
const mockCalls: Array<[string, ...unknown[]]> = [];
function mockChain(): unknown {
  const fn = () => undefined;
  const proxy: unknown = new Proxy(fn, {
    get(_t, prop) {
      if (prop === 'then') {
        const value = mockResults.shift() ?? [];
        return (resolve: (v: unknown) => void) => resolve(value);
      }
      return (...args: unknown[]) => { mockCalls.push([String(prop), ...args]); return proxy; };
    },
  });
  return proxy;
}

jest.mock('@/lib/db/client', () => ({
  db: {
    select: (...a: unknown[]) => { mockCalls.push(['select', ...a]); return mockChain(); },
    insert: (...a: unknown[]) => { mockCalls.push(['insert', ...a]); return mockChain(); },
    update: (...a: unknown[]) => { mockCalls.push(['update', ...a]); return mockChain(); },
    delete: (...a: unknown[]) => { mockCalls.push(['delete', ...a]); return mockChain(); },
  },
}));
jest.mock('@/lib/db/schema', () => ({
  timelines: { id: 'id', position: 'position', createdAt: 'created_at' },
  displays: { timelineId: 'timeline_id' },
  layouts: { id: 'id' },
}));
jest.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
  getDisplayAuth: () => mockGetDisplayAuth(),
  requireRole: (auth: { role: string }) => {
    const { NextResponse } = jest.requireActual('next/server');
    return auth.role === 'parent' ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  },
}));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));

import { GET, POST } from '../route';
import { DELETE, PATCH } from '../[id]/route';
import { listTimelines } from '@/lib/services/timelines';

const MAIN = '11111111-1111-4111-8111-111111111111';
const QUIET = '22222222-2222-4222-8222-222222222222';
const BUS = '33333333-3333-4333-8333-333333333333';
const row = (id: string, name: string, position: number, extra: Record<string, unknown> = {}) => ({
  id, name, position, dashboardId: null, placements: [], idleBackground: { source: 'dashboard' }, createdAt: new Date(position), ...extra,
});
const morning = { days: [1, 2, 3, 4, 5], from: '07:00', to: '07:45', dashboardId: BUS };

const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/timelines', { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const set = (call: string) => mockCalls.filter((c) => c[0] === call).map((c) => c[1]);

beforeEach(() => {
  mockResults.length = 0;
  mockCalls.length = 0;
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  mockGetDisplayAuth.mockResolvedValue({ userId: 'wall', role: 'guest' });
});

describe('listTimelines', () => {
  it('counts each named screen once: its own timeline, or the first when it has none or it is gone', async () => {
    mockResults.push(
      [row(MAIN, 'Main', 0), row(QUIET, 'Quiet', 1)],
      [{ timelineId: null }, { timelineId: QUIET }, { timelineId: '99999999-9999-4999-8999-999999999999' }],
    );
    const all = await listTimelines();
    expect(all.map((t) => [t.name, t.screens])).toEqual([['Main', 2], ['Quiet', 1]]);
  });

  it('makes the household its first timeline again if every one is gone', async () => {
    mockResults.push([], [], [row(MAIN, 'Main', 0)], []);
    const all = await listTimelines();
    expect(set('values')).toEqual([{ name: 'Main', position: 0 }]);
    expect(all.map((t) => t.name)).toEqual(['Main']);
  });
});

describe('GET /api/timelines', () => {
  it('any device that may read the dashboards reads them', async () => {
    mockGetDisplayAuth.mockResolvedValue({ userId: 'wall', role: 'guest' });
    mockResults.push([row(MAIN, 'Main', 0)], []);
    const body = await (await GET()).json();
    expect(body.timelines.map((t: { id: string }) => t.id)).toEqual([MAIN]);
  });

  it('nothing for a device with no access', async () => {
    mockGetDisplayAuth.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ timelines: [] });
  });
});

describe('changing timelines is for parents', () => {
  beforeEach(() => mockRequireAuth.mockResolvedValue({ userId: 'k1', role: 'child' }));

  it('refuses a child', async () => {
    expect((await POST(req('POST', { name: 'Mine' }))).status).toBe(403);
    expect((await PATCH(req('PATCH', { name: 'Mine' }), params(MAIN))).status).toBe(403);
    expect((await DELETE(req('DELETE'), params(MAIN))).status).toBe(403);
    expect(set('values')).toEqual([]);
    expect(mockCalls.some((c) => c[0] === 'delete' || c[0] === 'update')).toBe(false);
  });
});

describe('POST /api/timelines', () => {
  it('Duplicate copies its source and goes last, with its own placements', async () => {
    const source = row(MAIN, 'Main', 0, {
      dashboardId: BUS,
      placements: [morning],
      idleBackground: { day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } },
    });
    mockResults.push(
      [source, row(QUIET, 'Quiet', 3)], [], // the list, and who follows what
      [{ last: 3 }], // the highest position
      [{ id: 'new', name: 'Main copy' }], // inserted
      [row('new', 'Main copy', 4)], // read back
    );
    const res = await POST(req('POST', { copyOf: MAIN }));
    expect(res.status).toBe(201);
    const [values] = set('values') as Array<Record<string, unknown>>;
    expect(values).toEqual({
      name: 'Main copy', position: 4, dashboardId: BUS, placements: [morning], idleBackground: source.idleBackground,
    });
    // A copy, not the same objects: a later edit to one leaves the other alone.
    expect(values!.placements).not.toBe(source.placements);
    expect((values!.placements as unknown[])[0]).not.toBe(morning);
  });

  it('a new one needs a name, and an unknown source is not found', async () => {
    expect((await POST(req('POST', {}))).status).toBe(400);
    expect((await POST(req('POST', { name: ' ' }))).status).toBe(400);
    mockResults.push([row(MAIN, 'Main', 0)], [], [{ last: 0 }]);
    expect((await POST(req('POST', { copyOf: QUIET }))).status).toBe(404);
  });
});

describe('PATCH /api/timelines/:id', () => {
  it('keeps placements and a night, checked first', async () => {
    mockResults.push([row(MAIN, 'Main', 0, { placements: [morning] })]);
    const res = await PATCH(req('PATCH', { placements: [morning] }), params(MAIN));
    expect(res.status).toBe(200);
    expect(set('set')[0]).toMatchObject({ placements: [morning] });

    expect((await PATCH(req('PATCH', { placements: [{ ...morning, days: [] }] }), params(MAIN))).status).toBe(400);
    expect((await PATCH(req('PATCH', { idleBackground: { source: 'video' } }), params(MAIN))).status).toBe(400);
    expect((await PATCH(req('PATCH', {}), params(MAIN))).status).toBe(400);
  });

  it('refuses a dashboard for the rest of the day that does not exist', async () => {
    mockResults.push([]);
    expect((await PATCH(req('PATCH', { dashboardId: BUS }), params(MAIN))).status).toBe(400);
  });
});

describe('DELETE /api/timelines/:id', () => {
  it('the household keeps its last timeline', async () => {
    mockResults.push([row(MAIN, 'Main', 0)], []);
    expect((await DELETE(req('DELETE'), params(MAIN))).status).toBe(409);
    expect(mockCalls.some((c) => c[0] === 'delete')).toBe(false);
  });

  it('removes another; its screens go to the first by the foreign key', async () => {
    mockResults.push([row(MAIN, 'Main', 0), row(QUIET, 'Quiet', 1)], [{ timelineId: QUIET }], [row(QUIET, 'Quiet', 1)]);
    const res = await DELETE(req('DELETE'), params(QUIET));
    expect(res.status).toBe(200);
    expect(mockCalls.some((c) => c[0] === 'delete')).toBe(true);
  });
});
