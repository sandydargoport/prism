import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photoSources } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';
import { encrypt } from '@/lib/utils/crypto';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { UnsafeUrlError } from '@/lib/utils/safeFetch';
import {
  parseImmichShareUrl,
  fetchSharedLink,
  ImmichPasswordRequiredError,
  ImmichInvalidPasswordError,
  ImmichShareNotFoundError,
} from '@/lib/integrations/immich';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const sources = await db
      .select({
        id: photoSources.id,
        type: photoSources.type,
        name: photoSources.name,
        priority: photoSources.priority,
        onedriveFolderId: photoSources.onedriveFolderId,
        enabled: photoSources.enabled,
        lastSynced: photoSources.lastSynced,
        syncErrors: photoSources.syncErrors,
        createdAt: photoSources.createdAt,
        photoCount: sql<number>`(SELECT count(*)::int FROM photos WHERE photos.source_id = photo_sources.id)`,
      })
      .from(photoSources)
      // Order by dedup priority (lower = preferred) so the settings list
      // reads top-to-bottom as the preference order, then createdAt as a
      // stable tiebreak.
      .orderBy(photoSources.priority, photoSources.createdAt);

    return NextResponse.json({ sources });
  } catch (error) {
    logError('Error fetching photo sources:', error);
    return NextResponse.json({ error: 'Failed to fetch photo sources' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Mutation route: a malicious or compromised parent session could otherwise
  // submit URLs in a tight loop, each of which fires an outbound fetch. Cap
  // at 20 source-create attempts per minute per user.
  const rateLimited = await rateLimitGuard(auth.userId, 'photo-sources:create', 20, 60);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const { type, name, onedriveFolderId, shareUrl, password } = body;

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    if (type === 'immich') {
      if (!shareUrl || typeof shareUrl !== 'string') {
        return NextResponse.json(
          { error: 'shareUrl is required for Immich sources' },
          { status: 400 },
        );
      }

      let serverUrl: string;
      let shareKey: string;
      try {
        ({ serverUrl, shareKey } = parseImmichShareUrl(shareUrl));
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Invalid share URL' },
          { status: 400 },
        );
      }

      // Validate the share is reachable + the password (if any) is correct.
      // SSRF guards inside fetchSharedLink will throw UnsafeUrlError if the
      // serverUrl points at a private / loopback / metadata destination.
      const pw = typeof password === 'string' && password.length > 0 ? password : null;
      let link;
      try {
        link = await fetchSharedLink({ serverUrl, shareKey, password: pw });
      } catch (err) {
        if (err instanceof UnsafeUrlError) {
          return NextResponse.json(
            { error: 'unsafe_url', message: 'Share URL points at a private or loopback address' },
            { status: 400 },
          );
        }
        if (err instanceof ImmichPasswordRequiredError) {
          return NextResponse.json(
            { error: 'password_required', message: 'This shared link requires a password' },
            { status: 401 },
          );
        }
        if (err instanceof ImmichInvalidPasswordError) {
          return NextResponse.json(
            { error: 'invalid_password', message: 'Incorrect password' },
            { status: 401 },
          );
        }
        if (err instanceof ImmichShareNotFoundError) {
          return NextResponse.json(
            { error: 'not_found', message: 'Shared link not found at the given URL' },
            { status: 404 },
          );
        }
        throw err;
      }

      const sourceName =
        (typeof name === 'string' && name.trim()) ||
        link.albumName ||
        'Immich album';

      const [source] = await db
        .insert(photoSources)
        .values({
          type: 'immich',
          name: sourceName,
          immichServerUrl: serverUrl,
          immichShareKey: shareKey,
          immichPasswordEnc: pw ? encrypt(pw) : null,
          immichAlbumId: link.albumId,
        })
        .returning();

      await invalidateEntity('photos');

      return NextResponse.json(source, { status: 201 });
    }

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const [source] = await db
      .insert(photoSources)
      .values({
        type,
        name,
        onedriveFolderId: onedriveFolderId || null,
      })
      .returning();

    await invalidateEntity('photos');

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    logError('Error creating photo source:', error);
    return NextResponse.json({ error: 'Failed to create photo source' }, { status: 500 });
  }
}
