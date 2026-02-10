import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const AWAY_MODE_KEY = 'awayMode';

interface AwayModeState {
  enabled: boolean;
  enabledAt: string | null;
  enabledBy: string | null;
  autoActivated?: boolean;
}

export async function GET() {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, AWAY_MODE_KEY));

    if (!row) {
      return NextResponse.json({
        enabled: false,
        enabledAt: null,
        enabledBy: null,
      });
    }

    const state = row.value as AwayModeState;
    return NextResponse.json(state);
  } catch (error) {
    console.error('Error fetching away mode state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch away mode state' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const enabled = Boolean(body.enabled);
    const autoActivated = Boolean(body.autoActivated);

    // Auto-activation can only enable, not disable
    // Manual control requires authentication
    if (!autoActivated || !enabled) {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;

      const forbidden = requireRole(auth, 'canToggleAwayMode');
      if (forbidden) return forbidden;
    }

    const newState: AwayModeState = enabled
      ? {
          enabled: true,
          enabledAt: new Date().toISOString(),
          enabledBy: autoActivated ? 'auto' : 'manual',
          autoActivated: autoActivated || undefined,
        }
      : {
          enabled: false,
          enabledAt: null,
          enabledBy: null,
        };

    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, AWAY_MODE_KEY));

    if (existing) {
      await db
        .update(settings)
        .set({ value: newState, updatedAt: new Date() })
        .where(eq(settings.key, AWAY_MODE_KEY));
    } else {
      await db.insert(settings).values({ key: AWAY_MODE_KEY, value: newState });
    }

    return NextResponse.json(newState);
  } catch (error) {
    console.error('Error toggling away mode:', error);
    return NextResponse.json(
      { error: 'Failed to toggle away mode' },
      { status: 500 }
    );
  }
}
