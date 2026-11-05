/**
 * @jest-environment node
 */
/**
 * Everyday jobs without a PIN (#835): who gets through, and when.
 */
import { NextResponse } from 'next/server';

let session: unknown = null;
let security: unknown = undefined;
let display: unknown = { userId: 'display-1', role: 'guest' };
let limited = false;

jest.mock('../requireAuth', () => ({
  requireAuth: async () => session ?? NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
  getDisplayAuth: async () => display,
}));
jest.mock('@/lib/db/schema', () => ({ settings: { key: 'key' } }));
jest.mock('drizzle-orm', () => ({ eq: () => ({}) }));
jest.mock('@/lib/db/client', () => ({
  db: { select: () => ({ from: () => ({ where: async () => (security === undefined ? [] : [{ value: security }]) }) }) },
}));
jest.mock('@/lib/cache/rateLimit', () => ({
  rateLimitGuard: async () => (limited ? NextResponse.json({ error: 'Too many' }, { status: 429 }) : null),
}));
jest.mock('next/headers', () => ({ headers: async () => new Map([['x-forwarded-for', '10.0.0.5']]) }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));

import { pinRequiredForEveryChange, requireEverydayAuth } from '../everydayAuth';

beforeEach(() => {
  session = null;
  security = undefined;
  display = { userId: 'display-1', role: 'guest' };
  limited = false;
});

describe('pinRequiredForEveryChange', () => {
  it('is on when the setting was never made (an existing install)', async () => {
    expect(await pinRequiredForEveryChange()).toBe(true);
    security = { sessionTimeout: 30 };
    expect(await pinRequiredForEveryChange()).toBe(true);
  });
  it('is off only when a parent turned it off', async () => {
    security = { requirePinForEveryChange: false };
    expect(await pinRequiredForEveryChange()).toBe(false);
  });
});

describe('requireEverydayAuth', () => {
  it('lets a signed-in person through as themselves', async () => {
    session = { userId: 'parent-1', role: 'parent' };
    expect(await requireEverydayAuth('task-toggle')).toEqual({ userId: 'parent-1', role: 'parent' });
  });
  it('refuses a signed-out wall while the PIN is required', async () => {
    const res = await requireEverydayAuth('task-toggle');
    expect((res as NextResponse).status).toBe(401);
  });
  it('lets a signed-out wall through as the display, never as a parent, once the PIN setting is off', async () => {
    security = { requirePinForEveryChange: false };
    const res = await requireEverydayAuth('task-toggle');
    expect(res).toEqual({ userId: 'display-1', role: 'guest', wall: true });
  });
  it('refuses the wall when there is no display identity (the authentication wall is on)', async () => {
    security = { requirePinForEveryChange: false };
    display = null;
    expect(((await requireEverydayAuth('task-toggle')) as NextResponse).status).toBe(401);
  });
  it('answers 429 past 30 changes a minute from one screen', async () => {
    security = { requirePinForEveryChange: false };
    limited = true;
    expect(((await requireEverydayAuth('task-toggle')) as NextResponse).status).toBe(429);
  });
});
