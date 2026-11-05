/**
 * Everyday jobs without a PIN (#835).
 *
 * A household setting, "Require the PIN for every change", lives in the
 * `security` settings row as `requirePinForEveryChange`. Absent means on: an
 * existing install keeps asking for the PIN for everything until a parent turns
 * it off. Setup writes it off for a new install.
 *
 * When it is off, a signed-out wall may do the everyday jobs only: tick a
 * chore, a task or a shopping item, and add a shopping item. Each such change
 * is limited to 60 a minute across the household and written to the activity log.
 * Approving, points, editing, deleting and settings still need a signed-in
 * parent, because those routes keep calling requireAuth().
 *
 * The wall acts as the display identity (a guest), so it can never approve a
 * chore: an approval-required chore it ticks lands as pending.
 */
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { requireAuth, getDisplayAuth, type AuthResult } from './requireAuth';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { logActivity } from '@/lib/services/auditLog';

/**
 * Changes the signed-out walls may make in a minute, together. One bucket for
 * the household (#809): a per-screen key came from X-Forwarded-For, which any
 * caller sets, so a caller could start a fresh bucket with every request.
 */
export const WALL_CHANGES_PER_MINUTE = 60;

export type EverydayAuth = AuthResult & { wall?: true };

/** Is the PIN still required for every change? True unless a parent turned it off. */
export async function pinRequiredForEveryChange(): Promise<boolean> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'security'));
    const value = row?.value as { requirePinForEveryChange?: boolean } | undefined;
    return value?.requirePinForEveryChange !== false;
  } catch {
    // A database blip must not open the wall up: keep the PIN.
    return true;
  }
}

/** Which screen made the change, for the rate limit and the log. */
async function screenKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || h.get('x-real-ip') || 'unknown-screen';
}

/**
 * The caller for an everyday job: the signed-in person as usual, or, with the
 * PIN setting off, the wall itself. Anything else answers as requireAuth().
 */
export async function requireEverydayAuth(job: string): Promise<EverydayAuth | NextResponse> {
  const auth = await requireAuth();
  if (!(auth instanceof NextResponse)) return auth;
  if (auth.status !== 401) return auth;
  if (await pinRequiredForEveryChange()) return auth;

  const display = await getDisplayAuth();
  if (!display) return auth;

  const limited = await rateLimitGuard('wall:household', 'everyday', WALL_CHANGES_PER_MINUTE, 60);
  if (limited) return limited;

  return { ...display, wall: true };
}

/** Write a wall change to the activity log. */
export async function logWallChange(job: string, entityType: string, entityId: string, summary: string): Promise<void> {
  logActivity({
    userId: null,
    action: `wall_${job}`.slice(0, 50),
    entityType,
    entityId,
    summary: summary.slice(0, 500),
    metadata: { screen: await screenKey(), withoutPin: true },
  });
}
