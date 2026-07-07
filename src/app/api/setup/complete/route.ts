import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { settings, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    // Guard against a lockout: refuse to mark setup complete unless at least
    // one parent account exists. Otherwise setupComplete=true with zero users
    // leaves a login screen with no profiles and no way to add one, since
    // /api/family only allows unauthenticated member creation while setup is
    // still incomplete.
    const [parent] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'parent'))
      .limit(1);
    if (!parent) {
      return NextResponse.json(
        { error: 'Add at least one parent before finishing setup' },
        { status: 400 }
      );
    }

    // Idempotent upsert: concurrent calls (e.g. React strict-mode double-invoke
    // in dev, or a double-submit) must not race between SELECT and INSERT and
    // violate the settings_key_unique constraint.
    await db
      .insert(settings)
      .values({
        key: 'setupComplete',
        value: { completedAt: new Date().toISOString() },
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: { completedAt: new Date().toISOString() } },
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[setup/complete]', error);
    return NextResponse.json({ error: 'Failed to mark setup complete' }, { status: 500 });
  }
}
