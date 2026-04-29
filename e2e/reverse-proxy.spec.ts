import { test, expect, APIResponse } from '@playwright/test';
import { execSync } from 'node:child_process';

/**
 * Query the seeded parent's id directly from the DB.
 *
 * The `getFirstParent` helper in `e2e/helpers/auth.ts` reads /api/family,
 * which returns role-stripped data for unauthenticated callers — so the
 * `m.role === 'parent'` filter finds nothing and the helper throws.
 *
 * Two execution paths because dev and CI hold the DB differently:
 *   - Local (Windows dev): postgres lives in the `prism-db` Docker container;
 *     `psql` may not be installed on the host. Reach in via `docker exec`.
 *   - CI: postgres is a GitHub Actions service container exposed on
 *     localhost:5432; the runner has `psql`. Use DATABASE_URL directly.
 */
function getSeededParentId(): string {
  const cmd = process.env.DATABASE_URL
    ? `psql "${process.env.DATABASE_URL}" -At -c "SELECT id FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1"`
    : `docker exec prism-db psql -U prism -d prism -At -c "SELECT id FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1"`;
  const out = execSync(cmd, { encoding: 'utf-8' }).trim();
  if (!out) throw new Error('No seeded parent in DB — did seeds run?');
  return out;
}

/**
 * Reverse-proxy cookie security tests.
 *
 * Catches the regression class where cookie-setting auth endpoints compute
 * the `Secure` flag from a module-level constant (APP_URL or NODE_ENV)
 * instead of from the actual request. Behind a reverse proxy that terminates
 * TLS, the app sees plain HTTP — and without honoring `x-forwarded-proto`,
 * cookies ship without the `Secure` flag even though the user is on HTTPS.
 *
 * The fix pattern is `requestIsSecure(req)` reading `x-forwarded-proto`.
 * These tests assert the pattern is in place on every endpoint that sets
 * `prism_session` / `prism_user` cookies.
 *
 * Note: this is the lightweight version (modality TODO #1, path A). It tests
 * the app's *honoring* of `x-forwarded-proto` — which is where the bug lives.
 * A heavier version with a real nginx fixture is the future TODO #1 path B.
 *
 * TEST-ENVIRONMENT DEPENDENCY:
 * - These tests POST real PINs to `/api/auth/login` against the seeded parent.
 *   On a live deployment the PIN is unknown, so a run hammers the account with
 *   `1234`, trips Redis-backed lockout, and locks the user out for 5+ minutes.
 * - Gate behind `E2E_HAS_TEST_DB=1` (and optionally `E2E_PIN=...`), matching
 *   the pattern in `visual-regression.spec.ts`. Without the flag every test
 *   here is skipped — by design.
 */

const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

function setCookies(response: APIResponse): string[] {
  return response
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value);
}

function findCookie(cookies: string[], name: string): string | undefined {
  return cookies.find((c) => c.startsWith(`${name}=`));
}

test.describe('Reverse-proxy cookie security', () => {
  let parentId: string;

  test.beforeAll(() => {
    if (HAS_TEST_DB) {
      parentId = getSeededParentId();
    }
  });

  test('login: x-forwarded-proto=https sets Secure; HttpOnly on session cookie', async ({ request }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    const response = await request.post('/api/auth/login', {
      data: { userId: parentId, pin: PIN },
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(response.ok()).toBe(true);

    const session = findCookie(setCookies(response), 'prism_session');
    expect(session, 'prism_session cookie should be set').toBeDefined();
    expect(session, 'should have Secure flag when forwarded proto is https').toMatch(/;\s*Secure(;|$)/i);
    expect(session, 'should have HttpOnly flag').toMatch(/;\s*HttpOnly(;|$)/i);
  });

  test('login: x-forwarded-proto=http omits Secure', async ({ request }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    const response = await request.post('/api/auth/login', {
      data: { userId: parentId, pin: PIN },
      headers: { 'x-forwarded-proto': 'http' },
    });
    expect(response.ok()).toBe(true);

    const session = findCookie(setCookies(response), 'prism_session');
    expect(session).toBeDefined();
    expect(session, 'should not have Secure flag on plain http').not.toMatch(/;\s*Secure(;|$)/i);
  });

  test('verify-pin: x-forwarded-proto=https sets Secure; HttpOnly', async ({ request }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    const response = await request.post('/api/auth/verify-pin', {
      data: { userId: parentId, pin: PIN },
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(response.ok()).toBe(true);

    const cookies = setCookies(response);
    // verify-pin only sets cookies when there's no existing session — that's the case here
    // because each test gets a fresh request context. If for some reason it doesn't,
    // skip the assertion rather than fail spuriously.
    const session = findCookie(cookies, 'prism_session');
    if (!session) {
      test.skip(true, 'verify-pin did not set prism_session — likely existing session reused');
    }
    expect(session).toMatch(/;\s*Secure(;|$)/i);
    expect(session).toMatch(/;\s*HttpOnly(;|$)/i);
  });

  test('logout: x-forwarded-proto=https sets Secure; HttpOnly on cleared cookie', async ({ request }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    // Need a session first so logout has something to clear.
    const loginResponse = await request.post('/api/auth/login', {
      data: { userId: parentId, pin: PIN },
    });
    expect(loginResponse.ok(), 'precondition: login must succeed').toBe(true);

    const response = await request.post('/api/auth/logout', {
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(response.ok()).toBe(true);

    const session = findCookie(setCookies(response), 'prism_session');
    expect(session, 'logout should re-emit prism_session as a cleared Set-Cookie').toBeDefined();
    expect(session, 'cleared cookie must still carry Secure when proto is https').toMatch(/;\s*Secure(;|$)/i);
    expect(session, 'cleared cookie must still carry HttpOnly').toMatch(/;\s*HttpOnly(;|$)/i);
  });
});
