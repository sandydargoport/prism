import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { settings, users } from '@/lib/db/schema';
import { eq, sql, asc } from 'drizzle-orm';

export async function POST() {
  try {
    // Guard: setup cannot be "finished" with no family members. A completed
    // marker with zero users bricks the install — login has nobody to select,
    // so the PIN pad never appears and there's no way back into the wizard.
    // This is the server-side backstop for the client's own check; it makes
    // the locked-out state impossible regardless of how /complete is called.
    const memberRows = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .orderBy(asc(users.sortOrder), asc(users.createdAt));
    if (memberRows.length === 0) {
      return NextResponse.json(
        { error: 'Add at least one family member before finishing setup.' },
        { status: 400 }
      );
    }

    // Default the logged-out wall dashboard to show the primary parent's view.
    // Without this, a brand-new install has no `displayUserId`, so an
    // unauthenticated dashboard renders an EMPTY calendar even after the family
    // synced one — they set everything up and see nothing until someone PINs in
    // or digs into Settings. Pick the first parent (falling back to the first
    // member), and only when the user hasn't already chosen one, so re-running
    // setup or an explicit "None" choice is never clobbered.
    const [displaySetting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'displayUserId'));
    if (!displaySetting) {
      const primary = memberRows.find((m) => m.role === 'parent') ?? memberRows[0]!;
      await db.insert(settings).values({ key: 'displayUserId', value: primary.id });
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
