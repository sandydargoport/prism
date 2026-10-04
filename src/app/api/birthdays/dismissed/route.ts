/**
 * GET /api/birthdays/dismissed
 *
 * Birthdays removed in Prism. Each row is the tombstone that stops calendar
 * and contact sync from re-adding the entry, keyed on the normalised name and
 * month/day (see dismissedBirthdays). Settings lists them so a removal can be
 * undone. Parents only, like the delete itself.
 */

import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { dismissedBirthdays } from '@/lib/db/schema';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  return withAuth(async () => {
    try {
      const dismissed = await db
        .select({
          id: dismissedBirthdays.id,
          name: dismissedBirthdays.normalizedName,
          month: dismissedBirthdays.birthMonth,
          day: dismissedBirthdays.birthDay,
          eventType: dismissedBirthdays.eventType,
        })
        .from(dismissedBirthdays)
        .orderBy(asc(dismissedBirthdays.normalizedName));
      return NextResponse.json({ dismissed });
    } catch (error) {
      logError('Error listing removed birthdays:', error);
      return NextResponse.json({ error: 'Failed to list removed birthdays' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}
