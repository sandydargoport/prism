/**
 * iCloud Shared Album reader.
 *
 * Apple exposes public shared albums via the "shared streams" web service —
 * the same channel that powers https://www.icloud.com/sharedalbum/#XXX
 * preview pages. It's not a documented public API but has been stable for
 * 8+ years; well-understood by tooling like icloud-shared-album-dl, etc.
 *
 *   No OAuth.
 *   No Apple Developer account.
 *   Just the share URL the user pastes in.
 *
 * Protocol overview:
 *
 *   1. Parse share URL → extract the token after the '#'.
 *   2. Discover the right partition (p[N]-sharedstreams.icloud.com). We
 *      POST to a starting partition; if Apple redirects via the 330 status
 *      it tells us the canonical host in `X-Apple-MMe-Host`.
 *   3. POST /{token}/sharedstreams/webstream → list of photo metadata
 *      (photoGuid, derivatives keyed by max dimension, capture date, etc.)
 *   4. POST /{token}/sharedstreams/webasseturls with the photoGuids you
 *      want to download → signed URLs (short-lived).
 *
 * Note: signed asset URLs are short-lived (~30 min), so callers must
 * fetch them at the moment of download, not cache them.
 */

import { validatePublicUrl, UnsafeUrlError } from '@/lib/utils/safeFetch';

const DEFAULT_START_HOST = 'p123-sharedstreams.icloud.com';

export class ICloudShareError extends Error {}
export class ICloudShareNotFoundError extends ICloudShareError {}

export interface ICloudDerivative {
  /** Stable per-byte identifier Apple uses to key signed asset URLs. */
  checksum: string;
  width: number;
  height: number;
}

export interface ICloudSharedAsset {
  photoGuid: string;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  takenAt: Date | null;
  /** Apple returns multiple resolutions. Use pickBestDerivative() to get the
   *  highest-res entry; its checksum keys into the asset-URLs map. */
  derivatives: Record<string, ICloudDerivative>;
}

export interface ICloudSharedAlbumFeed {
  /** The partition host we landed on, after any 330 redirect. Pass into
   *  fetchAssetUrls so the asset-URL call hits the same shard. */
  host: string;
  /** Display name Apple returns for the album, or null. */
  albumName: string | null;
  assets: ICloudSharedAsset[];
}

/**
 * Pull the share token out of an iCloud share URL.
 * Accepts:
 *   https://www.icloud.com/sharedalbum/#B1aXyZxxxxxxxxx
 *   https://www.icloud.com/photostream/#B1aXyZxxxxxxxxx
 *   B1aXyZxxxxxxxxx                                    (raw token)
 */
export function parseICloudShareToken(input: string): string {
  const trimmed = input.trim();
  // If no protocol prefix, treat as raw token.
  if (!trimmed.includes('://') && !trimmed.startsWith('#')) {
    return trimmed.replace(/^#/, '');
  }
  // Hash fragment carries the token.
  const hashIdx = trimmed.indexOf('#');
  if (hashIdx < 0) {
    throw new ICloudShareError('Share URL is missing the album token after #');
  }
  const token = trimmed.slice(hashIdx + 1);
  if (!token) {
    throw new ICloudShareError('Empty share token');
  }
  return token;
}

/**
 * Hit the starting partition's webstream endpoint. If Apple redirects with
 * 330 + X-Apple-MMe-Host, retry against that host. Returns the host that
 * actually answered + the parsed JSON body.
 */
async function postWithPartitionDiscovery(
  startHost: string,
  token: string,
  endpoint: 'webstream' | 'webasseturls',
  body: Record<string, unknown>,
): Promise<{ host: string; data: Record<string, unknown> }> {
  let host = startHost;
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = `https://${host}/${token}/sharedstreams/${endpoint}`;
    // SSRF guard — defense in depth even though hostnames are validated above.
    await validatePublicUrl(url);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'Prism/1.0 (https://github.com/sandydargoport/prism)',
      },
      body: JSON.stringify(body),
      redirect: 'manual',
    });

    if (res.status === 330) {
      const newHost = res.headers.get('X-Apple-MMe-Host');
      if (!newHost) {
        throw new ICloudShareError('iCloud redirected without an X-Apple-MMe-Host header');
      }
      // Sanity: must still be a sharedstreams host.
      if (!newHost.endsWith('-sharedstreams.icloud.com')) {
        throw new ICloudShareError(`Unexpected redirect host: ${newHost}`);
      }
      host = newHost;
      continue;
    }

    if (res.status === 404) {
      throw new ICloudShareNotFoundError('Shared album not found — check the share URL');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ICloudShareError(`iCloud ${endpoint} returned ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return { host, data };
  }
  throw new ICloudShareError('Exceeded partition-redirect retries');
}

interface RawWebstreamPhoto {
  photoGuid: string;
  caption?: string;
  mediaAssetType?: 'image' | 'video';
  dateCreated?: string;
  photoDate?: string;
  derivatives?: Record<string, RawDerivative>;
  width?: number;
  height?: number;
}

interface RawDerivative {
  checksum?: string;
  fileSize?: string | number;
  width?: string | number;
  height?: string | number;
}

interface RawWebstreamResponse {
  streamName?: string;
  photos?: RawWebstreamPhoto[];
}

/**
 * Fetch the album feed. Returns the partition host you must reuse for any
 * subsequent fetchAssetUrls call on the same album.
 */
export async function fetchSharedAlbum(
  shareUrl: string,
): Promise<ICloudSharedAlbumFeed> {
  const token = parseICloudShareToken(shareUrl);

  let result;
  try {
    result = await postWithPartitionDiscovery(DEFAULT_START_HOST, token, 'webstream', {
      streamCtag: null,
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      throw new ICloudShareError('Share URL points at a private/loopback address');
    }
    throw err;
  }

  const data = result.data as unknown as RawWebstreamResponse;
  const assets: ICloudSharedAsset[] = (data.photos ?? [])
    .filter((p) => (p.mediaAssetType ?? 'image') === 'image')
    .map((p): ICloudSharedAsset => {
      const derivatives: Record<string, ICloudDerivative> = {};
      for (const [key, d] of Object.entries(p.derivatives ?? {})) {
        if (!d.checksum) continue; // No checksum = no way to fetch URL; skip
        derivatives[key] = {
          checksum: d.checksum,
          width: typeof d.width === 'string' ? parseInt(d.width, 10) : (d.width ?? 0),
          height: typeof d.height === 'string' ? parseInt(d.height, 10) : (d.height ?? 0),
        };
      }
      // Pick the largest derivative as the photo's "real" dimensions.
      const dims = Object.values(derivatives).reduce(
        (best, d) => (d.width > best.width ? d : best),
        { checksum: '', width: 0, height: 0 } as ICloudDerivative,
      );
      const takenStr = p.photoDate ?? p.dateCreated ?? null;
      return {
        photoGuid: p.photoGuid,
        // Apple doesn't give us a filename — synthesize one stable per asset.
        filename: `${p.photoGuid}.jpg`,
        mimeType: 'image/jpeg',
        width: dims.width || (p.width ?? 0),
        height: dims.height || (p.height ?? 0),
        takenAt: takenStr ? new Date(takenStr) : null,
        derivatives,
      };
    });

  return {
    host: result.host,
    albumName: data.streamName ?? null,
    assets,
  };
}

interface RawAssetUrlsResponse {
  items?: Record<string, { url_location?: string; url_path?: string }>;
}

/**
 * Pick the highest-resolution derivative of an asset, or null if it has
 * none with a usable checksum (skipped in the parser above).
 */
export function pickBestDerivative(asset: ICloudSharedAsset): ICloudDerivative | null {
  const all = Object.values(asset.derivatives);
  if (all.length === 0) return null;
  return all.reduce((best, d) => (d.width > best.width ? d : best));
}

/**
 * Fetch signed download URLs for a batch of photoGuids. Apple keys the
 * response by derivative *checksum*, so callers match up via
 * pickBestDerivative(asset).checksum → urlsByChecksum.get(checksum).
 *
 * Signed URLs are short-lived (~30 min); callers must download immediately.
 *
 * @returns Map keyed by checksum → fully-qualified download URL.
 */
export async function fetchAssetUrls(
  host: string,
  shareUrl: string,
  photoGuids: string[],
): Promise<Map<string, string>> {
  if (photoGuids.length === 0) return new Map();
  const token = parseICloudShareToken(shareUrl);

  const result = await postWithPartitionDiscovery(host, token, 'webasseturls', {
    photoGuids,
  });
  const data = result.data as unknown as RawAssetUrlsResponse;

  // Apple's response shape: items keyed by checksum. We don't have checksums
  // mapped back to photoGuids cleanly without re-correlating; we'll let the
  // sync caller re-call webstream + iterate to build the full url. Simpler
  // path: just return the items collection so the caller can stitch.
  // (This is the same approach community tooling uses.)
  const out = new Map<string, string>();
  for (const [checksum, item] of Object.entries(data.items ?? {})) {
    if (item.url_location && item.url_path) {
      out.set(checksum, `https://${item.url_location}${item.url_path}`);
    }
  }
  return out;
}
