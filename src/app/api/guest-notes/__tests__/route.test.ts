/**
 * Notes from the babysitter (#497): accepted only while Babysitter Mode is
 * on, short and plain, capped per household, and stored with no author so
 * they can never pass for a family member's message.
 */
const mockModeState = jest.fn();
const mockRateLimitGuard = jest.fn();
const mockInsertValues = jest.fn();
const mockInsertReturning = jest.fn();
const mockInvalidate = jest.fn();
const mockLogActivity = jest.fn();

jest.mock('@/lib/services/babysitterMode', () => ({
  getBabysitterModeState: () => mockModeState(),
}));
jest.mock('@/lib/cache/rateLimit', () => ({
  rateLimitGuard: (...a: unknown[]) => mockRateLimitGuard(...a),
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    insert: () => ({
      values: (v: unknown) => {
        mockInsertValues(v);
        return { returning: () => mockInsertReturning() };
      },
    }),
  },
}));
jest.mock('@/lib/db/schema', () => ({ familyMessages: {} }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: (...a: unknown[]) => mockInvalidate(...a) }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: (...a: unknown[]) => mockLogActivity(...a) }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/guest-notes', {
    method: 'POST',
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  jest.clearAllMocks();
  mockModeState.mockResolvedValue({ enabled: true, enabledAt: '2026-10-03T18:00:00Z', enabledBy: 'p1' });
  mockRateLimitGuard.mockResolvedValue(null);
  mockInsertReturning.mockImplementation(() => {
    const v = mockInsertValues.mock.calls[0]![0] as Record<string, unknown>;
    return Promise.resolve([{
      id: 'm1',
      pinned: false,
      important: false,
      expiresAt: null,
      createdAt: new Date('2026-10-03T19:00:00Z'),
      ...v,
    }]);
  });
});

describe('POST /api/guest-notes', () => {
  it('refuses a note while Babysitter Mode is off, and stores nothing', async () => {
    mockModeState.mockResolvedValue({ enabled: false, enabledAt: null, enabledBy: null });
    const res = await post({ message: 'Hello' });
    expect(res.status).toBe(403);
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockRateLimitGuard).not.toHaveBeenCalled();
  });

  it('stores the note with no author, marked as from the babysitter', async () => {
    const res = await post({ message: '  Everyone ate dinner.  ', name: ' Sam ' });
    expect(res.status).toBe(201);
    expect(mockInsertValues).toHaveBeenCalledWith({
      message: 'Everyone ate dinner.',
      authorId: null,
      guestKind: 'babysitter',
      guestName: 'Sam',
    });
    const body = await res.json();
    expect(body.guest).toBe('babysitter');
    expect(body.author.name).toBe('Babysitter (Sam)');
    expect(mockInvalidate).toHaveBeenCalledWith('messages');
    expect(mockLogActivity).toHaveBeenCalledWith(expect.objectContaining({ userId: null, entityId: 'm1' }));
  });

  it('ignores fields a member message would take', async () => {
    await post({ message: 'Hi', authorId: 'p1', pinned: true, important: true });
    const stored = mockInsertValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(stored.authorId).toBeNull();
    expect(stored).not.toHaveProperty('pinned');
    expect(stored).not.toHaveProperty('important');
  });

  it('stores no name when none was given', async () => {
    await post({ message: 'Hi' });
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ guestName: null }));
  });

  it.each([
    ['empty', { message: '   ' }],
    ['not text', { message: 42 }],
    ['too long', { message: 'x'.repeat(501) }],
    ['name too long', { message: 'Hi', name: 'x'.repeat(41) }],
  ])('rejects a note that is %s', async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('accepts a note at exactly the length limit', async () => {
    const res = await post({ message: 'x'.repeat(500) });
    expect(res.status).toBe(201);
  });

  it('rejects a body that is not JSON', async () => {
    const res = await POST(new NextRequest('http://localhost/api/guest-notes', { method: 'POST', body: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('caps notes per household, not per caller', async () => {
    mockRateLimitGuard.mockResolvedValue(NextResponse.json({ error: 'Too many requests.' }, { status: 429 }));
    const res = await post({ message: 'Hi' });
    expect(res.status).toBe(429);
    expect(mockRateLimitGuard).toHaveBeenCalledWith('household', 'guest-notes', 10, 3600);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});
