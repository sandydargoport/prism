/**
 * @jest-environment node
 *
 * The live endpoint says whether a live provider feeds the household, so the
 * widget knows never to fall back to the email view. Sent with the first load
 * only. Its tracks carry only the vehicle fields the card shows (#1224).
 */
import { NextRequest } from 'next/server';

let providerTrips: unknown[] = [];
let trackRows: unknown[] = [];
const mockGetDisplayAuth = jest.fn();

/**
 * A query builder that answers the provider check (the only `.limit(1)` query)
 * and today's tracks (the only select of `{ track, route }`), and nothing else.
 */
function query(shape?: Record<string, unknown>) {
  const tracks = !!shape && 'track' in shape;
  let limited = false;
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'innerJoin', 'where', 'orderBy', 'groupBy']) chain[m] = () => chain;
  chain.limit = (n: number) => { limited = n === 1; return chain; };
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(limited ? providerTrips : tracks ? trackRows : []).then(resolve, reject);
  return chain;
}

jest.mock('@/lib/db/client', () => ({ db: { select: (shape?: Record<string, unknown>) => query(shape) } }));
jest.mock('@/lib/auth', () => ({ getDisplayAuth: () => mockGetDisplayAuth() }));
jest.mock('@/lib/auth/everydayAuth', () => ({ screenOrPerson: () => mockGetDisplayAuth() }));
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
  trackRows = [];
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

describe('GET /api/bus-tracking/live: vehicle (#1224)', () => {
  it('sends only the number, colour and substitute / changed-today flags, never the plate, model or reported driver', async () => {
    trackRows = [{
      track: {
        id: 't1', routeId: 'r1', direction: 'AM', label: null, status: 'active',
        vehicle: {
          number: '42', plate: 'EXAMPLE-1', color: 'yellow', model: 'Example Coach',
          driverName: 'Pat Example', substitute: true, changedMidDay: false,
        },
        stops: [], progress: null, plannedStart: null, plannedEnd: null, lastFixAt: null,
      },
      route: { id: 'r1', label: 'Route 1', direction: 'AM', stopName: null },
    }];
    const body = await (await get()).json();
    expect(body.tracks).toHaveLength(1);
    expect(body.tracks[0].vehicle).toEqual({
      number: '42', color: 'yellow', substitute: true, changedMidDay: false,
    });
    expect(JSON.stringify(body)).not.toContain('EXAMPLE-1');
    expect(JSON.stringify(body)).not.toContain('Example Coach');
    // The driver still reaches the card, as driverLabel.
    expect(body.tracks[0].driverLabel).toBeTruthy();
  });
});
