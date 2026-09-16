import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import { isSettingsVerified } from '@/lib/auth/settingsAuth';
import { logError } from '@/lib/utils/logError';

/**
 * Whether the settings PIN gate can be satisfied at all.
 *
 * A PIN is optional at setup, so a household can finish the wizard with no
 * parent PIN anywhere. The gate then has no credential to check against and no
 * input can open it, which put the only screen that can set a PIN behind the
 * PIN itself (#481).
 *
 * One household-level bit, deliberately not a per-member list: it says whether
 * settings is defended, never who is undefended. See the note on the
 * unauthenticated branch of /api/family for why that distinction is kept.
 */
async function anyParentHasPin(): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'parent'), isNotNull(users.pin)))
    .limit(1);

  return !!row;
}

export async function GET() {
  try {
    const pinRequired = await anyParentHasPin();

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('prism_session')?.value;

    if (!sessionToken) {
      return NextResponse.json({ verified: false, pinRequired });
    }

    const verified = await isSettingsVerified(sessionToken);
    return NextResponse.json({ verified, pinRequired });
  } catch (error) {
    logError('Error checking settings verification:', error);
    // Fail closed. A failure to read the household must never be reported as
    // "no PIN is needed here".
    return NextResponse.json({ verified: false, pinRequired: true });
  }
}
