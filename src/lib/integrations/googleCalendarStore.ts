/**
 * Shared storage for a successful Google Calendar connection.
 *
 * Extracted from the fresh-connect branch of the OAuth callback so the manual
 * refresh-token path (OAuth Playground) stores calendars identically — same
 * encryption, same dismissed-calendar tombstones, same per-calendar upsert —
 * and the two paths can never drift.
 *
 * Never logs or returns token material.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { calendarSources } from '@/lib/db/schema';
import { encrypt } from '@/lib/utils/crypto';
import { fetchCalendarList, DISMISSED_GOOGLE_CALENDARS_KEY } from '@/lib/integrations/google-calendar';
import { tombstoneIdSet } from '@/lib/services/settingsTombstone';

export type GoogleTokenBundle = {
  /** Plaintext access token — encrypted inside this module before storage. */
  accessToken: string;
  /** Plaintext refresh token (or null) — encrypted inside this module. */
  refreshToken: string | null;
  /** Seconds until the access token expires, from the token response. */
  expiresIn: number;
};

export type StoreResult = {
  calendarCount: number;
  inserted: number;
  updated: number;
  skippedDismissed: number;
  /** The account email actually stored (resolved value, incl. the fallback). */
  accountEmail: string | null;
};

/**
 * Fetch the calendar list with `tokens.accessToken`, honor dismissed-calendar
 * tombstones, and upsert one `calendarSources` row per calendar with encrypted
 * tokens. Callers own their own audit logging (summaries differ).
 *
 * `accountEmail` is the best-effort value from userinfo; when null (a
 * Playground token often lacks the email scope) we fall back to the primary
 * calendar's id, which for Google *is* the account email.
 */
export async function storeGoogleCalendarConnection(params: {
  userId: string;
  tokens: GoogleTokenBundle;
  accountEmail: string | null;
  /**
   * The token carries calendar.readonly but not calendar.events, so it cannot
   * write to ANY calendar — including ones Google reports as owned. Per-calendar
   * accessRole describes the account's rights, not the token's, so it is the
   * wrong thing to gate on here and would leave these sources offering an event
   * form that fails on submit.
   */
  readOnly?: boolean;
}): Promise<StoreResult> {
  const { userId, tokens, readOnly = false } = params;

  const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
  const encryptedAccessToken = encrypt(tokens.accessToken);
  const encryptedRefreshToken = tokens.refreshToken ? encrypt(tokens.refreshToken) : null;

  const calendars = await fetchCalendarList(tokens.accessToken);

  // Fallback: Google's primary-calendar id is the account email.
  const primaryId = calendars.find((c) => c.primary)?.id;
  const accountEmail =
    params.accountEmail ?? (primaryId && primaryId.includes('@') ? primaryId : null);

  const dismissedSet = await tombstoneIdSet(DISMISSED_GOOGLE_CALENDARS_KEY);

  let inserted = 0;
  let updated = 0;
  let skippedDismissed = 0;

  for (const calendar of calendars) {
    if (dismissedSet.has(calendar.id)) {
      skippedDismissed++;
      continue;
    }

    const existing = await db.query.calendarSources.findFirst({
      where: (cs, { and, eq: eqInner }) =>
        and(eqInner(cs.provider, 'google'), eqInner(cs.sourceCalendarId, calendar.id)),
    });

    if (existing) {
      const prev = (existing.syncErrors as Record<string, unknown>) || {};
      await db
        .update(calendarSources)
        .set({
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken || existing.refreshToken,
          tokenExpiresAt,
          // Only overwrite the email when we resolved one, so a transient
          // userinfo failure doesn't blank an existing label.
          accountEmail: accountEmail ?? undefined,
          // Only forced in the read-only direction. Reconnecting with a
          // writable token must not silently re-tick a box the user turned
          // off; losing write access is a fact, hiding a calendar is a choice.
          ...(readOnly ? { showInEventModal: false } : {}),
          syncErrors: prev.userOverride ? { userOverride: true } : null,
          updatedAt: new Date(),
        })
        .where(eq(calendarSources.id, existing.id));
      updated++;
    } else {
      const calendarName = (calendar.summary || 'Untitled Calendar').slice(0, 255);
      const isWritable =
        !readOnly && (calendar.accessRole === 'writer' || calendar.accessRole === 'owner');
      await db.insert(calendarSources).values({
        userId,
        provider: 'google',
        sourceCalendarId: calendar.id,
        dashboardCalendarName: calendarName,
        displayName: calendarName,
        color: calendar.backgroundColor || undefined,
        // Calendars hidden in the user's Google list come in disabled.
        enabled: !calendar.hidden,
        showInEventModal: isWritable,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        accountEmail,
      });
      inserted++;
    }
  }

  return { calendarCount: calendars.length, inserted, updated, skippedDismissed, accountEmail };
}
