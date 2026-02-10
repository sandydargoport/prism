import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const BABYSITTER_MODE_KEY = 'babysitterMode';

interface BabysitterModeState {
  enabled: boolean;
  enabledAt: string | null;
  enabledBy: string | null;
}

export async function GET() {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, BABYSITTER_MODE_KEY));

    if (!row) {
      return NextResponse.json({
        enabled: false,
        enabledAt: null,
        enabledBy: null,
      });
    }

    const state = row.value as BabysitterModeState;
    return NextResponse.json(state);
  } catch (error) {
    console.error('Error fetching babysitter mode state:', error);
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

    return NextResponse.json(newState);
  } catch (error) {
    console.error('Error toggling babysitter mode:', error);
    return NextResponse.json(
      { error: 'Failed to toggle babysitter mode' },
      { status: 500 }
    );
  }
}
