import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { AWAY_AUTO_AFTER_KEY, isAwayAutoHours } from '@/lib/awayMode/autoAfter';

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

/** The household's hours before Away turns itself on, or null if nobody chose (#1159). */
async function readAutoAfter(): Promise<number | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, AWAY_AUTO_AFTER_KEY));
  return row && isAwayAutoHours(row.value) ? row.value : null;
}

export async function GET() {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, AWAY_MODE_KEY));
    // Every screen reads it here, with the state it already polls.
    const autoAfterHours = await readAutoAfter();

    if (!row) {
      return NextResponse.json({
        enabled: false,
        enabledAt: null,
        enabledBy: null,
        disabledAt: null,
        autoAfterHours,
      });
    }

    const state = row.value as AwayModeState;
    return NextResponse.json({ ...state, autoAfterHours });
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
      } else {
        // Matching headers prove little: a non-browser caller can set both.
        // So the caller must also be this install's screen or a person (#809),
        // the Host must be there and match, and auto-activation is limited.
        try {
          if (!host || new URL(origin).host !== host) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const display = await getDisplayAuth();
        if (!display) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
        const limited = await rateLimitGuard('household', 'away-mode-auto', 6, 60);
        if (limited) return limited;
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

/**
 * Set how long the house goes untouched before Away turns itself on (#1159).
 * A parent sets it. A screen may also offer the value its browser kept from
 * before (`carryOver`), which is kept only while the household has none, so it
 * can never change a choice someone made.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const hours = body?.autoAfterHours;
    if (!isAwayAutoHours(hours)) {
      return NextResponse.json({ error: 'autoAfterHours must be one of the offered choices' }, { status: 400 });
    }
    const carryOver = body?.carryOver === true;

    let authUserId: string | null = null;
    if (carryOver) {
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');
      try {
        if (!origin || !host || new URL(origin).host !== host) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const display = await getDisplayAuth();
      if (!display) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const current = await readAutoAfter();
      if (current !== null) return NextResponse.json({ autoAfterHours: current });
    } else {
      const auth = await requireAuth();
      if (auth instanceof NextResponse) return auth;
      const forbidden = requireRole(auth, 'canModifySettings');
      if (forbidden) return forbidden;
      authUserId = auth.userId;
    }

    const [existing] = await db.select().from(settings).where(eq(settings.key, AWAY_AUTO_AFTER_KEY));
    if (existing) {
      await db.update(settings).set({ value: hours, updatedAt: new Date() }).where(eq(settings.key, AWAY_AUTO_AFTER_KEY));
    } else {
      await db.insert(settings).values({ key: AWAY_AUTO_AFTER_KEY, value: hours });
    }

    logActivity({
      userId: authUserId,
      action: 'update',
      entityType: 'setting',
      entityId: AWAY_AUTO_AFTER_KEY,
      summary: hours === 0
        ? 'Away mode turns on only by hand'
        : `Away mode turns on after ${hours} hours untouched${carryOver ? ' (kept from a screen)' : ''}`,
    });

    return NextResponse.json({ autoAfterHours: hours });
  } catch (error) {
    logError('Error saving the away mode timer:', error);
    return NextResponse.json({ error: 'Failed to save the away mode timer' }, { status: 500 });
  }
}
