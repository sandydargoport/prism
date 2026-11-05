/**
 * @jest-environment node
 */

/**
 * POST /api/away-mode auto-activation (#809): matching Origin and Host prove
 * little, since a non-browser caller can set both, so the caller must also be
 * this install's screen or a person, and the Host must be there.
 */
import { NextRequest, NextResponse } from 'next/server';

let display: unknown = { userId: 'display-1', role: 'guest' };
const mockInsert = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: async () => NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
  requireRole: () => null,
  getDisplayAuth: async () => display,
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => [] }) }),
    insert: () => ({ values: async (v: unknown) => mockInsert(v) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  },
}));
jest.mock('@/lib/db/schema', () => ({ settings: { key: 'key' } }));
jest.mock('drizzle-orm', () => ({ eq: () => ({}) }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: async () => null }));

import { POST } from '../route';

const auto = (headers: Record<string, string>) => POST(new NextRequest('http://prism.test/api/away-mode', {
  method: 'POST',
  body: JSON.stringify({ enabled: true, autoActivated: true }),
  headers: { 'Content-Type': 'application/json', ...headers },
}));

beforeEach(() => { display = { userId: 'display-1', role: 'guest' }; mockInsert.mockClear(); });

describe('POST /api/away-mode auto-activation (#809)', () => {
  it('turns on for the wall, from its own page', async () => {
    const res = await auto({ origin: 'http://prism.test', host: 'prism.test' });
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('refuses a caller that is not the screen or a person, even with matching headers', async () => {
    display = null;
    const res = await auto({ origin: 'http://prism.test', host: 'prism.test' });
    expect(res.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('refuses an Origin with no Host to compare it to, and a mismatched one', async () => {
    const noHost = await POST(new NextRequest('http://prism.test/api/away-mode', {
      method: 'POST', body: JSON.stringify({ enabled: true, autoActivated: true }),
      headers: { 'Content-Type': 'application/json', origin: 'http://elsewhere.test' },
    }));
    // No Host header at all: the previous code skipped the comparison.
    expect(noHost.status).toBe(403);
    expect((await auto({ origin: 'http://elsewhere.test', host: 'prism.test' })).status).toBe(403);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
