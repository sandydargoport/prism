import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

const AWAY_MODE_KEY = 'awayMode';

interface AwayModeState {
  enabled: boolean;
  enabledAt: string | null;
  enabledBy: string | null;
  // When it was last switched off. Clients auto-activate from their own
  // localStorage idle clock, which is per-browser, so without a shared "a human
  // just turned this off" timestamp any long-idle tab re-enables Away Mode for
  // the whole house within a minute of someone dismissing it.
  disabledAt?: string | null;
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
        disabledAt: null,
      });
    }

    const state = row.value as AwayModeState;
    return NextResponse.json(state);
  } catch (error) {
    logError('Error fetching away mode state:', error);
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

    // Auto-activation can only enable, not disable.
    // Manual control requires authentication.
    // Auto-activation validates same-origin to prevent external triggering via the public tunnel.
    let authUserId: string | null = null;
    if (!autoActivated || !enabled) {
      // Manual toggle — always requires auth
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;

      const forbidden = requireRole(auth, 'canToggleAwayMode');
      if (forbidden) return forbidden;

      const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
      const limited = await rateLimitGuard(auth.userId, 'away-mode', 10, 60);
      if (limited) return limited;

      authUserId = auth.userId;
    } else {
      // Auto-activation: only allow requests from the same host (i.e. the dashboard browser).
      // Non-browser clients (curl, external fetch) have no Origin header or a mismatched one.
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');
      if (!origin) {
        // No Origin header — non-browser client, require full auth
        const auth = await requireAuth();
        if (auth instanceof NextResponse) return auth;
        const forbidden = requireRole(auth, 'canToggleAwayMode');
        if (forbidden) return forbidden;
        authUserId = auth.userId;
      } else if (host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
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
          disabledAt: new Date().toISOString(),
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

    logActivity({
      userId: authUserId,
      action: 'toggle',
      entityType: 'setting',
      entityId: AWAY_MODE_KEY,
      summary: enabled ? 'Enabled away mode' : 'Disabled away mode',
    });

    return NextResponse.json(newState);
  } catch (error) {
    logError('Error toggling away mode:', error);
    return NextResponse.json(
      { error: 'Failed to toggle away mode' },
      { status: 500 }
    );
  }
}
