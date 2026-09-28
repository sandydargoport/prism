const mockOnConflictDoNothing = jest.fn();
const mockValues = jest.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
const mockInsert = jest.fn(() => ({ values: mockValues }));
const mockWhere = jest.fn();
const mockSelect = jest.fn(() => ({ from: () => ({ where: mockWhere }) }));
jest.mock('@/lib/db/client', () => ({
  db: { insert: () => mockInsert(), select: (...a: unknown[]) => mockSelect(...(a as [])) },
}));
jest.mock('@/lib/db/schema', () => ({ settings: { key: 'key', value: 'value' } }));
const mockLogError = jest.fn();
jest.mock('@/lib/utils/logError', () => ({ logError: (...a: unknown[]) => mockLogError(...a) }));

import {
  getHouseholdTimezone,
  invalidateHouseholdTimezoneCache,
  saveHouseholdTimezoneIfMissing,
} from '../householdTimezone';

const processZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe('saveHouseholdTimezoneIfMissing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnConflictDoNothing.mockResolvedValue(undefined);
  });

  it('inserts the zone without overwriting an existing one', async () => {
    await saveHouseholdTimezoneIfMissing('America/Denver');
    expect(mockValues).toHaveBeenCalledWith({ key: 'timezone', value: 'America/Denver' });
    expect(mockOnConflictDoNothing).toHaveBeenCalledWith({ target: 'key' });
  });

  it.each([undefined, null, '', 'UTC', 'GMT', 'Etc/GMT+5', 'Not/AZone', 42])(
    'ignores %p',
    async (zone) => {
      await saveHouseholdTimezoneIfMissing(zone);
      expect(mockInsert).not.toHaveBeenCalled();
    },
  );

  it('swallows a database error so the sign-in still succeeds', async () => {
    mockOnConflictDoNothing.mockRejectedValue(new Error('db down'));
    await expect(saveHouseholdTimezoneIfMissing('Asia/Tokyo')).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalled();
  });
});

describe('getHouseholdTimezone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    invalidateHouseholdTimezoneCache();
  });

  it('returns the stored zone', async () => {
    mockWhere.mockResolvedValue([{ value: 'America/Chicago' }]);
    await expect(getHouseholdTimezone()).resolves.toBe('America/Chicago');
  });

  it.each([
    ['no row', []],
    ['a non-string value', [{ value: 42 }]],
    ['an unknown zone', [{ value: 'Not/AZone' }]],
  ])('falls back to the process zone for %s', async (_label, rows) => {
    mockWhere.mockResolvedValue(rows);
    await expect(getHouseholdTimezone()).resolves.toBe(processZone);
  });

  it('keeps a stored UTC, which a household may choose on purpose', async () => {
    mockWhere.mockResolvedValue([{ value: 'UTC' }]);
    await expect(getHouseholdTimezone()).resolves.toBe('UTC');
  });

  it('reads the database once while the cache is fresh', async () => {
    mockWhere.mockResolvedValue([{ value: 'Asia/Tokyo' }]);
    await getHouseholdTimezone();
    mockWhere.mockResolvedValue([{ value: 'Europe/Berlin' }]);
    await expect(getHouseholdTimezone()).resolves.toBe('Asia/Tokyo');
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('re-reads after the TTL', async () => {
    jest.useFakeTimers({ now: new Date('2026-06-15T01:30:00Z') });
    mockWhere.mockResolvedValue([{ value: 'Asia/Tokyo' }]);
    await getHouseholdTimezone();
    mockWhere.mockResolvedValue([{ value: 'Europe/Berlin' }]);
    jest.setSystemTime(new Date('2026-06-15T01:31:01Z'));
    await expect(getHouseholdTimezone()).resolves.toBe('Europe/Berlin');
  });

  it('re-reads after invalidation', async () => {
    mockWhere.mockResolvedValue([{ value: 'Asia/Tokyo' }]);
    await getHouseholdTimezone();
    mockWhere.mockResolvedValue([{ value: 'Europe/Berlin' }]);
    invalidateHouseholdTimezoneCache();
    await expect(getHouseholdTimezone()).resolves.toBe('Europe/Berlin');
  });

  it('re-reads after a sign-in stores a zone', async () => {
    mockWhere.mockResolvedValue([]);
    await getHouseholdTimezone();
    mockOnConflictDoNothing.mockResolvedValue(undefined);
    await saveHouseholdTimezoneIfMissing('America/Denver');
    mockWhere.mockResolvedValue([{ value: 'America/Denver' }]);
    await expect(getHouseholdTimezone()).resolves.toBe('America/Denver');
  });

  it('falls back without caching when the read fails', async () => {
    mockWhere.mockRejectedValueOnce(new Error('db down'));
    await expect(getHouseholdTimezone()).resolves.toBe(processZone);
    expect(mockLogError).toHaveBeenCalled();
    mockWhere.mockResolvedValue([{ value: 'Asia/Tokyo' }]);
    await expect(getHouseholdTimezone()).resolves.toBe('Asia/Tokyo');
  });
});
