import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { syncCardDAVBirthdays } from '@/lib/services/carddav-birthday-sync';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

/**
 * POST /api/caldav/sync-birthdays
 * Manually re-run CardDAV birthday sync. Reads creds from whichever
 * CalDAV source row was flagged with contactBirthdaysEnabled at connect
 * time. Returns 200 with { synced, errors } regardless of whether any
 * rows changed, or 400 if no contact-enabled source is configured.
 */
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const result = await syncCardDAVBirthdays();
    if (result.synced > 0) await invalidateEntity('birthdays');
    return NextResponse.json(result);
  } catch (err) {
    logError('CardDAV birthday sync failed', err);
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 },
    );
  }
}
