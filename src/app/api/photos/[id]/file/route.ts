import { NextRequest, NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { photos, photoSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getPhotoPath } from '@/lib/services/photo-storage';
import { readPhotoCache, writePhotoCache } from '@/lib/services/photo-cache';
import { promises as fs } from 'fs';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import { refreshAccessToken } from '@/lib/integrations/onedrive';
import { downloadImmichAsset, type ImmichShareCredentials } from '@/lib/integrations/immich';
import { getICloudSharedAssetUrl } from '@/lib/services/photo-sync';
import { logError } from '@/lib/utils/logError';

const GRAPH_API = 'https://graph.microsoft.com/v1.0';

async function getValidToken(sourceId: string): Promise<string> {
  const source = await db.query.photoSources.findFirst({
    where: eq(photoSources.id, sourceId),
  });
  if (!source?.accessToken || !source?.refreshToken) {
    throw new Error('No tokens for photo source');
  }

  if (source.tokenExpiresAt && source.tokenExpiresAt < new Date()) {
    const tokens = await refreshAccessToken(decrypt(source.refreshToken));
    await db.update(photoSources).set({
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : source.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      updatedAt: new Date(),
    }).where(eq(photoSources.id, sourceId));
    return tokens.access_token;
  }

  return decrypt(source.accessToken);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const thumb = searchParams.get('thumb') === '1' || searchParams.get('thumb') === 'true';

    const photo = await db.query.photos.findFirst({
      where: eq(photos.id, id),
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // External photos: proxy through the upstream source on demand.
    if (photo.isExternal && photo.externalId) {
      const source = await db.query.photoSources.findFirst({
        where: eq(photoSources.id, photo.sourceId),
      });
      if (!source) {
        return NextResponse.json({ error: 'Source not found' }, { status: 404 });
      }

      if (source.type === 'immich') {
        // Try the local cache first; on miss, fetch from Immich and populate.
        const cached = await readPhotoCache(photo.sourceId, photo.externalId, thumb);
        if (cached) {
          return new NextResponse(cached.buffer, {
            headers: {
              'Content-Type': cached.contentType,
              'Cache-Control': 'public, max-age=3600',
              'Content-Length': cached.buffer.length.toString(),
            },
          });
        }

        if (!source.immichServerUrl || !source.immichShareKey) {
          return NextResponse.json(
            { error: 'Immich source missing credentials' },
            { status: 500 },
          );
        }

        const creds: ImmichShareCredentials = {
          serverUrl: source.immichServerUrl,
          shareKey: source.immichShareKey,
          password: source.immichPasswordEnc ? decrypt(source.immichPasswordEnc) : null,
          // Pass sourceId so the per-source cookie cache can short-circuit
          // the per-asset login round-trip for password-protected shares.
          sourceId: source.id,
        };

        const { buffer, contentType } = await downloadImmichAsset(
          creds,
          photo.externalId,
          { thumb },
        );

        await writePhotoCache(photo.sourceId, photo.externalId, thumb, buffer, contentType);

        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'Content-Length': buffer.length.toString(),
          },
        });
      }

      // iCloud Shared Album: same cache-first pattern as Immich. Signed
      // download URL is fetched per-request (Apple's TTL is ~30 min so
      // there's nothing useful to cache on the URL itself).
      if (source.type === 'icloud_shared') {
        const cached = await readPhotoCache(photo.sourceId, photo.externalId, thumb);
        if (cached) {
          return new NextResponse(cached.buffer, {
            headers: {
              'Content-Type': cached.contentType,
              'Cache-Control': 'public, max-age=3600',
              'Content-Length': cached.buffer.length.toString(),
            },
          });
        }
        const signedUrl = await getICloudSharedAssetUrl(source.id, photo.externalId);
        if (!signedUrl) {
          return NextResponse.json(
            { error: 'iCloud shared album asset URL unavailable (album may have changed)' },
            { status: 502 },
          );
        }
        const upstream = await fetch(signedUrl);
        if (!upstream.ok) {
          return NextResponse.json(
            { error: `Upstream iCloud fetch failed: ${upstream.status}` },
            { status: 502 },
          );
        }
        const buffer = Buffer.from(await upstream.arrayBuffer());
        const contentType = upstream.headers.get('content-type') ?? photo.mimeType;
        await writePhotoCache(photo.sourceId, photo.externalId, thumb, buffer, contentType);
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'Content-Length': buffer.length.toString(),
          },
        });
      }

      // OneDrive: proxy through Graph with token refresh.
      const accessToken = await getValidToken(photo.sourceId);

      let url: string;
      if (thumb) {
        // Use OneDrive's built-in thumbnail endpoint (no download of full image)
        url = `${GRAPH_API}/me/drive/items/${photo.externalId}/thumbnails/0/medium/content`;
      } else {
        url = `${GRAPH_API}/me/drive/items/${photo.externalId}/content`;
      }

      const upstream = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: 'follow',
      });

      if (!upstream.ok) {
        return NextResponse.json({ error: 'Failed to fetch from OneDrive' }, { status: 502 });
      }

      const buffer = Buffer.from(await upstream.arrayBuffer());
      const contentType = upstream.headers.get('content-type') ?? photo.mimeType;

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'Content-Length': buffer.length.toString(),
        },
      });
    }

    // Local file
    const filename = thumb && photo.thumbnailPath
      ? photo.thumbnailPath
      : photo.filename;
    const filePath = getPhotoPath(filename, thumb && !!photo.thumbnailPath);

    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': photo.mimeType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    logError('Error serving photo:', error);
    return NextResponse.json({ error: 'Failed to serve photo' }, { status: 500 });
  }
}
