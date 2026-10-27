/**
 * Which named screen is this browser? (#690)
 *
 * A parent names a screen once, from the screen itself. That creates a
 * `displays` row, and the browser keeps a cookie holding the row's id. The
 * cookie is signed with SESSION_SECRET, so a device cannot claim to be another
 * screen by writing an id into its own cookie.
 *
 * This is identity only. It grants nothing: the trusted-device cookie in
 * authWall.ts is what exempts a screen from the sign-in wall, and the two are
 * kept apart so that forgetting a screen's name never locks it out, and naming
 * a phone never trusts it.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';

export const DISPLAY_COOKIE = 'prism_display';

/**
 * Readable marker that this browser is named, so the client only sends a
 * heartbeat from screens that have a row. It carries no id and grants nothing.
 */
export const DISPLAY_MARKER_COOKIE = 'prism_display_named';

/** Kept as long as the trusted-device cookie: a wall screen is named for years. */
export const DISPLAY_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5;

export const DISPLAY_NAME_MAX_LENGTH = 60;

/** A screen whose heartbeat is older than this shows as offline. */
export const DISPLAY_ONLINE_WINDOW_MS = 5 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDisplayId(id: string): boolean {
  return UUID_RE.test(id);
}

function mac(payload: string): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is required to sign display tokens');
  // Prefixed so a display token's MAC can never double as a trusted-device one.
  return createHmac('sha256', s).update(`display:${payload}`).digest('hex');
}

export function issueDisplayToken(displayId: string): string {
  const payload = `d1.${displayId}`;
  return `${payload}.${mac(payload)}`;
}

/** The display id a token was issued for, or null if it is missing, malformed or forged. */
export function readDisplayToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [version, id, given] = parts as [string, string, string];
  if (version !== 'd1' || !isDisplayId(id) || !given) return null;

  let expected: string;
  try {
    expected = mac(`${version}.${id}`);
  } catch {
    return null;
  }
  const a = Buffer.from(given, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

/** The id in this request's display cookie, without checking the row still exists. */
export async function currentDisplayId(): Promise<string | null> {
  try {
    const store = await cookies();
    return readDisplayToken(store.get(DISPLAY_COOKIE)?.value);
  } catch {
    return null;
  }
}

export type DisplayRow = typeof displays.$inferSelect;

/** This browser's display row, or null if it was never named or has since been removed. */
export async function currentDisplay(): Promise<DisplayRow | null> {
  const id = await currentDisplayId();
  if (!id) return null;
  const [row] = await db.select().from(displays).where(eq(displays.id, id));
  return row ?? null;
}

/** Trimmed name, or null when it is empty or too long. */
export function cleanDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name || name.length > DISPLAY_NAME_MAX_LENGTH) return null;
  return name;
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Point this browser at a display row, or (null) forget it. Secure only when
 * the request arrived over TLS, like the session cookies.
 */
export function setDisplayCookies(store: CookieStore, displayId: string | null, secure: boolean): void {
  const maxAge = displayId ? DISPLAY_MAX_AGE_SECONDS : 0;
  store.set(DISPLAY_COOKIE, displayId ? issueDisplayToken(displayId) : '', {
    httpOnly: true, secure, sameSite: 'lax', maxAge, path: '/',
  });
  store.set(DISPLAY_MARKER_COOKIE, displayId ? '1' : '', {
    httpOnly: false, secure, sameSite: 'lax', maxAge, path: '/',
  });
}

export function isOnline(lastSeenAt: Date | null, now = Date.now()): boolean {
  return lastSeenAt !== null && now - lastSeenAt.getTime() < DISPLAY_ONLINE_WINDOW_MS;
}
