import { db } from '@/lib/db/client';
import { photos, photoSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  listPhotosInFolder,
  downloadPhoto,
  refreshAccessToken,
} from '@/lib/integrations/onedrive';
import { fetchSharedLink, type ImmichShareCredentials } from '@/lib/integrations/immich';
import { savePhoto, deletePhoto, getPhotoPath } from './photo-storage';
import { clearPhotoCache } from './photo-cache';
import { promises as fs } from 'fs';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import exifr from 'exifr';

async function extractGps(buffer: Buffer): Promise<{ latitude: string; longitude: string } | null> {
  try {
    const gps = await exifr.gps(buffer);
    if (gps?.latitude != null && gps?.longitude != null) {
      return { latitude: gps.latitude.toString(), longitude: gps.longitude.toString() };
    }
  } catch {
    // No EXIF or no GPS — not an error
  }
  return null;
}

function generateFilename(originalName: string): string {
  const ext = originalName.split('.').pop() || 'jpg';
  return `${crypto.randomUUID()}.${ext}`;
}

/**
 * Cross-source dedup key: `${takenAt-to-the-second}_${width}x${height}`.
 * Two photos with an identical key are treated as the same shot pulled
 * from different sources (e.g. the same picture backed up to both OneDrive
 * and iCloud). Returns null when capture time OR dimensions are missing —
 * those photos are never deduped (better to show a possible duplicate than
 * to wrongly suppress a unique photo).
 *
 * Dimensions are intentionally part of the key: a cropped edit keeps the
 * original capture timestamp but changes dimensions, so this is what lets
 * an edit and its original both display instead of one suppressing the
 * other. Which copy wins an ACTUAL dedup conflict (same key) is decided by
 * photo_sources.priority at read time, not here.
 */
export function computeDedupeKey(
  takenAt: Date | null,
  width: number | null,
  height: number | null,
): string | null {
  if (!takenAt || width == null || height == null) return null;
  // Truncate to the second — sub-second jitter between a service's copies
  // shouldn't split the same shot into two keys.
  const ts = new Date(takenAt);
  ts.setMilliseconds(0);
  return `${ts.toISOString()}_${width}x${height}`;
}

export async function syncOneDriveSource(sourceId: string) {
  // Fetch the source
  const source = await db.query.photoSources.findFirst({
    where: eq(photoSources.id, sourceId),
  });

  if (!source || source.type !== 'onedrive' || !source.onedriveFolderId) {
    throw new Error('Invalid OneDrive photo source');
  }

  if (!source.accessToken || !source.refreshToken) {
    throw new Error('Photo source missing OAuth tokens');
  }

  let accessToken = decrypt(source.accessToken);
  if (source.tokenExpiresAt && source.tokenExpiresAt < new Date()) {
    const refreshToken = decrypt(source.refreshToken);
    const tokens = await refreshAccessToken(refreshToken);
    accessToken = tokens.access_token;

    await db
      .update(photoSources)
      .set({
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : source.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(photoSources.id, sourceId));
  }

  // Get remote photos
  const remotePhotos = await listPhotosInFolder(accessToken, source.onedriveFolderId);

  // Get existing photos for this source
  const existingPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.sourceId, sourceId));

  const existingExternalIds = new Set(existingPhotos.map((p) => p.externalId));
  const remoteIds = new Set(remotePhotos.map((p) => p.id));

  // Download new photos (or record metadata-only if OneDrive already has GPS)
  for (const remotePhoto of remotePhotos) {
    if (existingExternalIds.has(remotePhoto.id)) continue;

    try {
      const facetLat = remotePhoto.location?.latitude;
      const facetLng = remotePhoto.location?.longitude;
      const hasFacetGps = facetLat != null && facetLng != null;
      const mimeType = remotePhoto.file?.mimeType || 'image/jpeg';
      const takenAt = remotePhoto.photo?.takenDateTime
        ? new Date(remotePhoto.photo.takenDateTime)
        : null;

      if (hasFacetGps) {
        // Metadata-only: GPS known from OneDrive facet — no download needed.
        // filename stores the item ID so the file endpoint can proxy on demand.
        // usage='' keeps these out of screensaver/wallpaper rotation.
        const mdWidth = remotePhoto.image?.width ?? null;
        const mdHeight = remotePhoto.image?.height ?? null;
        await db.insert(photos).values({
          sourceId,
          filename: remotePhoto.id,
          originalFilename: remotePhoto.name,
          mimeType,
          width: mdWidth,
          height: mdHeight,
          sizeBytes: remotePhoto.size ?? null,
          takenAt,
          externalId: remotePhoto.id,
          thumbnailPath: null,
          latitude: facetLat.toString(),
          longitude: facetLng.toString(),
          isExternal: true,
          usage: '',
          dedupeKey: computeDedupeKey(takenAt, mdWidth, mdHeight),
        });
      } else {
        // No facet GPS — download the file and try EXIF extraction
        const buffer = await downloadPhoto(accessToken, remotePhoto.id);
        const filename = generateFilename(remotePhoto.name);
        const result = await savePhoto(buffer, filename);
        const gps = await extractGps(buffer);

        await db.insert(photos).values({
          sourceId,
          filename,
          originalFilename: remotePhoto.name,
          mimeType,
          width: result.width,
          height: result.height,
          sizeBytes: result.sizeBytes,
          takenAt,
          externalId: remotePhoto.id,
          thumbnailPath: result.thumbnailPath,
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
          isExternal: false,
          dedupeKey: computeDedupeKey(takenAt, result.width, result.height),
        });
      }
    } catch (err) {
      console.error(`Failed to sync photo ${remotePhoto.name}:`, err);
    }
  }

  // Backfill GPS for existing photos that don't yet have coordinates
  const photosWithoutGps = existingPhotos.filter(
    (p) => p.latitude === null && p.longitude === null
  );
  for (const existing of photosWithoutGps) {
    try {
      // Try reading EXIF from the already-downloaded file on disk
      const filePath = getPhotoPath(existing.filename);
      const buffer = await fs.readFile(filePath).catch(() => null);
      const gps = buffer ? await extractGps(buffer) : null;

      // Fall back to OneDrive location facet if EXIF had nothing
      const remote = remotePhotos.find((r) => r.id === existing.externalId);
      const lat = gps?.latitude ?? remote?.location?.latitude?.toString() ?? null;
      const lng = gps?.longitude ?? remote?.location?.longitude?.toString() ?? null;

      if (lat && lng) {
        await db
          .update(photos)
          .set({ latitude: lat, longitude: lng })
          .where(eq(photos.id, existing.id));
      }
    } catch {
      // Skip — don't fail the whole sync for one photo
    }
  }

  // Remove photos that no longer exist remotely
  for (const existing of existingPhotos) {
    if (existing.externalId && !remoteIds.has(existing.externalId)) {
      await deletePhoto(existing.filename, existing.thumbnailPath);
      await db.delete(photos).where(eq(photos.id, existing.id));
    }
  }

  // Update last synced
  await db
    .update(photoSources)
    .set({ lastSynced: new Date(), updatedAt: new Date() })
    .where(eq(photoSources.id, sourceId));
}

/**
 * Sync every enabled photo source that has an automatic-sync mechanism
 * (OneDrive folders, Immich shared links). Local-upload sources have
 * nothing to pull. Called by the photo-sync cron so a folder the user
 * drops photos into shows up on the dashboard without a manual trigger.
 * Per-source failures are caught so one bad source doesn't abort the rest.
 */
export async function syncAllPhotoSources(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  const sources = await db.query.photoSources.findMany({
    where: eq(photoSources.enabled, true),
  });

  for (const source of sources) {
    try {
      if (source.type === 'onedrive') {
        await syncOneDriveSource(source.id);
        synced++;
      } else if (source.type === 'immich') {
        await syncImmichSource(source.id);
        synced++;
      }
      // 'local' has nothing to pull; 'icloud_shared' handled once Phase B lands.
    } catch (err) {
      errors.push(`${source.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { synced, errors };
}

export async function syncImmichSource(sourceId: string) {
  const source = await db.query.photoSources.findFirst({
    where: eq(photoSources.id, sourceId),
  });

  if (!source || source.type !== 'immich') {
    throw new Error('Invalid Immich photo source');
  }
  if (!source.immichServerUrl || !source.immichShareKey) {
    throw new Error('Immich photo source is missing server URL or share key');
  }

  const creds: ImmichShareCredentials = {
    serverUrl: source.immichServerUrl,
    shareKey: source.immichShareKey,
    password: source.immichPasswordEnc ? decrypt(source.immichPasswordEnc) : null,
    // Pass sourceId so fetchSharedLink seeds the cookie cache for any
    // subsequent downloadImmichAsset calls in this process.
    sourceId: sourceId,
  };

  const link = await fetchSharedLink(creds);

  // Cache the album ID on first successful sync so we have it for diagnostics.
  if (link.albumId && link.albumId !== source.immichAlbumId) {
    await db
      .update(photoSources)
      .set({ immichAlbumId: link.albumId, updatedAt: new Date() })
      .where(eq(photoSources.id, sourceId));
  }

  // Only sync image assets — video/other types aren't displayed in the gallery.
  const remoteImages = link.assets.filter((a) => a.type === 'IMAGE');
  const remoteIds = new Set(remoteImages.map((a) => a.id));

  const existingPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.sourceId, sourceId));

  const existingExternalIds = new Set(
    existingPhotos.map((p) => p.externalId).filter((x): x is string => !!x),
  );

  // Insert new assets as external metadata-only records (proxy serves bytes
  // on demand, with the local cache absorbing repeat requests).
  for (const asset of remoteImages) {
    if (existingExternalIds.has(asset.id)) continue;

    const takenAt = asset.fileCreatedAt ? new Date(asset.fileCreatedAt) : null;

    await db.insert(photos).values({
      sourceId,
      filename: asset.id,
      originalFilename: asset.originalFileName,
      mimeType: asset.originalMimeType || 'image/jpeg',
      width: asset.width,
      height: asset.height,
      sizeBytes: null,
      takenAt,
      externalId: asset.id,
      thumbnailPath: null,
      latitude: asset.latitude != null ? asset.latitude.toString() : null,
      longitude: asset.longitude != null ? asset.longitude.toString() : null,
      isExternal: true,
      usage: 'wallpaper,gallery,screensaver',
      dedupeKey: computeDedupeKey(takenAt, asset.width, asset.height),
    });
  }

  // Backfill GPS for existing rows whose coordinates are still null but
  // Immich now has them (e.g. user added geotags after the first sync).
  for (const existing of existingPhotos) {
    if (existing.latitude != null && existing.longitude != null) continue;
    if (!existing.externalId) continue;
    const remote = remoteImages.find((a) => a.id === existing.externalId);
    if (!remote) continue;
    if (remote.latitude == null || remote.longitude == null) continue;

    await db
      .update(photos)
      .set({
        latitude: remote.latitude.toString(),
        longitude: remote.longitude.toString(),
      })
      .where(eq(photos.id, existing.id));
  }

  // Remove photos no longer in the album, including any cached bytes.
  for (const existing of existingPhotos) {
    if (existing.externalId && !remoteIds.has(existing.externalId)) {
      await clearPhotoCache(sourceId, existing.externalId);
      await db.delete(photos).where(eq(photos.id, existing.id));
    }
  }

  await db
    .update(photoSources)
    .set({ lastSynced: new Date(), updatedAt: new Date() })
    .where(eq(photoSources.id, sourceId));
}
