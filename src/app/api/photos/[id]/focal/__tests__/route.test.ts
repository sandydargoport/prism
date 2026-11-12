/**
 * PUT /api/photos/[id]/focal (#956): a narrow write a signed-out wall may make.
 */
const mockDisplayAuth = jest.fn();
const mockReturning = jest.fn();
const mockSelectWhere = jest.fn();
const mockSet = jest.fn();

jest.mock('@/lib/auth', () => ({ getDisplayAuth: () => mockDisplayAuth() }));
jest.mock('@/lib/auth/everydayAuth', () => ({ screenKey: async () => 'screen-1' }));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/db/client', () => ({
  db: {
    update: () => ({ set: (v: unknown) => { mockSet(v); return { where: () => ({ returning: () => mockReturning() }) }; } }),
    select: () => ({ from: () => ({ where: () => mockSelectWhere() }) }),
  },
}));

import { NextRequest } from 'next/server';
import { PUT } from '../route';

const put = (body: unknown) => PUT(
  new NextRequest('http://localhost/api/photos/p1/focal', { method: 'PUT', body: JSON.stringify(body) }),
  { params: Promise.resolve({ id: 'p1' }) },
);

beforeEach(() => {
  jest.clearAllMocks();
  mockDisplayAuth.mockResolvedValue({ userId: 'display', role: 'guest' });
});

describe('PUT /api/photos/[id]/focal', () => {
  it('refuses a caller that is not this install\'s screen or a person', async () => {
    mockDisplayAuth.mockResolvedValue(null);
    expect((await put({ x: 0.5, y: 0.5 })).status).toBe(401);
  });

  it('accepts only two numbers from 0 to 1', async () => {
    for (const body of [{ x: 1.2, y: 0.5 }, { x: '0.5', y: 0.5 }, { x: 0.5 }, null]) {
      expect((await put(body)).status).toBe(400);
    }
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('stores the point on a photo that has none', async () => {
    mockReturning.mockResolvedValue([{ id: 'p1' }]);
    const res = await put({ x: 0.25, y: 0.75 });
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith({ focalX: 0.25, focalY: 0.75 });
    expect(await res.json()).toEqual({ id: 'p1', focalX: 0.25, focalY: 0.75 });
  });

  it('never replaces a point already found, and says when the photo is missing', async () => {
    mockReturning.mockResolvedValue([]);
    mockSelectWhere.mockResolvedValue([{ id: 'p1' }]);
    expect((await put({ x: 0.1, y: 0.1 })).status).toBe(409);
    mockSelectWhere.mockResolvedValue([]);
    expect((await put({ x: 0.1, y: 0.1 })).status).toBe(404);
  });
});
