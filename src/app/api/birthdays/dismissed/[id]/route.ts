/**
 * DELETE /api/birthdays/dismissed/[id]
 *
 * Undo a birthday removal: drop its tombstone, then re-run calendar detection
 * so an entry that is still in a calendar comes back now rather than on the
 * next sync. One that came from nowhere (added by hand or by the demo seed)
 * stays gone, since there is nothing left to detect it from.
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { dismissedBirthdays } from '@/lib/db/schema';
import { detectBirthdaysFromEvents } from '@/lib/services/birthday-detect';
import { logError } from '@/lib/utils/logError';

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const [restored] = await db
        .delete(dismissedBirthdays)
        .where(eq(dismissedBirthdays.id, id))
        .returning({ id: dismissedBirthdays.id });
      if (!restored) {
        return NextResponse.json({ error: 'Removed birthday not found' }, { status: 404 });
      }

      // The tombstone is gone either way; a failed re-detect only delays the
      // return until the next sync.
      try {
        await detectBirthdaysFromEvents();
      } catch (error) {
        logError('Birthday re-detect after restore failed:', error);
      }

      return NextResponse.json({ restored: restored.id });
    } catch (error) {
      logError('Error restoring birthday:', error);
      return NextResponse.json({ error: 'Failed to restore birthday' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}
