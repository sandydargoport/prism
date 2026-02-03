import { db } from '@/lib/db/client';
import { photos, photoSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  listPhotosInFolder,
  downloadPhoto,
  refreshAccessToken,
} from '@/lib/integrations/onedrive';
import { savePhoto, deletePhoto } from './photo-storage';
import { decrypt, encrypt } from '@/lib/utils/crypto';

function generateFilename(originalName: string): string {
  const ext = originalName.split('.').pop() || 'jpg';
  return `${crypto.randomUUID()}.${ext}`;
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

  // Download new photos
  for (const remotePhoto of remotePhotos) {
    if (existingExternalIds.has(remotePhoto.id)) continue;

    try {
      const buffer = await downloadPhoto(accessToken, remotePhoto.id);
      const filename = generateFilename(remotePhoto.name);
      const result = await savePhoto(buffer, filename);

      const mimeType = remotePhoto.file?.mimeType || 'image/jpeg';

      await db.insert(photos).values({
        sourceId,
        filename,
        originalFilename: remotePhoto.name,
        mimeType,
        width: result.width,
        height: result.height,
        sizeBytes: result.sizeBytes,
        takenAt: remotePhoto.photo?.takenDateTime
          ? new Date(remotePhoto.photo.takenDateTime)
          : null,
        externalId: remotePhoto.id,
        thumbnailPath: result.thumbnailPath,
      });
    } catch (err) {
      console.error(`Failed to sync photo ${remotePhoto.name}:`, err);
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
