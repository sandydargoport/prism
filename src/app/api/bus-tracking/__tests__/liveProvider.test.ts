/**
 * @jest-environment node
 *
 * The live endpoint says whether a live provider feeds the household, so the
 * widget knows never to fall back to the email view. Sent with the first load
 * only.
 */
import { NextRequest } from 'next/server';

let providerTrips: unknown[] = [];
const mockGetDisplayAuth = jest.fn();

/** A query builder that answers the provider check (the only `.limit(1)` query) and nothing else. */
function query() {
  let limited = false;
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'innerJoin', 'where', 'orderBy', 'groupBy']) chain[m] = () => chain;
  chain.limit = (n: number) => { limited = n === 1; return chain; };
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(limited ? providerTrips : []).then(resolve, reject);
  return chain;
}

jest.mock('@/lib/db/client', () => ({ db: { select: () => query() } }));
jest.mock('@/lib/auth', () => ({ getDisplayAuth: () => mockGetDisplayAuth() }));
jest.mock('@/lib/householdTimezone', () => ({ getHouseholdTimezone: async () => 'UTC' }));
jest.mock('@/lib/services/bus-history', () => ({
  firstMoves: async () => new Map(),
  leastLate: () => null,
  recentLateness: async () => [],
  typicalLate: () => null,
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET } from '../live/route';

const get = (query = '') => GET(new NextRequest(`http://localhost/api/bus-tracking/live${query}`));

beforeEach(() => {
  mockGetDisplayAuth.mockResolvedValue({ userId: 'u' });
  providerTrips = [];
});

describe('GET /api/bus-tracking/live: provider', () => {
  it('says a provider feeds the routes when a recent trip exists', async () => {
    providerTrips = [{ id: 'trip' }];
    const body = await (await get()).json();
    expect(body.provider).toBe(true);
  });

  it('says none when no trip has come in lately', async () => {
    const body = await (await get()).json();
    expect(body.provider).toBe(false);
  });

  it('leaves it out of later polls, which only bring new fixes', async () => {
    providerTrips = [{ id: 'trip' }];
    const body = await (await get('?since=2026-10-30T20:00:00Z')).json();
    expect(body).not.toHaveProperty('provider');
  });

  it('says none to a browser that is not signed in', async () => {
    mockGetDisplayAuth.mockResolvedValue(null);
    const body = await (await get()).json();
    expect(body).toEqual({ tracks: [], provider: false });
  });
});
