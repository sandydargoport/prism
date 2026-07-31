/**
 * @jest-environment node
 */
import { POST } from '../route';

const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockWhere = jest.fn();
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
  settings: { key: 'key' },
  users: {},
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  sql: jest.fn(() => ({})),
}));

/** Route counts users first, then (if any) reads/writes the setupComplete row. */
function primeUserCount(count: number) {
  // 1st select() -> user count
  mockSelect.mockReturnValueOnce({ from: () => [{ count }] });
}

describe('POST /api/setup/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses to finish setup with zero members (400)', async () => {
    primeUserCount(0);

    const res = await POST();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one family member/i);
    // Must not have written the completion marker.
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('marks setup complete when at least one member exists (insert path)', async () => {
    primeUserCount(1);
    // 2nd select() -> existing setupComplete lookup (none -> insert)
    mockSelect.mockReturnValueOnce({ from: () => ({ where: () => [] }) });
    const insertValues = jest.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValues });

    const res = await POST();
    expect(res.status).toBe(200);
    expect(insertValues).toHaveBeenCalled();
  });
});
