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
let forwarded = '203.0.113.5';
let namedScreen: unknown = { id: 'screen-1' };
let trusted = false;
let person: unknown = null;
const limitKeys: string[] = [];

jest.mock('../requireAuth', () => ({
  requireAuth: async () => session ?? NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
  getDisplayAuth: async () => display,
  optionalAuth: async () => person,
}));
jest.mock('../displayIdentity', () => ({ currentDisplay: async () => namedScreen }));
jest.mock('../authWall', () => ({ isTrustedDevice: async () => trusted }));
jest.mock('@/lib/db/schema', () => ({ settings: { key: 'key' } }));
jest.mock('drizzle-orm', () => ({ eq: () => ({}) }));
jest.mock('@/lib/db/client', () => ({
  db: { select: () => ({ from: () => ({ where: async () => (security === undefined ? [] : [{ value: security }]) }) }) },
}));
jest.mock('@/lib/cache/rateLimit', () => ({
  rateLimitGuard: async (key: string) => {
    limitKeys.push(key);
    return limited ? NextResponse.json({ error: 'Too many' }, { status: 429 }) : null;
  },
}));
jest.mock('next/headers', () => ({ headers: async () => new Map([['x-forwarded-for', forwarded]]) }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));

import { pinRequiredForEveryChange, requireEverydayAuth, screenKey, screenOrPerson } from '../everydayAuth';

beforeEach(() => {
  session = null;
  security = undefined;
  display = { userId: 'display-1', role: 'guest' };
  limited = false;
  forwarded = '203.0.113.5';
  namedScreen = { id: 'screen-1' };
  trusted = false;
  person = null;
  limitKeys.length = 0;
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
  it("answers 429 once the household's walls are past their changes for the minute", async () => {
    security = { requirePinForEveryChange: false };
    limited = true;
    expect(((await requireEverydayAuth('task-toggle')) as NextResponse).status).toBe(429);
  });
});

describe('the wall limit cannot be dodged with a made-up address (#809)', () => {
  it('counts every signed-out change in one household bucket, whatever X-Forwarded-For says', async () => {
    security = { requirePinForEveryChange: false };
    for (const addr of ['203.0.113.5', '198.51.100.9', '203.0.113.7']) {
      forwarded = addr;
      await requireEverydayAuth('chore-complete');
    }
    expect(new Set(limitKeys)).toEqual(new Set(['wall:household']));
  });
});

describe('only this install\'s screens act as the wall (#1222)', () => {
  beforeEach(() => { security = { requirePinForEveryChange: false }; });

  it('refuses a browser or script that is not a named screen or a trusted device', async () => {
    namedScreen = null;
    expect(((await requireEverydayAuth('chore-complete')) as NextResponse).status).toBe(401);
    expect(limitKeys).toEqual([]);
  });
  it('lets a trusted device through', async () => {
    namedScreen = null;
    trusted = true;
    expect(await requireEverydayAuth('chore-complete')).toEqual({ userId: 'display-1', role: 'guest', wall: true });
  });
  it('names the screen in the log from its cookie, never from X-Forwarded-For', async () => {
    forwarded = '198.51.100.9';
    expect(await screenKey()).toBe('display:screen-1');
    namedScreen = null;
    expect(await screenKey()).toBe('unknown-screen');
  });
});

describe('screenOrPerson (#1222)', () => {
  it('is the signed-in person when there is one', async () => {
    namedScreen = null;
    person = { userId: 'parent-1', role: 'parent' };
    expect(await screenOrPerson()).toEqual(person);
  });
  it('is the display identity on a named screen', async () => {
    expect(await screenOrPerson()).toEqual({ userId: 'display-1', role: 'guest' });
  });
  it('is nothing for an unnamed browser, even with sign-in off', async () => {
    namedScreen = null;
    expect(await screenOrPerson()).toBeNull();
  });
});
