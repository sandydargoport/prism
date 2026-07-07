/**
 * Tests for the setup completion endpoint.
 *
 * Mocks the DB to verify:
 * - Refuses to mark setup complete when no parent exists (prevents lockout)
 * - Upserts setupComplete when a parent exists (idempotent, race-safe)
 * - Surfaces a 500 on unexpected DB errors
 */

import { NextResponse } from 'next/server';

const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockOnConflictDoUpdate = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    insert: (...a: unknown[]) => mockInsert(...a),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  settings: { key: 'key', value: 'value' },
  users: { id: 'id', role: 'role' },
}));

import { POST } from '../route';

/** Build a chainable select() mock that resolves to `rows` for the parent lookup. */
function mockParentLookup(rows: unknown[]) {
  mockSelect.mockReturnValueOnce({
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  });
}

describe('POST /api/setup/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnConflictDoUpdate.mockResolvedValue(undefined);
    mockInsert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: (...a: unknown[]) => mockOnConflictDoUpdate(...a),
      }),
    });
  });

  it('refuses to complete setup when no parent exists', async () => {
    mockParentLookup([]); // no parent

    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('parent');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('upserts setupComplete when a parent exists', async () => {
    mockParentLookup([{ id: 'parent-1' }]);

    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it('is idempotent across concurrent calls (no unique-constraint error)', async () => {
    mockParentLookup([{ id: 'parent-1' }]);
    mockParentLookup([{ id: 'parent-1' }]);

    const [a, b] = await Promise.all([POST(), POST()]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(2);
  });

  it('returns 500 when the query throws', async () => {
    mockSelect.mockImplementationOnce(() => {
      throw new Error('db down');
    });

    const res = await POST();
    expect(res.status).toBe(500);
    expect(res).toBeInstanceOf(NextResponse);
  });
});
