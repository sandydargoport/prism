const mockOnConflictDoNothing = jest.fn();
const mockValues = jest.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
const mockInsert = jest.fn(() => ({ values: mockValues }));
jest.mock('@/lib/db/client', () => ({ db: { insert: () => mockInsert() } }));
jest.mock('@/lib/db/schema', () => ({ settings: { key: 'key' } }));
const mockLogError = jest.fn();
jest.mock('@/lib/utils/logError', () => ({ logError: (...a: unknown[]) => mockLogError(...a) }));

import { saveHouseholdTimezoneIfMissing } from '../householdTimezone';

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
