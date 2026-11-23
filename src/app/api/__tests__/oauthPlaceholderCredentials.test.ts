/**
 * @jest-environment node
 *
 * `.env.example` ships the Google and Microsoft client id and secret lines
 * uncommented, filled with placeholder text (#1253). A `.env` copied from it
 * and never edited must read as "not set up": the status endpoint the Settings
 * cards read says not configured, every Connect route sends the browser to
 * Prism's own setup prompt instead of the provider's sign-in page, and token
 * refresh never sends the placeholder to Microsoft.
 *
 * The placeholder values are read from `.env.example` itself, so this suite
 * follows the file if its wording ever changes.
 *
 * Credentials saved in Settings (the database) still win over the env file,
 * and a real-looking value in the env file still counts as configured.
 */
import fs from 'fs';
import path from 'path';

// --- database: one settings row per key, empty unless a test fills it ------
const dbRows: Record<string, Record<string, string>> = {};
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async (key: string) => (dbRows[key] ? [{ key, value: dbRows[key] }] : []),
      }),
    }),
  },
}));
jest.mock('@/lib/db/schema', () => ({ settings: { key: 'key', value: 'value' } }));
jest.mock('drizzle-orm', () => ({ eq: (_column: unknown, value: unknown) => value }));
jest.mock('@/lib/utils/crypto', () => ({
  decrypt: (v: string) => v,
  encrypt: (v: string) => v,
}));

jest.mock('@/lib/auth', () => ({
  getDisplayAuth: jest.fn().mockResolvedValue({ userId: 'parent-a', role: 'parent' }),
  requireAuth: jest.fn().mockResolvedValue({ userId: 'parent-a', role: 'parent' }),
  requireRole: jest.fn().mockReturnValue(null),
}));
jest.mock('@/lib/auth/oauthState', () => ({
  createOAuthState: jest.fn().mockResolvedValue('state-nonce'),
  consumeOAuthState: jest.fn().mockResolvedValue({ status: 'ok', payload: { returnSection: 'tasks' } }),
}));
jest.mock('@/lib/cache/getRedisClient', () => ({ getRedisClient: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/integrations/oauth-userinfo', () => ({
  fetchMicrosoftAccountEmail: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/householdTimezone', () => ({
  getHouseholdTimezone: jest.fn(async () => 'America/Chicago'),
}));

import { GET as oauthStatus } from '../integrations/oauth-status/route';
import { GET as microsoftPhotosStart } from '../auth/microsoft/route';
import { GET as microsoftTasksStart } from '../auth/microsoft-tasks/route';
import { GET as microsoftTasksCallback } from '../auth/microsoft-tasks/callback/route';
import { GET as googleStart } from '../auth/google/route';
import { GET as gmailStart } from '../auth/google-bus/route';
import { GET as googleTasksStart } from '../auth/google-tasks/route';
import { microsoftTodoProvider } from '@/lib/integrations/tasks/microsoft-todo';
import { microsoftTodoShoppingProvider } from '@/lib/integrations/shopping/microsoft-todo';
import { microsoftTodoWishItemProvider } from '@/lib/integrations/wish-items/microsoft-todo';

const OAUTH_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
] as const;
type OAuthKey = (typeof OAUTH_KEYS)[number];

/** The uncommented OAuth lines of `.env.example`, exactly as shipped. */
function readEnvExample(): Record<OAuthKey, string> {
  const text = fs.readFileSync(path.resolve(__dirname, '../../../../.env.example'), 'utf8');
  const found: Partial<Record<OAuthKey, string>> = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|MICROSOFT_CLIENT_ID|MICROSOFT_CLIENT_SECRET)=(.*)$/);
    if (m) found[m[1] as OAuthKey] = m[2]!.trim();
  }
  return found as Record<OAuthKey, string>;
}
const EXAMPLE = readEnvExample();

// Fictional stand-ins shaped like real credentials.
const REAL_LOOKING = {
  GOOGLE_CLIENT_ID: '123456789012-fictionalclientid.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-fictional-secret-value',
  MICROSOFT_CLIENT_ID: '00000000-1111-2222-3333-444444444444',
  MICROSOFT_CLIENT_SECRET: 'fictional~secret.value_0123456789',
};

const saved: Partial<Record<OAuthKey, string | undefined>> = {};
let fetchSpy: jest.SpyInstance;

beforeAll(() => {
  for (const k of OAUTH_KEYS) saved[k] = process.env[k];
});
afterAll(() => {
  for (const k of OAUTH_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function setEnv(values: Record<OAuthKey, string>) {
  for (const k of OAUTH_KEYS) process.env[k] = values[k];
}

beforeEach(() => {
  for (const key of Object.keys(dbRows)) delete dbRows[key];
  setEnv(EXAMPLE);
  fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 400 }));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const req = (url: string) => new Request(`http://localhost:3000${url}`);
const location = (res: Response) => res.headers.get('location') ?? '';

async function status(): Promise<{ google: boolean; microsoft: boolean }> {
  const res = await oauthStatus();
  expect(res.status).toBe(200);
  return res.json();
}

type Start = (req: Request) => Promise<Response>;
const connectRoutes: Array<[string, Start, string, 'google' | 'gmail' | 'microsoft']> = [
  ['Connect OneDrive (photos)', microsoftPhotosStart as Start, '/api/auth/microsoft', 'microsoft'],
  ['Connect Microsoft To Do', microsoftTasksStart as Start, '/api/auth/microsoft-tasks', 'microsoft'],
  ['Connect Google Calendar', googleStart as Start, '/api/auth/google', 'google'],
  ['Connect Gmail for the bus', gmailStart as Start, '/api/auth/google-bus', 'gmail'],
  ['Connect Google Tasks', googleTasksStart as Start, '/api/auth/google-tasks', 'google'],
];

const refreshers: Array<[string, () => Promise<unknown>]> = [
  ['To Do tasks', () => microsoftTodoProvider.refreshTokens!({ accessToken: 'at', refreshToken: 'rt' })],
  ['To Do shopping', () => microsoftTodoShoppingProvider.refreshTokens!({ accessToken: 'at', refreshToken: 'rt' })],
  ['To Do wish lists', () => microsoftTodoWishItemProvider.refreshTokens!({ accessToken: 'at', refreshToken: 'rt' })],
];

describe('the OAuth lines from .env.example, unedited (#1253)', () => {
  it('.env.example still ships all four lines this suite relies on', () => {
    for (const k of OAUTH_KEYS) expect(EXAMPLE[k]).toBeTruthy();
  });

  it('the status endpoint says neither Google nor Microsoft is configured', async () => {
    expect(await status()).toEqual({ google: false, microsoft: false });
  });

  it.each(connectRoutes)('%s goes to the setup prompt, not the provider', async (_name, start, url, provider) => {
    const res = await start(req(url));
    const to = location(res);
    expect(to).toContain(`/settings?section=integrations&setup=${provider}`);
    expect(to).not.toContain('login.microsoftonline.com');
    expect(to).not.toContain('accounts.google.com');
  });

  it('the To Do callback never sends the placeholder to Microsoft', async () => {
    const res = await (microsoftTasksCallback as Start)(req('/api/auth/microsoft-tasks/callback?code=abc&state=state-nonce'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(refreshers)('%s token refresh returns null without calling Microsoft', async (_name, refresh) => {
    expect(await refresh()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('blank OAuth values', () => {
  it.each([[''], ['   ']])('%j counts as not configured', async (blank) => {
    setEnv({ GOOGLE_CLIENT_ID: blank, GOOGLE_CLIENT_SECRET: blank, MICROSOFT_CLIENT_ID: blank, MICROSOFT_CLIENT_SECRET: blank });
    expect(await status()).toEqual({ google: false, microsoft: false });
    const res = await (microsoftTasksStart as Start)(req('/api/auth/microsoft-tasks'));
    expect(location(res)).toContain('setup=microsoft');
  });
});

describe('credentials saved in Settings win over the placeholders', () => {
  beforeEach(() => {
    dbRows['credentials.google'] = { clientId: 'settings-google-id.apps.googleusercontent.com', clientSecret: 'settings-google-secret' };
    dbRows['credentials.microsoft'] = { clientId: 'settings-microsoft-id', clientSecret: 'settings-microsoft-secret' };
  });

  it('the status endpoint says both are configured', async () => {
    expect(await status()).toEqual({ google: true, microsoft: true });
  });

  it('Connect OneDrive signs in with the saved client id', async () => {
    const to = new URL(location(await (microsoftPhotosStart as Start)(req('/api/auth/microsoft'))));
    expect(to.host).toBe('login.microsoftonline.com');
    expect(to.searchParams.get('client_id')).toBe('settings-microsoft-id');
  });

  it('Connect Google Calendar signs in with the saved client id', async () => {
    const to = new URL(location(await (googleStart as Start)(req('/api/auth/google'))));
    expect(to.host).toBe('accounts.google.com');
    expect(to.searchParams.get('client_id')).toBe('settings-google-id.apps.googleusercontent.com');
  });
});

describe('real credentials in the env file still count', () => {
  beforeEach(() => setEnv(REAL_LOOKING));

  it('the status endpoint says both are configured', async () => {
    expect(await status()).toEqual({ google: true, microsoft: true });
  });

  it.each([
    ['Connect OneDrive (photos)', microsoftPhotosStart as Start, '/api/auth/microsoft', REAL_LOOKING.MICROSOFT_CLIENT_ID],
    ['Connect Microsoft To Do', microsoftTasksStart as Start, '/api/auth/microsoft-tasks', REAL_LOOKING.MICROSOFT_CLIENT_ID],
    ['Connect Google Calendar', googleStart as Start, '/api/auth/google', REAL_LOOKING.GOOGLE_CLIENT_ID],
  ])('%s signs in with the env client id', async (_name, start, url, clientId) => {
    const to = new URL(location(await start(req(url))));
    expect(to.searchParams.get('client_id')).toBe(clientId);
  });

  it('To Do token refresh sends the env client pair to Microsoft', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ access_token: 'fresh', expires_in: 3600 }), { status: 200 }));
    expect(await microsoftTodoProvider.refreshTokens!({ accessToken: 'at', refreshToken: 'rt' })).not.toBeNull();
    expect(String(fetchSpy.mock.calls[0][1].body)).toContain(`client_id=${REAL_LOOKING.MICROSOFT_CLIENT_ID}`);
  });
});
