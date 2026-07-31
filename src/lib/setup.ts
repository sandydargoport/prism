import { db } from '@/lib/db/client';
import { settings, users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Whether first-run setup is truly finished.
 *
 * "Complete" requires BOTH the `setupComplete` marker AND at least one family
 * member. A marker with zero users is not a usable install: login has nobody
 * to show (the PIN pad only appears after selecting a member), so the family
 * would be locked out with no way back into the wizard. Treating that state as
 * *incomplete* keeps the setup bootstrap window open (unauthenticated member
 * creation) and routes the app back to /setup, so a stuck instance can recover
 * itself instead of needing database access.
 *
 * This is the single source of truth — the per-route helpers that used to
 * inline `SELECT ... WHERE key='setupComplete'` now all defer here.
 */
export async function isSetupComplete(): Promise<boolean> {
  try {
    const [marker] = await db
      .select({ key: settings.key })
      .from(settings)
      .where(eq(settings.key, 'setupComplete'));
    if (!marker) return false;

    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    return (rows[0]?.count ?? 0) > 0;
  } catch {
    return false;
  }
}
