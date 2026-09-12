/**
 * The optional authentication wall (#339).
 *
 * Prism serves data to unauthenticated callers by design, which is right for a
 * screen on a kitchen wall and wrong for an instance reachable from anywhere
 * else. `getDisplayAuth()` falls back to a configured display identity when
 * there is no session, and every read endpoint uses it, so on a normally
 * configured instance any device that can reach the port can read the family's
 * calendar, messages, tasks and lists with no credential at all.
 *
 * This module holds the switch and the one exception to it.
 *
 * Default off. Turning it on changes a wall display from "walk up and read it"
 * to "walk up and sign in", which is the wrong default for the device Prism is
 * built for. The households that need it are the ones exposing an instance
 * beyond their own network.
 *
 * The gate itself lives in two places, and both are needed:
 *   - `getDisplayAuth()` stops handing out the implicit identity. This is the
 *     lock. Without it the rest is decoration, because the API keeps answering.
 *   - `proxy.ts` redirects unauthenticated page requests to sign-in, so a
 *     browser gets a sign-in page instead of an empty dashboard.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Marks a device as one that may keep the implicit display identity while the
 * wall is on — the kitchen screen, in practice. Not httpOnly-sensitive in the
 * usual way: it carries no identity of its own, it only says "this browser was
 * trusted by a parent", and the value is signed so it cannot be invented.
 */
export const TRUSTED_DEVICE_COOKIE = 'prism_trusted_device';

/** A wall display is trusted until someone untrusts it. */
export const TRUSTED_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5;

type SecuritySetting = {
  authWall?: { enabled?: boolean };
};

/**
 * Is the wall switched on?
 *
 * Reads the existing `security` settings row rather than adding a key of its
 * own, so it sits with the other security toggles. Absent means off, and any
 * failure reading it also means off: a database blip must not lock a household
 * out of its own kitchen display.
 */
export async function isAuthWallEnabled(): Promise<boolean> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'security'));
    const value = row?.value as SecuritySetting | undefined;
    return value?.authWall?.enabled === true;
  } catch {
    return false;
  }
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is required to sign trusted-device tokens');
  return s;
}

/**
 * Signed marker for a trusted device. There is no per-device identity to store,
 * so the token is simply a version tag and an HMAC over it. Rotating
 * SESSION_SECRET invalidates every trusted device, which is the behaviour you
 * want from a secret rotation.
 */
export function issueTrustedDeviceToken(): string {
  const payload = 'v1';
  const mac = createHmac('sha256', secret()).update(payload).digest('hex');
  return `${payload}.${mac}`;
}

export function verifyTrustedDeviceToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, mac] = token.split('.');
  if (payload !== 'v1' || !mac) return false;

  let expected: string;
  try {
    expected = createHmac('sha256', secret()).update(payload).digest('hex');
  } catch {
    return false;
  }

  const a = Buffer.from(mac, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Does the current request come from a device a parent marked as trusted? */
export async function isTrustedDevice(): Promise<boolean> {
  try {
    const store = await cookies();
    return verifyTrustedDeviceToken(store.get(TRUSTED_DEVICE_COOKIE)?.value);
  } catch {
    return false;
  }
}

/**
 * Should this request still be given the implicit display identity?
 *
 * Wall off: yes, which is today's behaviour unchanged.
 * Wall on: only from a trusted device, so the kitchen screen keeps working
 * while everything else has to sign in.
 */
export async function implicitIdentityAllowed(): Promise<boolean> {
  if (!(await isAuthWallEnabled())) return true;
  return isTrustedDevice();
}
