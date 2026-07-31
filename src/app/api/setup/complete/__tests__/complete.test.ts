/**
 * @jest-environment node
 */
import { POST } from '../route';

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
  settings: { key: 'key' },
  users: { id: 'id', role: 'role', sortOrder: 'sortOrder', createdAt: 'createdAt' },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  asc: jest.fn(),
  sql: jest.fn(() => ({})),
}));

/** 1st select() -> ordered member rows. */
function primeMembers(rows: Array<{ id: string; role: string }>) {
  mockSelect.mockReturnValueOnce({ from: () => ({ orderBy: () => rows }) });
}
/** subsequent select() -> a settings lookup keyed by a where() clause. */
function primeSettingsLookup(rows: unknown[]) {
  mockSelect.mockReturnValueOnce({ from: () => ({ where: () => rows }) });
}

describe('POST /api/setup/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses to finish setup with zero members (400)', async () => {
    primeMembers([]);

    const res = await POST();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one family member/i);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('marks setup complete and defaults the display user to the primary parent', async () => {
    primeMembers([
      { id: 'child-1', role: 'child' },
      { id: 'parent-1', role: 'parent' },
    ]);
    primeSettingsLookup([]); // displayUserId not set yet -> should insert
    primeSettingsLookup([]); // setupComplete not set yet -> insert path

    const insertValues = jest.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValues });

    const res = await POST();
    expect(res.status).toBe(200);

    // displayUserId defaulted to the first *parent*, not the first member.
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'displayUserId', value: 'parent-1' })
    );
    // and the completion marker was written too.
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'setupComplete' })
    );
  });

  it('does not overwrite an existing display-user choice', async () => {
    primeMembers([{ id: 'parent-1', role: 'parent' }]);
    primeSettingsLookup([{ key: 'displayUserId', value: '' }]); // already chosen (even "None")
    primeSettingsLookup([]); // setupComplete insert path

    const insertValues = jest.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: insertValues });

    const res = await POST();
    expect(res.status).toBe(200);
    // Only the setupComplete marker is inserted; displayUserId is left untouched.
    expect(insertValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ key: 'displayUserId' })
    );
  });
});
