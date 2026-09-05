/**
 * The health check behind the "Sync paused" badge.
 *
 * Two properties matter more than the count itself. It must stay silent about
 * *which* calendars — a wall display is a public surface and the badge is read
 * by whoever walks past, so names and account addresses must never reach the
 * client. And it must never take the calendar down with it: a failing health
 * check is a cosmetic problem, and answering "all healthy" is the right way to
 * fail, because a calendar that renders is worth more than a warning badge.
 */
const mockDisplayAuth = jest.fn();
const mockRows = jest.fn();

jest.mock('@/lib/auth', () => ({
  getDisplayAuth: (...a: unknown[]) => mockDisplayAuth(...a),
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => mockRows() }) }),
  },
}));
jest.mock('@/lib/db/schema', () => ({
  calendarSources: { provider: 'p', syncErrors: 'se', enabled: 'en' },
}));
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET } from '../sync-health/route';

const stalled = (provider: string) => ({ provider, syncErrors: { needsReauth: true } });
const healthy = (provider: string) => ({ provider, syncErrors: null });

beforeEach(() => {
  jest.clearAllMocks();
  mockDisplayAuth.mockResolvedValue({ userId: 'u1' });
});

describe('GET /api/calendars/sync-health', () => {
  it('counts only the sources flagged for re-auth', async () => {
    mockRows.mockResolvedValue([stalled('google'), healthy('google'), stalled('google')]);

    const body = await (await GET()).json();

    expect(body.needsReauth).toBe(2);
  });

  it('reports each provider once, however many of its calendars are stalled', async () => {
    mockRows.mockResolvedValue([stalled('google'), stalled('google'), stalled('caldav')]);

    const body = await (await GET()).json();

    expect(body.needsReauth).toBe(3);
    expect(body.providers.sort()).toEqual(['caldav', 'google']);
  });

  it('says nothing is wrong when every source is syncing', async () => {
    mockRows.mockResolvedValue([healthy('google'), healthy('microsoft')]);

    const body = await (await GET()).json();

    expect(body).toEqual({ needsReauth: 0, providers: [] });
  });

  it('treats a syncErrors object without needsReauth as healthy', async () => {
    // Sync writes other things into this column — supportsEvents, transient
    // failure counts. Only an explicit needsReauth means the grant is dead.
    mockRows.mockResolvedValue([
      { provider: 'caldav', syncErrors: { supportsEvents: false } },
      { provider: 'google', syncErrors: { lastError: 'timeout' } },
    ]);

    const body = await (await GET()).json();

    expect(body.needsReauth).toBe(0);
  });

  it('never returns calendar names or account addresses', async () => {
    mockRows.mockResolvedValue([
      {
        provider: 'google',
        displayName: 'Some Household Calendar',
        accountEmail: 'someone@example.com',
        syncErrors: { needsReauth: true },
      },
    ]);

    const body = await (await GET()).json();

    expect(Object.keys(body).sort()).toEqual(['needsReauth', 'providers']);
    expect(JSON.stringify(body)).not.toContain('example.com');
    expect(JSON.stringify(body)).not.toContain('Household');
  });

  it('answers "all healthy" to an unauthenticated caller', async () => {
    mockDisplayAuth.mockResolvedValue(null);

    const body = await (await GET()).json();

    expect(body).toEqual({ needsReauth: 0, providers: [] });
    expect(mockRows).not.toHaveBeenCalled();
  });

  it('degrades to "all healthy" rather than erroring when the query fails', async () => {
    mockRows.mockRejectedValue(new Error('connection refused'));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ needsReauth: 0, providers: [] });
  });
});
