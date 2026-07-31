/**
 * Endpoint: /api/calendar-sources
 *
 * POST: Create a calendar source. Currently only iCal subscription sources
 *       are accepted here — Google sources are created automatically when
 *       their OAuth flow completes, and local calendars use POST /api/calendars.
 *
 * The setup wizard's CalendarStep posts to this endpoint, so during the
 * initial-setup window (before /api/setup/complete has been called) we
 * accept unauthenticated POSTs in the same way /api/family does. After
 * setup, callers must be a parent with canManageIntegrations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarSources } from '@/lib/db/schema';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { validatePublicUrl, UnsafeUrlError } from '@/lib/utils/safeFetch';
import { logError } from '@/lib/utils/logError';
import { syncIcalCalendarSource } from '@/lib/services/calendar-sync';
import { isGoogleCalendarWebLink, GOOGLE_WEB_LINK_ERROR } from '@/lib/utils/googleCalendarLink';
import { isSetupComplete } from '@/lib/setup';

function isValidIcalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'webcal:';
  } catch {
    return false;
  }
}

// webcal:// is just an iCal feed served over http(s); node-ical doesn't
// recognize the scheme, so we normalize it before storing.
function normalizeIcalUrl(url: string): string {
  if (url.startsWith('webcal://')) return 'https://' + url.slice('webcal://'.length);
  return url;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  const isAuthed = !(authResult instanceof NextResponse);
  if (!isAuthed) {
    const allowUnauthedSetup = !(await isSetupComplete());
    if (!allowUnauthedSetup) return authResult;
  } else {
    const forbidden = requireRole(authResult, 'canManageIntegrations');
    if (forbidden) return forbidden;
  }

  // Rate-limit by user when authed, otherwise by a setup-mode bucket. The
  // unauthenticated setup path is open by design but should not let a
  // remote caller submit URLs in a tight loop, each of which triggers an
  // outbound fetch.
  const limitKey = isAuthed ? authResult.userId : 'setup-anon';
  const rateLimited = await rateLimitGuard(limitKey, 'calendar-sources:create', 20, 60);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();

    if (body.type && body.type !== 'ical') {
      return NextResponse.json(
        { error: `Unsupported source type "${body.type}"; only "ical" is currently supported here` },
        { status: 400 }
      );
    }

    if (!body.url || typeof body.url !== 'string' || !isValidIcalUrl(body.url)) {
      return NextResponse.json(
        { error: 'A valid http, https, or webcal URL is required' },
        { status: 400 }
      );
    }

    const icalUrl = normalizeIcalUrl(body.url.trim());

    if (isGoogleCalendarWebLink(icalUrl)) {
      return NextResponse.json({ error: GOOGLE_WEB_LINK_ERROR }, { status: 400 });
    }

    // SSRF guard: a setup-mode caller (unauthenticated by design) or a
    // compromised parent could otherwise submit an internal hostname and
    // use Prism as a proxy to probe the home network. Reject loopback,
    // RFC1918, link-local, cloud metadata IP, and IPv6 ULA / loopback
    // before any outbound fetch happens.
    try {
      validatePublicUrl(icalUrl);
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        return NextResponse.json(
          { error: 'iCal URL points at a private or loopback address' },
          { status: 400 }
        );
      }
      throw err;
    }

    const displayName = (typeof body.name === 'string' ? body.name : '').trim() || 'iCal Calendar';

    const [created] = await db
      .insert(calendarSources)
      .values({
        provider: 'ical',
        sourceCalendarId: `ical_${Date.now()}`,
        dashboardCalendarName: displayName,
        displayName,
        icalUrl,
        enabled: true,
        // iCal subscriptions are read-only; don't offer them as create-event targets.
        showInEventModal: false,
      })
      .returning();

    if (!created) {
      return NextResponse.json(
        { error: 'Failed to create calendar source' },
        { status: 500 }
      );
    }

    // Initial sync runs in the background — don't block the response.
    // Errors here just get logged; persistent failures will surface on the
    // calendar source's syncErrors field on subsequent scheduled syncs.
    void syncIcalCalendarSource(created.id)
      .then(() => invalidateEntity('events'))
      .catch((err) => {
        logError(`[calendar-sources] initial sync for ${created.id} failed:`, err);
      });

    return NextResponse.json(
      {
        id: created.id,
        provider: created.provider,
        displayName: created.displayName,
        icalUrl: created.icalUrl,
        enabled: created.enabled,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    logError('Error creating calendar source:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar source' },
      { status: 500 }
    );
  }
}
