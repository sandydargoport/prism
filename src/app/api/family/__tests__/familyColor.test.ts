/**
 * Member colour validation on POST /api/family and PATCH /api/family/[id].
 *
 * The colour is drawn straight into style attributes across the app, and the
 * member editor now offers a free custom colour (#640), so the server accepts
 * exactly #RRGGBB and refuses everything else with a 400.
 */

import { NextRequest } from 'next/server';

const mockWhere = jest.fn();
const mockSet = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: () => Object.assign(Promise.resolve([]), { where: (...a: unknown[]) => mockWhere(...a) }),
    }),
    update: () => ({
      set: (updates: unknown) => {
        mockSet(updates);
        return {
          where: () => ({
            returning: jest.fn().mockResolvedValue([{
              ...member,
              ...(updates as object),
              createdAt: new Date('2026-01-01T00:00:00Z'),
            }]),
          }),
        };
      },
    }),
    insert: jest.fn(),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  users: { id: 'id', name: 'name', pin: 'pin', pinLength: 'pinLength', color: 'color' },
  calendarGroups: { userId: 'userId', type: 'type' },
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: 'parent-1', role: 'parent' }),
  requireRole: jest.fn().mockReturnValue(null),
  optionalAuth: jest.fn(),
}));

jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/cache/redis', () => ({ getCached: jest.fn() }));
jest.mock('@/lib/db/memberOrder', () => ({ memberOrder: [] }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/setup', () => ({ isSetupComplete: jest.fn().mockResolvedValue(true) }));
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: jest.fn().mockResolvedValue('$2b$hash'), compare: jest.fn().mockResolvedValue(true) },
}));

import { POST } from '../route';
import { PATCH } from '../[id]/route';

const member = { id: 'child-1', name: 'Sam', role: 'child', color: '#3B82F6', email: null, avatarUrl: null, pin: null, pinLength: 4 };

const BAD_COLORS: unknown[] = [
  'red',
  '#fff',
  '#3B82F6 ',
  '#3B82F6;background:url(x)',
  'url(javascript:alert(1))',
  '',
  null,
  42,
  ['#3B82F6'],
];

function patch(body: Record<string, unknown>) {
  const req = new NextRequest('http://localhost:3000/api/family/child-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: 'child-1' }) });
}

function post(body: Record<string, unknown>) {
  const req = new NextRequest('http://localhost:3000/api/family', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return POST(req);
}

describe('PATCH /api/family/[id] color', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWhere.mockResolvedValue([member]);
  });

  it('saves a preset colour', async () => {
    const res = await patch({ color: '#0D9488' });
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ color: '#0D9488' }));
  });

  it('saves a custom colour in either case', async () => {
    const res = await patch({ color: '#12ab9f' });
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ color: '#12ab9f' }));
  });

  it.each(BAD_COLORS)('refuses %p and changes nothing', async (color) => {
    const res = await patch({ color });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/hex color/);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('leaves the colour alone when none is sent', async () => {
    const res = await patch({ role: 'child' });
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith(expect.not.objectContaining({ color: expect.anything() }));
  });
});

describe('POST /api/family color', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([...BAD_COLORS, undefined])('refuses %p', async (color) => {
    const res = await post({ name: 'Robin', role: 'child', color });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/hex color/);
  });
});
