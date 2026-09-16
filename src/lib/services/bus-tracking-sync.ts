/**
 * Sync service for bus tracking. Polls Gmail for FirstView emails,
 * parses them, matches to routes, and logs to busGeofenceLog.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { apiCredentials, busRoutes, busGeofenceLog, settings } from '@/lib/db/schema';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import {
  refreshGmailAccessToken,
  fetchEmails,
  getEmailContent,
  extractEmailFields,
  markEmailAsRead,
  TokenRevokedError,
} from '@/lib/integrations/gmail';
import { parseBusEmail, matchEmailToRoute } from '@/lib/integrations/bus-email-parser';
import type { BusRoute } from '@/lib/integrations/bus-email-parser';
import { invalidateCache } from '@/lib/cache/redis';

const FIRSTVIEW_QUERY = 'from:support@myfirstview.com subject:"First View"';

interface SyncResult {
  processed: number;
  newEvents: number;
  skipped: number;
  errors: string[];
  skippedReasons: string[];
}

/**
 * Get Gmail credentials from apiCredentials table.
 */
async function getGmailCredentials(): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  credentialId: string;
} | null> {
  const cred = await db.query.apiCredentials.findFirst({
    where: (c, { eq }) => eq(c.service, 'gmail-bus'),
  });

  if (!cred) return null;

  try {
    const parsed = JSON.parse(cred.encryptedCredentials);
    return {
      accessToken: decrypt(parsed.accessToken),
      refreshToken: parsed.refreshToken ? decrypt(parsed.refreshToken) : '',
      expiresAt: cred.expiresAt || new Date(0),
      credentialId: cred.id,
    };
  } catch {
    return null;
  }
}

/**
 * Refresh Gmail token if expired (with 5-minute buffer).
 */
async function ensureFreshToken(creds: {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  credentialId: string;
}): Promise<string> {
  const bufferMs = 5 * 60 * 1000;
  if (creds.expiresAt.getTime() > Date.now() + bufferMs) {
    return creds.accessToken;
  }

  // Refresh needed
  const tokens = await refreshGmailAccessToken(creds.refreshToken);
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const credentials = {
    accessToken: encrypt(tokens.access_token),
    refreshToken: tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : encrypt(creds.refreshToken),
  };

  await db.update(apiCredentials).set({
    encryptedCredentials: JSON.stringify(credentials),
    expiresAt: newExpiresAt,
    updatedAt: new Date(),
  }).where(eq(apiCredentials.id, creds.credentialId));

  return tokens.access_token;
}

/**
 * Sync bus emails from Gmail. Main entry point for the sync service.
 */
export async function syncBusEmails(): Promise<SyncResult> {
  const result: SyncResult = { processed: 0, newEvents: 0, skipped: 0, errors: [], skippedReasons: [] };

  // Get Gmail credentials
  const creds = await getGmailCredentials();
  if (!creds) {
    result.errors.push('Gmail not connected for bus tracking');
    return result;
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshToken(creds);
  } catch (error) {
    if (error instanceof TokenRevokedError) {
      // Delete stale credential so /connection reports disconnected
      await db.delete(apiCredentials).where(eq(apiCredentials.service, 'gmail-bus'));
      result.errors.push('Gmail token expired or revoked. Please reconnect.');
    } else {
      result.errors.push(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return result;
  }

  // Read Gmail label setting (e.g. 'bus' for emails filtered to label:bus)
  const gmailLabel = await getBusGmailLabel();

  // Use date filter to limit search window (today minus 1 day) instead of is:unread
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const afterDate = `${yesterday.getFullYear()}/${String(yesterday.getMonth() + 1).padStart(2, '0')}/${String(yesterday.getDate()).padStart(2, '0')}`;

  // Fetch FirstView emails using label + date filter, relying on DB dedup
  let messageRefs: { id: string; threadId: string }[];
  try {
    messageRefs = await fetchEmails(accessToken, FIRSTVIEW_QUERY, {
      labelName: gmailLabel || undefined,
      afterDate,
      maxResults: 50,
    });
  } catch (error) {
    result.errors.push(`Failed to fetch emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }

  if (messageRefs.length === 0) return result;

  // Load all enabled routes
  const routes = await db.select().from(busRoutes).where(eq(busRoutes.enabled, true));
  const routeData: BusRoute[] = routes.map(r => ({
    id: r.id,
    studentName: r.studentName,
    tripId: r.tripId,
    direction: r.direction as 'AM' | 'PM',
    checkpoints: (r.checkpoints as { name: string; sortOrder: number }[]) || [],
    stopName: r.stopName,
    schoolName: r.schoolName,
  }));

  // Process each email
  for (const ref of messageRefs) {
    try {
      result.processed++;

      // Check if we've already processed this email (DB dedup via gmailMessageId)
      const existing = await db.query.busGeofenceLog.findFirst({
        where: (log, { eq }) => eq(log.gmailMessageId, ref.id),
      });
      if (existing) {
        result.skipped++;
        await markEmailAsRead(accessToken, ref.id).catch(() => {});
        continue;
      }

      // Get full email content
      const message = await getEmailContent(accessToken, ref.id);
      const { subject, body, date } = extractEmailFields(message);

      // Parse the email
      const parsed = parseBusEmail(subject, body, date);
      if (!parsed) {
        result.skipped++;
        result.skippedReasons.push(`Parse failed: "${subject}"`);
        // The subject line of a school-bus notification names a child and a
        // school or stop. It stays in skippedReasons, which is returned to the
        // family's own UI, but it does not go to the process log: bug.yml asks
        // people to paste container logs into a public issue.
        console.warn(`Bus sync: could not parse email (${date.toISOString()})`);
        continue;
      }

      // Match to a route
      const match = matchEmailToRoute(parsed, routeData);
      if (!match) {
        result.skipped++;
        result.skippedReasons.push(`No route match: "${subject}" (student=${parsed.studentName}, hint=${parsed.directionHint})`);
        console.warn(`Bus sync: no route match (hint=${parsed.directionHint})`);
        continue;
      }

      // Auto-add new checkpoints/stops/schools to the route config
      if (match.isNewCheckpoint) {
        const route = routeData.find(r => r.id === match.routeId);
        if (route) {
          if (parsed.type === 'distance_based') {
            const newCp = { name: match.checkpointName, sortOrder: route.checkpoints.length };
            route.checkpoints.push(newCp);
            match.checkpointIndex = newCp.sortOrder;
            await db.update(busRoutes).set({
              checkpoints: route.checkpoints,
            }).where(eq(busRoutes.id, route.id));
            console.log(`Bus sync: auto-added checkpoint to route ${route.id}`);
          } else if (parsed.type === 'arrived_at_stop' && !route.stopName) {
            route.stopName = match.checkpointName;
            await db.update(busRoutes).set({
              stopName: match.checkpointName,
            }).where(eq(busRoutes.id, route.id));
            console.log(`Bus sync: auto-set stop name for route ${route.id}`);
          } else if (parsed.type === 'arrived_at_school' && !route.schoolName) {
            route.schoolName = match.checkpointName;
            await db.update(busRoutes).set({
              schoolName: match.checkpointName,
            }).where(eq(busRoutes.id, route.id));
            console.log(`Bus sync: auto-set school name for route ${route.id}`);
          }
        }
      }

      // Insert into geofence log
      const eventTime = parsed.eventTime;
      await db.insert(busGeofenceLog).values({
        routeId: match.routeId,
        eventType: parsed.type,
        checkpointName: match.checkpointName,
        checkpointIndex: match.checkpointIndex,
        eventTime,
        dayOfWeek: eventTime.getDay(),
        tripDate: formatDateStr(eventTime),
        gmailMessageId: ref.id,
        rawData: {
          subject,
          studentName: parsed.studentName,
          tripId: parsed.tripId,
          rawAddress: parsed.rawAddress,
          distanceFt: parsed.distanceFt,
        },
      });

      result.newEvents++;

      // Mark as read for tidiness (dedup is DB-based, not read-state)
      await markEmailAsRead(accessToken, ref.id).catch(() => {});
    } catch (error) {
      result.errors.push(
        `Error processing message ${ref.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Invalidate bus cache if we added new events
  if (result.newEvents > 0) {
    await invalidateCache('bus:*');
  }

  return result;
}

/**
 * Check if current time is within a bus route's active window (±30 min of scheduled time).
 */
export function isWithinBusWindow(scheduledTime: string, bufferMinutes: number = 30): boolean {
  const parts = scheduledTime.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const now = new Date();
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);

  const diff = Math.abs(now.getTime() - scheduled.getTime());
  return diff <= bufferMinutes * 60 * 1000;
}

/**
 * Check if Gmail is connected for bus tracking.
 */
export async function isGmailConnected(): Promise<boolean> {
  const cred = await db.query.apiCredentials.findFirst({
    where: (c, { eq }) => eq(c.service, 'gmail-bus'),
  });
  return !!cred;
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Read the Gmail label name for bus emails from settings.
 * Returns null if not configured (will search all mail).
 */
export async function getBusGmailLabel(): Promise<string | null> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'busGmailLabel'));
  return (row?.value as string) || null;
}
