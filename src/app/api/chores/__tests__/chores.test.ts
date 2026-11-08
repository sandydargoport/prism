/**
 * Tests for GET and POST /api/chores
 *
 * Covers:
 * - GET: returns chores list, caches results, auth not required (display mode)
 * - POST: requires auth, requires parent role, validates input, creates chore
 * - POST: invalidates cache on success
 */

import { NextRequest } from 'next/server';

// --- DB mock ---
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockWhere = jest.fn();
const mockInsert = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    insert: (...a: unknown[]) => mockInsert(...a),
    transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  chores: {},
  users: {},
  choreCompletions: { choreId: 'choreId', completedBy: 'completedBy', approvedBy: 'approvedBy', id: 'id', completedAt: 'completedAt' },
  auditLogs: {},
}));

// --- Auth mock ---
const mockGetDisplayAuth = jest.fn();
const mockRequireAuth = jest.fn();
const mockRequireRole = jest.fn();

jest.mock('@/lib/auth', () => ({
  getDisplayAuth: () => mockGetDisplayAuth(),
  requireAuth: () => mockRequireAuth(),
  requireRole: (...a: unknown[]) => mockRequireRole(...a),
}));

// --- Cache mock ---
const mockGetCached = jest.fn();
const mockInvalidateEntity = jest.fn();

jest.mock('@/lib/cache/redis', () => ({
  getCached: (...a: unknown[]) => mockGetCached(...a),
}));

jest.mock('@/lib/cache/cacheKeys', () => ({
  invalidateEntity: (...a: unknown[]) => mockInvalidateEntity(...a),
}));

// --- Other mocks ---
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/utils/formatters', () => ({ formatChoreRow: jest.fn((r) => r) }));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: jest.fn().mockResolvedValue(null) }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), and: jest.fn(), desc: jest.fn(), isNull: jest.fn(), or: jest.fn(), lte: jest.fn() }));
jest.mock('date-fns', () => ({ format: jest.fn().mockReturnValue('2026-04-09') }));

import { GET, POST } from '../route';

const parentAuth = { userId: 'parent-1', role: 'parent' };
const CHORE_LIST = [
  { id: 'chore-1', title: 'Dishes', assignedTo: 'child-1', frequency: 'daily', enabled: true, pendingApproval: undefined, lastCompleted: undefined },
];

function makePostRequest(body: object, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/chores', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('GET /api/chores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDisplayAuth.mockResolvedValue({ userId: 'parent-1', role: 'parent' });
    mockGetCached.mockImplementation((_key, fn) => fn());
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, innerJoin: jest.fn().mockReturnValue({ where: mockWhere }) });
    mockWhere.mockResolvedValue([]);
  });

  it('returns empty list when no display auth', async () => {
    mockGetDisplayAuth.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3000/api/chores');
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.chores).toEqual([]);
  });

  it('returns chores list when authenticated', async () => {
    mockGetCached.mockResolvedValue({ chores: CHORE_LIST });
    const req = new NextRequest('http://localhost:3000/api/chores');
    const res = await GET(req);
    const body = await res.json();
    expect(body.chores).toHaveLength(1);
    expect(body.chores[0].id).toBe('chore-1');
  });

  it('uses cache with correct key', async () => {
    mockGetCached.mockResolvedValue({ chores: [] });
    const req = new NextRequest('http://localhost:3000/api/chores?assignedTo=child-1&enabled=true');
    await GET(req);
    expect(mockGetCached).toHaveBeenCalledWith(
      expect.stringContaining('child-1'),
      expect.any(Function),
      expect.any(Number)
    );
  });
});

describe('POST /api/chores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(parentAuth);
    mockRequireRole.mockReturnValue(null);
    mockInvalidateEntity.mockResolvedValue(undefined);
    mockInsert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{
          id: 'new-chore',
          title: 'Clean Room',
          description: null,
          assignedTo: 'child-1',
          frequency: 'weekly',
          points: 5,
          enabled: true,
          createdAt: new Date(),
        }]),
      }),
    });
  });

  it('returns 401 when not authenticated', async () => {
    const { NextResponse } = await import('next/server');
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    const res = await POST(makePostRequest({ title: 'Test', frequency: 'daily' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-parent tries to create chore', async () => {
    const { NextResponse } = await import('next/server');
    mockRequireRole.mockReturnValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    const res = await POST(makePostRequest({ title: 'Test', frequency: 'daily' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid input (missing required fields)', async () => {
    const res = await POST(makePostRequest({ title: '' }));
    expect(res.status).toBe(400);
  });

  it('creates a chore and invalidates cache', async () => {
    const res = await POST(makePostRequest({
      title: 'Clean Room',
      category: 'cleaning',
      frequency: 'weekly',
      assignedTo: '00000000-0000-0000-0000-000000000001',
      pointValue: 5,
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('new-chore');
    expect(mockInvalidateEntity).toHaveBeenCalledWith('chores');
  });

  // Reminders (#1109): no points or approval, whatever is sent, and a time.
  it('saves a reminder with no points and no approval', async () => {
    const res = await POST(makePostRequest({
      kind: 'reminder', title: 'Allergy tablet', category: 'other', frequency: 'daily',
      nextDueTime: '19:00', pointValue: 10, requiresApproval: true,
    }));
    expect(res.status).toBe(201);
    const values = mockInsert.mock.results[0]!.value.values as jest.Mock;
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ kind: 'reminder', pointValue: 0, requiresApproval: false, nextDueTime: '19:00' }));
  });

  it('refuses a reminder without a time', async () => {
    const res = await POST(makePostRequest({ kind: 'reminder', title: 'Allergy tablet', category: 'other', frequency: 'daily' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('A reminder needs a time');
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
