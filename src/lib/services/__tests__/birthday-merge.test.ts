/**
 * @jest-environment node
 */

/**
 * upsertBirthday is the one path every sync insert flows through, so it is
 * where a removal has to hold. The tombstone check used to live only in event
 * detection, and the CardDAV contacts sync, which calls upsertBirthday
 * directly, re-added anything the user had removed (#676).
 */

const mockSelect = jest.fn();
const mockFindMany = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    insert: (...a: unknown[]) => mockInsert(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
    query: { birthdays: { findMany: (...a: unknown[]) => mockFindMany(...a) } },
  },
}));

import { upsertBirthday } from '../birthday-merge';

/** The tombstone lookup: select().from().where().limit() resolves to rows. */
function primeTombstones(rows: Array<{ id: string }>) {
  mockSelect.mockReturnValue({
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  });
}

describe('upsertBirthday honours a removal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: () => ({ onConflictDoUpdate: () => Promise.resolve() }) });
  });

  it('skips a birthday the user removed, without writing anything', async () => {
    primeTombstones([{ id: 'tomb-1' }]);

    const result = await upsertBirthday({
      name: 'Robin Example',
      birthDate: '1990-04-12',
      source: 'carddav',
    });

    expect(result).toBe('skipped');
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('still inserts a birthday that was never removed', async () => {
    primeTombstones([]);

    const result = await upsertBirthday({
      name: 'Robin Example',
      birthDate: '1990-04-12',
      source: 'carddav',
    });

    expect(result).toBe('inserted');
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
