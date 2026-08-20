import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { logError } from '@/lib/utils/logError';
import { listTombstones, removeTombstone } from '@/lib/services/settingsTombstone';
import { DISMISSED_GOOGLE_CALENDARS_KEY } from '@/lib/integrations/google-calendar';

/**
 * Removed (tombstoned) Google calendars — the ones a user deleted from Prism,
 * which discovery skips so they don't come back on re-auth.
 *
 *   GET           → { removed: [{ id, name }] }
 *   POST { id }   → clear that tombstone. The calendar is re-discovered on the
 *                   next Google re-authentication.
 *
 * The GET/POST {id} contract is deliberately entity-agnostic so a photos/events
 * "restore" surface can reuse the same shape and UI.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const removed = await listTombstones(DISMISSED_GOOGLE_CALENDARS_KEY);
    return NextResponse.json({ removed });
  } catch (error) {
    logError('Error listing removed calendars:', error);
    return NextResponse.json({ error: 'Failed to list removed calendars' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const { id } = await request.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await removeTombstone(DISMISSED_GOOGLE_CALENDARS_KEY, id);
    return NextResponse.json({ restored: true });
  } catch (error) {
    logError('Error restoring calendar:', error);
    return NextResponse.json({ error: 'Failed to restore calendar' }, { status: 500 });
  }
}
