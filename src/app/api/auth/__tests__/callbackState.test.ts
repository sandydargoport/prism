/**
 * The Microsoft To Do, Google Tasks and Gmail (bus) sign-in flows check the
 * OAuth `state` the way the photo and calendar flows do (#1221): the start
 * route stores a single-use nonce bound to the signed-in member, and the
 * callback refuses any state it did not issue before exchanging the code.
 */

// A Redis that keeps values the way the real one does.
const store = new Map<string, string>();
const fakeRedis = {
  setEx: jest.fn(async (k: string, _ttl: number, v: string) => { store.set(k, v); return 'OK'; }),
  get: jest.fn(async (k: string) => store.get(k) ?? null),
  del: jest.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
};
jest.mock('@/lib/cache/getRedisClient', () => ({ getRedisClient: jest.fn(async () => fakeRedis) }));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: 'parent-a', role: 'parent' }),
  requireRole: jest.fn().mockReturnValue(null),
}));
jest.mock('@/lib/integrations/credentialStore', () => ({
  getGoogleCredentials: jest.fn().mockResolvedValue({ clientId: 'cid', clientSecret: 'secret' }),
}));
jest.mock('@/lib/integrations/oauth-userinfo', () => ({
  fetchMicrosoftAccountEmail: jest.fn().mockResolvedValue(null),
  fetchGoogleAccountEmail: jest.fn().mockResolvedValue(null),
  fetchGmailAccountEmail: jest.fn().mockResolvedValue(null),
}));
const mockGmailExchange = jest.fn().mockRejectedValue(new Error('stop here'));
jest.mock('@/lib/integrations/gmail', () => ({
  getGmailAuthUrl: jest.fn(async (state: string) => `https://accounts.example/auth?state=${encodeURIComponent(state)}`),
  exchangeGmailCodeForTokens: (...a: unknown[]) => mockGmailExchange(...a),
}));
jest.mock('@/lib/db/client', () => ({ db: {} }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));

import { GET as msStart } from '../microsoft-tasks/route';
import { GET as msCallback } from '../microsoft-tasks/callback/route';
import { GET as gtStart } from '../google-tasks/route';
import { GET as gtCallback } from '../google-tasks/callback/route';
import { GET as busStart } from '../google-bus/route';
import { GET as busCallback } from '../google-bus/callback/route';

type Handler = (req: Request) => Promise<Response>;

const flows: Array<[string, Handler, Handler, string, () => number]> = [
  ['Microsoft To Do', msStart as Handler, msCallback as Handler, 'microsoft_state_mismatch', () => fetchSpy.mock.calls.length],
  ['Google Tasks', gtStart as Handler, gtCallback as Handler, 'google_tasks_state_mismatch', () => fetchSpy.mock.calls.length],
  ['Gmail for the bus', busStart as Handler, busCallback as Handler, 'gmail_state_mismatch', () => mockGmailExchange.mock.calls.length],
];

let fetchSpy: jest.SpyInstance;

beforeAll(() => {
  process.env.MICROSOFT_CLIENT_ID = 'cid';
  process.env.MICROSOFT_CLIENT_SECRET = 'secret';
});

beforeEach(() => {
  store.clear();
  mockGmailExchange.mockClear();
  fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('no', { status: 400 }));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

function stateFrom(res: Response): string {
  return new URL(res.headers.get('location')!).searchParams.get('state')!;
}

describe.each(flows)('%s sign-in state (#1221)', (_name, start, callback, mismatch, exchanges) => {
  it('refuses a state it did not issue and never exchanges the code', async () => {
    const forged = encodeURIComponent(JSON.stringify({ returnSection: 'tasks', taskListId: 'list-x' }));
    const res = await callback(new Request(`http://localhost/cb?code=abc&state=${forged}`));
    expect(res.headers.get('location')).toContain(`error=${mismatch}`);
    expect(exchanges()).toBe(0);
  });

  it('accepts the nonce its start route issued, once', async () => {
    const begun = await start(new Request('http://localhost/start?returnSection=integrations'));
    const state = stateFrom(begun);
    expect(state).toMatch(/^[0-9a-f-]{36}$/);

    const first = await callback(new Request(`http://localhost/cb?code=abc&state=${state}`));
    expect(first.headers.get('location')).not.toContain(mismatch);
    expect(exchanges()).toBe(1);

    const replay = await callback(new Request(`http://localhost/cb?code=abc&state=${state}`));
    expect(replay.headers.get('location')).toContain(`error=${mismatch}`);
    expect(exchanges()).toBe(1);
  });
});
