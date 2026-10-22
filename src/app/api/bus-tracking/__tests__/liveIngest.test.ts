/**
 * @jest-environment node
 *
 * The ingest endpoint is machine-to-machine only: a bus:ingest (or full)
 * token, never a browser session, and nothing reaches the ingest service
 * without passing validation.
 */
import { NextRequest } from 'next/server';

const mockRequireAuth = jest.fn();
const mockIngest = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: jest.fn(),
}));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/services/bus-live-ingest', () => ({
  ingestLivePayload: (...a: unknown[]) => mockIngest(...a),
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { POST } from '../live/ingest/route';

const body = { provider: 'p', fixes: [{ track: 't1', ts: '2026-03-02T13:05:00Z', lat: 39.7, lng: -104.9 }] };
const request = (b: unknown) => new NextRequest('http://localhost/api/bus-tracking/live/ingest', {
  method: 'POST',
  body: typeof b === 'string' ? b : JSON.stringify(b),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIngest.mockResolvedValue({ fixes: 1 });
});

describe('POST /api/bus-tracking/live/ingest', () => {
  it('refuses a browser session', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'u', role: 'parent' });
    const res = await POST(request(body));
    expect(res.status).toBe(401);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('refuses a token without the bus:ingest scope', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'u', role: 'parent', scopes: ['voice'] });
    const res = await POST(request(body));
    expect(res.status).toBe(403);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('accepts a bus:ingest token and passes the validated payload on', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'u', role: 'parent', scopes: ['bus:ingest'] });
    const res = await POST(request(body));
    expect(res.status).toBe(200);
    expect(mockIngest).toHaveBeenCalledWith(body);
  });

  it('rejects bad JSON and an invalid payload before ingest', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'u', role: 'parent', scopes: ['bus:ingest'] });
    expect((await POST(request('{not json'))).status).toBe(400);
    expect((await POST(request({ provider: 'p', fixes: [{ track: 't1' }] }))).status).toBe(400);
    expect(mockIngest).not.toHaveBeenCalled();
  });
});
