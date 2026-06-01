/**
 * On-disk cache for proxied photo bytes.
 *
 * Originals: data/photos/cache/<sourceId>/<externalId>
 * Thumbs:    data/photos/cache/<sourceId>/thumbs/<externalId>
 *
 * Used by /api/photos/[id]/file when serving Immich-backed photos so we don't
 * round-trip to the upstream server for every request. Cache is best-effort:
 * read failures fall through to a fresh fetch, and write failures don't block
 * the response.
 *
 * TODO(disk-bound): cache directory growth is currently unbounded. For a
 * 10k+ photo album on a Wyse-class kiosk, this can fill the data volume.
 * Consider an LRU eviction policy or a max-bytes cap. Out of scope for
 * the initial Immich integration.
 */

import { promises as fs } from 'fs';
import path from 'path';

import { getPhotosRoot } from '@/lib/config/runtime';

const CACHE_ROOT = path.join(getPhotosRoot(), 'cache');

function sanitize(segment: string): string {
  // Defense-in-depth: keys come from our own DB, but still guard against any
  // path-traversal characters before joining.
  return segment.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function cachePath(sourceId: string, externalId: string, thumb: boolean): string {
  const dir = thumb
    ? path.join(CACHE_ROOT, sanitize(sourceId), 'thumbs')
    : path.join(CACHE_ROOT, sanitize(sourceId));
  return path.join(dir, sanitize(externalId));
}

function metaPath(filePath: string): string {
  return `${filePath}.meta`;
}

export interface CachedPhoto {
  buffer: Uint8Array<ArrayBuffer>;
  contentType: string;
}

export async function readPhotoCache(
  sourceId: string,
  externalId: string,
  thumb: boolean,
): Promise<CachedPhoto | null> {
  const file = cachePath(sourceId, externalId, thumb);
  try {
    const [buffer, meta] = await Promise.all([
      fs.readFile(file),
      fs.readFile(metaPath(file), 'utf8').catch(() => ''),
    ]);
    const contentType = meta.trim() || 'application/octet-stream';
    return { buffer, contentType };
  } catch {
    return null;
  }
}

export async function writePhotoCache(
  sourceId: string,
  externalId: string,
  thumb: boolean,
  buffer: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<void> {
  const file = cachePath(sourceId, externalId, thumb);
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buffer);
    await fs.writeFile(metaPath(file), contentType);
  } catch {
    // Cache writes are best-effort
  }
}

/**
 * Remove all cached files for a source. Called when a source is deleted.
 */
export async function clearSourceCache(sourceId: string): Promise<void> {
  const dir = path.join(CACHE_ROOT, sanitize(sourceId));
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Remove cached files for a single asset. Called when sync detects the asset
 * is gone from the upstream album.
 */
export async function clearPhotoCache(sourceId: string, externalId: string): Promise<void> {
  const original = cachePath(sourceId, externalId, false);
  const thumb = cachePath(sourceId, externalId, true);
  await Promise.all([
    fs.rm(original, { force: true }),
    fs.rm(metaPath(original), { force: true }),
    fs.rm(thumb, { force: true }),
    fs.rm(metaPath(thumb), { force: true }),
  ]);
}
