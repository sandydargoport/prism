/**
 * Tests for GET /api/auth/settings-verified
 *
 * The route answers two separate questions, and the second one is what keeps a
 * household out of the lockout in #481: whether the settings PIN gate can be
 * satisfied by anybody at all. A PIN is optional at setup, so an instance can
 * exist with no parent PIN anywhere, and Settings is the only screen that can
 * set one.
 */

// --- DB mock: db.select().from().where().limit() resolves to `rows` ---
const mockLimit = jest.fn();
const mockWhere = jest.fn(() => ({ limit: mockLimit }));
const mockFrom = jest.fn(() => ({ where: mockWhere }));

jest.mock('@/lib/db/client', () => ({
  db: { select: jest.fn(() => ({ from: mockFrom })) },
}));

jest.mock('@/lib/db/schema', () => ({
  users: { id: 'id', role: 'role', pin: 'pin' },
}));

jest.mock('drizzle-orm', () => ({
  and: jest.fn(), eq: jest.fn(), isNotNull: jest.fn(),
}));

// --- Cookies mock ---
const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: (...a: unknown[]) => mockCookieGet(...a) }),
}));

// --- Settings verification window mock ---
const mockIsSettingsVerified = jest.fn();
jest.mock('@/lib/auth/settingsAuth', () => ({
  isSettingsVerified: (...a: unknown[]) => mockIsSettingsVerified(...a),
}));

jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET } from '../route';

/** No parent row comes back = no parent has a PIN. */
function withParentPin(exists: boolean) {
  mockLimit.mockResolvedValue(exists ? [{ id: 'parent-1' }] : []);
}

function withSession(token: string | null) {
  mockCookieGet.mockReturnValue(token ? { value: token } : undefined);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsSettingsVerified.mockResolvedValue(false);
});

describe('GET /api/auth/settings-verified', () => {
  it('reports pinRequired: false when no parent has a PIN', async () => {
    withParentPin(false);
    withSession('session-token');

    const body = await (await GET()).json();

    expect(body.pinRequired).toBe(false);
  });

  it('reports pinRequired: true when at least one parent has a PIN', async () => {
    withParentPin(true);
    withSession('session-token');

    const body = await (await GET()).json();

    expect(body.pinRequired).toBe(true);
  });

  it('still answers pinRequired with no session, which is the kiosk case', async () => {
    // The gate prompt is reached with no session at all, so an early return on
    // the missing cookie must not skip the household check.
    withParentPin(false);
    withSession(null);

    const body = await (await GET()).json();

    expect(body).toEqual({ verified: false, pinRequired: false });
    expect(mockIsSettingsVerified).not.toHaveBeenCalled();
  });

  it('reports verified within the 10-minute window, independently of pinRequired', async () => {
    withParentPin(true);
    withSession('session-token');
    mockIsSettingsVerified.mockResolvedValue(true);

    const body = await (await GET()).json();

    expect(body).toEqual({ verified: true, pinRequired: true });
  });

  it('fails closed when the household cannot be read', async () => {
    // A database failure reported as pinRequired: false would open Settings to
    // anyone, so the error path has to claim a PIN is needed.
    mockLimit.mockRejectedValue(new Error('db down'));
    withSession('session-token');

    const body = await (await GET()).json();

    expect(body).toEqual({ verified: false, pinRequired: true });
  });
});
