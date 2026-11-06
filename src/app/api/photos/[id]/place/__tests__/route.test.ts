/**
 * GET /api/photos/[id]/place (#958): looks a place up only while the
 * household shows places, and only once per photo.
 */
const mockReverse = jest.fn();
const mockSettingRows = jest.fn();
const mockPhotoRows = jest.fn();
const mockSet = jest.fn();

jest.mock('@/lib/auth', () => ({ getDisplayAuth: async () => ({ userId: 'display' }) }));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/photos/place', () => ({ reversePlace: (...a: unknown[]) => mockReverse(...a) }));
jest.mock('@/lib/db/schema', () => ({ photos: { __t: 'photos' }, settings: { __t: 'settings' } }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: (t: { __t: string }) => ({ where: () => (t.__t === 'settings' ? mockSettingRows() : mockPhotoRows()) }) }),
    update: () => ({ set: (v: unknown) => { mockSet(v); return { where: async () => undefined }; } }),
  },
}));

import { GET } from '../route';

const get = () => GET(new Request('http://localhost/api/photos/p1/place'), { params: Promise.resolve({ id: 'p1' }) });
const photo = (over: Record<string, unknown> = {}) => ({ placeName: null, placeLookedUp: false, latitude: '44.0462', longitude: '-123.0220', ...over });

beforeEach(() => jest.clearAllMocks());

describe('GET /api/photos/[id]/place', () => {
  it('looks nothing up while places are off', async () => {
    mockSettingRows.mockResolvedValue([]);
    mockPhotoRows.mockResolvedValue([photo()]);
    expect(await (await get()).json()).toEqual({ place: null });
    expect(mockReverse).not.toHaveBeenCalled();
  });

  it('looks a place up once and stores it', async () => {
    mockSettingRows.mockResolvedValue([{ value: true }]);
    mockPhotoRows.mockResolvedValue([photo()]);
    mockReverse.mockResolvedValue('Springfield, Oregon');
    expect(await (await get()).json()).toEqual({ place: 'Springfield, Oregon' });
    expect(mockSet).toHaveBeenCalledWith({ placeName: 'Springfield, Oregon', placeLookedUp: true });
  });

  it('answers from what is stored, and never looks up a photo without a location', async () => {
    mockSettingRows.mockResolvedValue([{ value: true }]);
    mockPhotoRows.mockResolvedValue([photo({ placeName: 'Springfield, Oregon', placeLookedUp: true })]);
    expect(await (await get()).json()).toEqual({ place: 'Springfield, Oregon' });
    mockPhotoRows.mockResolvedValue([photo({ latitude: null, longitude: null })]);
    expect(await (await get()).json()).toEqual({ place: null });
    expect(mockReverse).not.toHaveBeenCalled();
  });
});
