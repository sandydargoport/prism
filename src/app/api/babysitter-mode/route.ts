import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import {
  BABYSITTER_MODE_KEY,
  getBabysitterModeState,
  type BabysitterModeState,
} from '@/lib/services/babysitterMode';

export async function GET() {
  try {
    return NextResponse.json(await getBabysitterModeState());
  } catch (error) {
    logError('Error fetching babysitter mode state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch babysitter mode state' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Reuse the same permission as away mode
  const forbidden = requireRole(auth, 'canToggleAwayMode');
  if (forbidden) return forbidden;

  const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
  const limited = await rateLimitGuard(auth.userId, 'babysitter-mode', 10, 60);
  if (limited) return limited;

  try {
    const body = await request.json();
    const enabled = Boolean(body.enabled);

    const newState: BabysitterModeState = enabled
      ? {
          enabled: true,
          enabledAt: new Date().toISOString(),
          enabledBy: auth.userId,
        }
      : {
          enabled: false,
          enabledAt: null,
          enabledBy: null,
        };

    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, BABYSITTER_MODE_KEY));

    if (existing) {
      await db
        .update(settings)
        .set({ value: newState, updatedAt: new Date() })
        .where(eq(settings.key, BABYSITTER_MODE_KEY));
    } else {
      await db.insert(settings).values({ key: BABYSITTER_MODE_KEY, value: newState });
    }

    logActivity({
      userId: auth.userId,
      action: 'toggle',
      entityType: 'setting',
      entityId: BABYSITTER_MODE_KEY,
      summary: enabled ? 'Enabled babysitter mode' : 'Disabled babysitter mode',
    });

    return NextResponse.json(newState);
  } catch (error) {
    logError('Error toggling babysitter mode:', error);
    return NextResponse.json(
      { error: 'Failed to toggle babysitter mode' },
      { status: 500 }
    );
  }
}
