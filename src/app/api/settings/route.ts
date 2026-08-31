import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/services/auditLog';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import type { AuthResult } from '@/lib/auth';
import { logError } from '@/lib/utils/logError';
import { PIN_LENGTH_SETTING_KEY } from '@/lib/constants';
import { isSetupComplete } from '@/lib/setup';
import { getBuiltinTheme } from '@/lib/themes/appThemes';
import { isInstallableTheme } from '@/lib/themes/tokens';

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await db.select().from(settings);
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return NextResponse.json({ settings: result });
  } catch (error) {
    logError('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  let auth: AuthResult | null = null;

  try {
    const body = await request.json();

    if (!body.key || typeof body.key !== 'string') {
      return NextResponse.json(
        { error: 'key is required' },
        { status: 400 }
      );
    }

    if (body.value === undefined) {
      return NextResponse.json(
        { error: 'value is required' },
        { status: 400 }
      );
    }

    if (authResult instanceof NextResponse) {
      // Bootstrap exception, narrowly scoped to the family-wide PIN length.
      // The setup wizard's Family step lets a brand-new install choose this
      // *before* any parent account/session exists to authenticate as. Every
      // other setting still requires a parent session — but without this
      // carve-out, the wizard's PATCH here silently 401s, so the choice never
      // reaches the settings table. Member creation (/api/family, which
      // already has this same bootstrap allowance) then validates PINs
      // against the default length instead of what's on screen, letting a
      // too-short PIN save — and once the real value is later persisted,
      // that member's PIN can never satisfy the login pad again (lockout).
      const allowUnauthedSetup =
        body.key === PIN_LENGTH_SETTING_KEY && !(await isSetupComplete());
      if (!allowUnauthedSetup) return authResult;
      // auth stays null — proceed as an unauthenticated setup-bootstrap write.
    } else {
      auth = authResult;
      const forbidden = requireRole(auth, 'canModifySettings');
      if (forbidden) return forbidden;
    }

    // Per-key validation. This endpoint otherwise accepts any shape for any
    // key, and the theme row is read on the server and rendered into a <style>
    // element in the root layout — so an unchecked value there is not a bad
    // setting, it is markup in the page. Never trust the row on the render
    // path; refuse it on the way in as well.
    if (body.key === 'theme') {
      const value = (body.value ?? {}) as { paletteId?: unknown; installed?: unknown };

      // Installed themes are stored inline so a display without a network can
      // still render what it was left on. That means arbitrary colour values
      // reach a <style> element rendered on the server, so they are checked
      // here rather than trusted because they came from our own gallery.
      const installed = value.installed;
      if (installed !== undefined) {
        if (!Array.isArray(installed) || installed.length > 40) {
          return NextResponse.json({ error: 'Invalid installed themes' }, { status: 400 });
        }
        if (!installed.every(isInstallableTheme)) {
          return NextResponse.json({ error: 'Invalid installed theme' }, { status: 400 });
        }
      }

      // The chosen palette must be one that exists — built in, or one of the
      // installed themes in this same write.
      const paletteId = value.paletteId;
      if (paletteId !== undefined) {
        const known =
          typeof paletteId === 'string' &&
          (Boolean(getBuiltinTheme(paletteId)) ||
            (Array.isArray(installed) && installed.some((t) => (t as { id?: unknown }).id === paletteId)));
        if (!known) {
          return NextResponse.json({ error: 'Unknown palette' }, { status: 400 });
        }
      }
    }

    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, body.key));

    if (existing) {
      await db
        .update(settings)
        .set({ value: body.value, updatedAt: new Date() })
        .where(eq(settings.key, body.key));
    } else {
      await db
        .insert(settings)
        .values({ key: body.key, value: body.value });
    }

    if (auth) {
      logActivity({
        userId: auth.userId,
        action: existing ? 'update' : 'create',
        entityType: 'setting',
        summary: `Updated setting: ${body.key}`,
      });
    }

    // Invalidate related caches when specific settings change
    if (body.key === 'location') {
      await invalidateEntity('weather');
    }

    return NextResponse.json({ key: body.key, value: body.value });
  } catch (error) {
    logError('Error updating setting:', error);
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}
