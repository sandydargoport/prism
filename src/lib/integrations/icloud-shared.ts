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

// Starting partition — any valid one works because Apple's 330 redirect
// tells us the canonical host. p23 is a well-known partition that's
// reliably alive (community tooling uses it as default). Apple's CDN
// doesn't actually have a p123 partition, so the previous default was
// hitting "host not found" → 400 from the load balancer instead of the
// expected 330 redirect.
const DEFAULT_START_HOST = 'p23-sharedstreams.icloud.com';

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

  // share.icloud.com short links must be resolved first via
  // resolveICloudShareUrl() — they 301-redirect to the real /photos/#TOKEN
  // URL. We can't follow redirects synchronously, so callers (fetchSharedAlbum)
  // call the resolver before getting here. If a short link reaches the parser
  // unresolved, fail loudly so the bug is visible.
  if (/^https?:\/\/share\.icloud\.com\//i.test(trimmed)) {
    throw new ICloudShareError(
      'Short share.icloud.com link reached the parser unresolved — call resolveICloudShareUrl first',
    );
  }

  // Detect the iCloud signed-in CloudKit URL format (/photos/#/sa,UUID/)
  // and reject explicitly. That's the path the modern web client navigates
  // to while signed in — CloudKit-backed and not publicly accessible.
  // Without this check users get a confusing 400 from a malformed request.
  if (/\/photos\/#\/sa,[0-9A-F-]+/i.test(trimmed)) {
    throw new ICloudShareError(
      'That URL is from your signed-in iCloud Photos view, not a public share. ' +
      'In Apple Photos, open the album → People icon → toggle "Public Website" on → ' +
      'tap Share Link. The resulting URL should be a share.icloud.com/photos/... short link.'
    );
  }

  // Hash fragment carries the token. Modern URLs look like
  //   https://www.icloud.com/photos/#0c3g0wu0EWBQ...
  // Legacy URLs look like
  //   https://www.icloud.com/sharedalbum/#B1aXyZ...
  // Both terminate in #TOKEN with no further path, so this branch handles both.
  const hashIdx = trimmed.indexOf('#');
  if (hashIdx < 0) {
    throw new ICloudShareError('Share URL is missing the album token after #');
  }
  const token = trimmed.slice(hashIdx + 1);
  if (!token) {
    throw new ICloudShareError('Empty share token');
  }
  // Reject CloudKit-style tokens (UUID with commas/slashes) that get past
  // the regex above — defense in depth.
  if (token.includes('/') || token.includes(',')) {
    throw new ICloudShareError(
      'That doesn\'t look like a public iCloud Shared Album link. ' +
      'Make sure the album has "Public Website" enabled and use the Share Link.'
    );
  }
  return token;
}

/**
 * Resolve a share.icloud.com short link to its canonical
 * www.icloud.com/photos/#TOKEN form. Pass-through for URLs that are
 * already canonical.
 *
 * Apple's share.icloud.com server replies with a 301 + Location header
 * containing the real URL. We do this server-side because the canonical
 * URL is what the sharedstreams API needs to derive the token from.
 */
export async function resolveICloudShareUrl(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!/^https?:\/\/share\.icloud\.com\//i.test(trimmed)) {
    return trimmed;
  }
  await validatePublicUrl(trimmed);
  const res = await fetch(trimmed, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    },
  });
  // 301/302/308 with Location header — what we expect.
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('Location');
    if (!loc) {
      throw new ICloudShareError('Short share link redirected without a Location header');
    }
    // The destination must still be an icloud.com URL — defence against
    // a misconfigured server forwarding to an arbitrary host.
    if (!/^https:\/\/[a-z0-9.-]+\.icloud\.com\//i.test(loc)) {
      throw new ICloudShareError(`Short link redirected to unexpected host: ${loc.slice(0, 80)}`);
    }
    return loc;
  }
  // 404 on the short link itself = the album was unshared or the link is wrong.
  if (res.status === 404) {
    throw new ICloudShareNotFoundError('Shared album not found at that short link');
  }
  throw new ICloudShareError(`Short link resolve returned ${res.status}`);
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
        // Apple's shared-streams endpoint quirk: the body is JSON but the
        // Content-Type must be text/plain. application/json triggers a
        // CORS preflight that the server doesn't answer.
        'Content-Type': 'text/plain',
        // Origin header is required — Apple validates that the request
        // looks like it's coming from icloud.com's own preview UI.
        // Without this, the server returns 400.
        'Origin': 'https://www.icloud.com',
        'Referer': 'https://www.icloud.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
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
  const resolved = await resolveICloudShareUrl(shareUrl);
  const token = parseICloudShareToken(resolved);

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
  const resolved = await resolveICloudShareUrl(shareUrl);
  const token = parseICloudShareToken(resolved);

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
