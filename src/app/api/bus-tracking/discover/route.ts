/**
 * Discover bus routes from existing FirstView emails in Gmail.
 * Scans recent emails, parses them, and returns discovered routes
 * with checkpoint names that can be auto-created.
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { apiCredentials, busRoutes } from '@/lib/db/schema';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import { logError } from '@/lib/utils/logError';
import {
  refreshGmailAccessToken,
  fetchEmails,
  getEmailContent,
  extractEmailFields,
  TokenRevokedError,
} from '@/lib/integrations/gmail';
import { parseBusEmail } from '@/lib/integrations/bus-email-parser';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { wallTimeAt } from '@/lib/utils/zonedDate';
import { getBusGmailLabel } from '@/lib/services/bus-tracking-sync';

const FIRSTVIEW_QUERY = 'from:support@myfirstview.com subject:"First View"';

interface DiscoveredRoute {
  studentName: string;
  tripId: string;
  direction: 'AM' | 'PM';
  checkpoints: string[];
  stopName: string | null;
  schoolName: string | null;
  emailCount: number;
}

export async function POST() {
  return withAuth(async () => {
    try {
      // Get Gmail credentials
      const cred = await db.query.apiCredentials.findFirst({
        where: (c, { eq: e }) => e(c.service, 'gmail-bus'),
      });

      if (!cred) {
        return NextResponse.json(
          { error: 'Gmail not connected for bus tracking' },
          { status: 400 }
        );
      }

      let accessToken: string;
      try {
        const parsed = JSON.parse(cred.encryptedCredentials);
        const decryptedAccess = decrypt(parsed.accessToken);
        const decryptedRefresh = parsed.refreshToken ? decrypt(parsed.refreshToken) : '';

        // Refresh if expired
        const bufferMs = 5 * 60 * 1000;
        if (!cred.expiresAt || cred.expiresAt.getTime() < Date.now() + bufferMs) {
          const tokens = await refreshGmailAccessToken(decryptedRefresh);
          accessToken = tokens.access_token;

          const newCreds = {
            accessToken: encrypt(tokens.access_token),
            refreshToken: tokens.refresh_token
              ? encrypt(tokens.refresh_token)
              : encrypt(decryptedRefresh),
          };
          await db.update(apiCredentials).set({
            encryptedCredentials: JSON.stringify(newCreds),
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            updatedAt: new Date(),
          }).where(eq(apiCredentials.id, cred.id));
        } else {
          accessToken = decryptedAccess;
        }
      } catch (error) {
        if (error instanceof TokenRevokedError) {
          // Delete stale credential so /connection reports disconnected
          await db.delete(apiCredentials).where(eq(apiCredentials.service, 'gmail-bus'));
          return NextResponse.json(
            { error: 'Gmail token expired. Please reconnect.' },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: 'Failed to authenticate with Gmail' },
          { status: 500 }
        );
      }

      // Read Gmail label setting for filtered emails
      const gmailLabel = await getBusGmailLabel();

      // Fetch ALL FirstView emails (using label if configured), up to 100
      const messageRefs = await fetchEmails(accessToken, FIRSTVIEW_QUERY, {
        labelName: gmailLabel || undefined,
        maxResults: 100,
      });

      if (messageRefs.length === 0) {
        return NextResponse.json({
          discovered: [],
          message: 'No FirstView emails found in Gmail.',
        });
      }

      // Parse each email and group by student+tripId
      const routeMap = new Map<string, DiscoveredRoute>();
      const timeZone = await getHouseholdTimezone();

      for (const ref of messageRefs) {
        try {
          const message = await getEmailContent(accessToken, ref.id);
          const { subject, body, date } = extractEmailFields(message);
          const parsed = parseBusEmail(subject, body, date);

          if (!parsed || !parsed.tripId) continue;

          // Use direction hint from email content (trip string or time range)
          // Fall back to event time hour only if no hint available
          // (the household's hour: the server's is UTC on a default install)
          const direction = parsed.directionHint
            ?? (Number(wallTimeAt(timeZone, parsed.eventTime).slice(0, 2)) < 12 ? 'AM' : 'PM');
          const key = `${parsed.studentName.toLowerCase()}|${parsed.tripId}|${direction}`;

          if (!routeMap.has(key)) {
            routeMap.set(key, {
              studentName: parsed.studentName,
              tripId: parsed.tripId,
              direction,
              checkpoints: [],
              stopName: null,
              schoolName: null,
              emailCount: 0,
            });
          }

          const route = routeMap.get(key)!;
          route.emailCount++;

          if (parsed.type === 'distance_based') {
            // Add checkpoint if not already present
            if (!route.checkpoints.some(
              cp => cp.toLowerCase() === parsed.checkpointName.toLowerCase()
            )) {
              route.checkpoints.push(parsed.checkpointName);
            }
          } else if (parsed.type === 'arrived_at_stop') {
            route.stopName = parsed.checkpointName;
          } else if (parsed.type === 'arrived_at_school') {
            route.schoolName = parsed.checkpointName;
          }
        } catch {
          // Skip individual email errors
          continue;
        }
      }

      const discovered = Array.from(routeMap.values());

      return NextResponse.json({
        discovered,
        emailsScanned: messageRefs.length,
        message: `Found ${discovered.length} route(s) from ${messageRefs.length} emails.`,
      });
    } catch (error) {
      logError('Bus route discovery error:', error);
      return NextResponse.json(
        { error: 'Failed to discover routes from emails' },
        { status: 500 }
      );
    }
  }, { permission: 'canModifySettings' });
}

/**
 * PUT: Auto-create routes from discovered data.
 * Accepts an array of discovered routes to create.
 */
export async function PUT(request: Request) {
  return withAuth(async () => {
    try {
      const { routes: routesToCreate } = await request.json() as {
        routes: DiscoveredRoute[];
      };

      if (!routesToCreate || routesToCreate.length === 0) {
        return NextResponse.json({ error: 'No routes provided' }, { status: 400 });
      }

      const created: string[] = [];
      const skipped: string[] = [];

      for (const disc of routesToCreate) {
        // Check for existing route with same tripId + direction
        const existing = await db.query.busRoutes.findFirst({
          where: (r, { and, eq: e }) =>
            and(e(r.tripId, disc.tripId), e(r.direction, disc.direction)),
        });

        if (existing) {
          skipped.push(`${disc.studentName} ${disc.direction} (${disc.tripId}) — already exists`);
          continue;
        }

        const label = `${disc.studentName} ${disc.direction === 'AM' ? 'Morning' : 'Afternoon'} Bus`;

        await db.insert(busRoutes).values({
          studentName: disc.studentName,
          tripId: disc.tripId,
          direction: disc.direction,
          label,
          scheduledTime: disc.direction === 'AM' ? '07:00' : '15:00',
          checkpoints: disc.checkpoints.map((name, i) => ({
            name,
            sortOrder: i,
          })),
          stopName: disc.stopName,
          schoolName: disc.schoolName,
        });

        created.push(label);
      }

      await invalidateEntity('bus');

      return NextResponse.json({
        created,
        skipped,
        message: `Created ${created.length} route(s), skipped ${skipped.length}.`,
      });
    } catch (error) {
      logError('Bus route auto-create error:', error);
      return NextResponse.json(
        { error: 'Failed to create routes' },
        { status: 500 }
      );
    }
  }, { permission: 'canModifySettings' });
}
