/**
 * Tests for the setup completion endpoint.
 *
 * Mocks the DB to verify:
 * - Refuses to mark setup complete when no parent exists (prevents lockout)
 * - Inserts setupComplete when none exists and a parent is present
 * - Updates setupComplete when a row already exists and a parent is present
 */

import { NextResponse } from 'next/server';

const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    insert: (...a: unknown[]) => mockInsert(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
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

/** Build a chainable select() mock for the existing-setupComplete lookup. */
function mockSettingsLookup(rows: unknown[]) {
  mockSelect.mockReturnValueOnce({
    from: () => ({ where: () => Promise.resolve(rows) }),
  });
}

describe('POST /api/setup/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({
      set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
    });
  });

  it('refuses to complete setup when no parent exists', async () => {
    mockParentLookup([]); // no parent

    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('parent');
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('inserts setupComplete when a parent exists and no row is present', async () => {
    mockParentLookup([{ id: 'parent-1' }]);
    mockSettingsLookup([]); // no existing setupComplete row

    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates setupComplete when a parent exists and a row is present', async () => {
    mockParentLookup([{ id: 'parent-1' }]);
    mockSettingsLookup([{ key: 'setupComplete', value: { completedAt: 'old' } }]);

    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
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
