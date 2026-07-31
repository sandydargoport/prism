import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { settings, users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST() {
  try {
    // Guard: setup cannot be "finished" with no family members. A completed
    // marker with zero users bricks the install — login has nobody to select,
    // so the PIN pad never appears and there's no way back into the wizard.
    // This is the server-side backstop for the client's own check; it makes
    // the locked-out state impossible regardless of how /complete is called.
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    if ((countRows[0]?.count ?? 0) === 0) {
      return NextResponse.json(
        { error: 'Add at least one family member before finishing setup.' },
        { status: 400 }
      );
    }

    const existing = await db.select().from(settings).where(eq(settings.key, 'setupComplete'));
    if (existing.length > 0) {
      await db.update(settings)
        .set({ value: { completedAt: new Date().toISOString() } })
        .where(eq(settings.key, 'setupComplete'));
    } else {
      await db.insert(settings).values({
        key: 'setupComplete',
        value: { completedAt: new Date().toISOString() },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[setup/complete]', error);
    return NextResponse.json({ error: 'Failed to mark setup complete' }, { status: 500 });
  }
}
