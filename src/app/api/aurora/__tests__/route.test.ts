/**
 * GET /api/aurora: off unless switched on, and a failed forecast is a 502 the
 * sky can ignore.
 */

const mockGetDisplayAuth = jest.fn();
const mockWhere = jest.fn();
const mockFetchAurora = jest.fn();

jest.mock('@/lib/auth', () => ({ getDisplayAuth: () => mockGetDisplayAuth() }));
jest.mock('@/lib/db/client', () => ({
  db: { select: () => ({ from: () => ({ where: (...a: unknown[]) => mockWhere(...a) }) }) },
}));
jest.mock('@/lib/db/schema', () => ({ settings: { key: 'key', value: 'value' } }));
jest.mock('@/lib/cache/redis', () => ({ getCached: (_k: string, fn: () => unknown) => fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/integrations/aurora', () => ({
  ...jest.requireActual('@/lib/integrations/aurora'),
  fetchAurora: (...a: unknown[]) => mockFetchAurora(...a),
}));

import { GET } from '../route';

const LOCATION = { key: 'location', value: { lat: 45, lon: -100, displayName: 'Somewhere' } };
const ON = { key: 'nightSkyAurora', value: true };

describe('GET /api/aurora', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDisplayAuth.mockResolvedValue({ userId: 'u1', role: 'guest' });
  });

  it('refuses a caller with no identity', async () => {
    mockGetDisplayAuth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it('is off by default and fetches nothing', async () => {
    mockWhere.mockResolvedValue([LOCATION]);
    const res = await GET();
    expect(await res.json()).toEqual({ enabled: false });
    expect(mockFetchAurora).not.toHaveBeenCalled();
  });

  it('says nothing, and fetches nothing, with no geocoded location', async () => {
    mockWhere.mockResolvedValue([ON, { key: 'location', value: { zipCode: '00000' } }]);
    expect(await (await GET()).json()).toEqual({ enabled: true, chance: null });
    expect(mockFetchAurora).not.toHaveBeenCalled();
  });

  it('reads the forecast for the household location when on', async () => {
    mockWhere.mockResolvedValue([ON, LOCATION]);
    mockFetchAurora.mockResolvedValue({ chance: 'horizon', forecastAt: '2026-11-01T06:00:00Z' });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: true, chance: 'horizon', forecastAt: '2026-11-01T06:00:00Z' });
    expect(mockFetchAurora).toHaveBeenCalledWith(45, -100);
  });

  it('answers 502 when NOAA does not', async () => {
    mockWhere.mockResolvedValue([ON, LOCATION]);
    mockFetchAurora.mockRejectedValue(new Error('aborted'));
    expect((await GET()).status).toBe(502);
  });
});
