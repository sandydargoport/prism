/**
 * Immich shared-link client.
 *
 * Supports public shared links and password-protected shared links.
 * For password-protected links we POST to /api/shared-links/login (added in
 * Immich v2.6.0) and reuse the resulting session cookie for subsequent calls.
 *
 * Session cookies for password-protected shares are cached in-memory per
 * sourceId with a 30 minute TTL so a sync or a gallery scroll does not
 * re-login on every asset fetch. Cache survives only the lifetime of the
 * Node process.
 *
 * Every outbound URL is run through validatePublicUrl() before fetch to
 * prevent SSRF: a parent could otherwise paste an internal address into
 * the share URL field and use Prism as a proxy to probe the home network.
 */

import sharp from 'sharp';
import { validatePublicUrl, safeFetch, UnsafeUrlError } from '@/lib/utils/safeFetch';

export interface ImmichShareCredentials {
  serverUrl: string;
  shareKey: string;
  password?: string | null;
  /**
   * Optional source identifier used for the per-source session-cookie
   * cache. When omitted, no cache is consulted and every password
   * call performs a fresh login.
   */
  sourceId?: string;
}

// Per-source session cookie cache for password-protected shares.
// Keyed by sourceId; never populated when the caller did not provide one.
// Cookies live 30 minutes which roughly matches Immich's default share
// session window.
interface CachedCookie {
  cookie: string;
  expiresAt: number;
}
const COOKIE_TTL_MS = 30 * 60 * 1000;
const cookieCache = new Map<string, CachedCookie>();

function readCachedCookie(sourceId: string | undefined): string | null {
  if (!sourceId) return null;
  const entry = cookieCache.get(sourceId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cookieCache.delete(sourceId);
    return null;
  }
  return entry.cookie;
}

function writeCachedCookie(sourceId: string | undefined, cookie: string | null): void {
  if (!sourceId || !cookie) return;
  cookieCache.set(sourceId, { cookie, expiresAt: Date.now() + COOKIE_TTL_MS });
}

/**
 * Test seam: clear the in-memory cookie cache. Production code never
 * needs to call this; tests use it between cases to avoid bleed.
 */
export function _clearImmichCookieCache(): void {
  cookieCache.clear();
}

/**
 * Validate a serverUrl as a safe outbound target. Throws UnsafeUrlError
 * if the URL points at a private / loopback / metadata address.
 */
function assertSafeServerUrl(serverUrl: string): void {
  validatePublicUrl(serverUrl);
}

export interface ImmichAsset {
  id: string;
  originalFileName: string;
  originalMimeType: string;
  type: 'IMAGE' | 'VIDEO' | 'OTHER';
  fileCreatedAt: string;
  /**
   * When the photo was taken on the camera's clock, written as if it were UTC
   * (Immich's localDateTime). The same form OneDrive gives takenDateTime in.
   */
  localDateTime: string | null;
  width: number | null;
  height: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ImmichSharedLink {
  albumId: string | null;
  albumName: string | null;
  allowDownload: boolean;
  hasPassword: boolean;
  assets: ImmichAsset[];
}

export class ImmichPasswordRequiredError extends Error {
  constructor() {
    super('Immich shared link requires a password');
    this.name = 'ImmichPasswordRequiredError';
  }
}

export class ImmichInvalidPasswordError extends Error {
  constructor() {
    super('Incorrect Immich shared link password');
    this.name = 'ImmichInvalidPasswordError';
  }
}

export class ImmichShareNotFoundError extends Error {
  constructor() {
    super('Immich shared link not found');
    this.name = 'ImmichShareNotFoundError';
  }
}

/**
 * Parse an Immich share URL into its server origin and share key.
 *
 * Accepts forms like:
 *   https://immich.example.com/share/abc123
 *   https://immich.example.com/share/abc123/whatever
 *   https://immich.example.com/proxy/share/abc123  (subpath deployments)
 */
export function parseImmichShareUrl(url: string): { serverUrl: string; shareKey: string } {
  const trimmed = (url ?? '').trim();
  if (!trimmed) throw new Error('Immich share URL is required');

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid Immich share URL');
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  const shareIdx = segments.lastIndexOf('share');
  const shareKey = shareIdx === -1 ? undefined : segments[shareIdx + 1];
  if (!shareKey) {
    throw new Error('Immich share URL must contain /share/<key>');
  }
  const basePath = segments.slice(0, shareIdx).join('/');
  const serverUrl = basePath
    ? `${parsed.origin}/${basePath}`
    : parsed.origin;

  return { serverUrl, shareKey };
}

interface RawAsset {
  id: string;
  originalFileName: string;
  originalMimeType: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER';
  fileCreatedAt: string;
  localDateTime?: string | null;
  width?: number | null;
  height?: number | null;
  exifInfo?: { latitude?: number | null; longitude?: number | null } | null;
}

interface RawSharedLinkResponse {
  type?: 'ALBUM' | 'INDIVIDUAL';
  album?: { id?: string; albumName?: string } | null;
  allowDownload?: boolean;
  password?: string | null;
  assets?: RawAsset[];
}

function mapAssets(rawAssets: RawAsset[]): ImmichAsset[] {
  return rawAssets
    .filter((a): a is RawAsset => !!a && typeof a.id === 'string')
    .map((a) => ({
      id: a.id,
      originalFileName: a.originalFileName,
      originalMimeType: a.originalMimeType,
      type: a.type === 'IMAGE' || a.type === 'VIDEO' || a.type === 'OTHER' ? a.type : 'OTHER',
      fileCreatedAt: a.fileCreatedAt,
      localDateTime: a.localDateTime ?? null,
      width: a.width ?? null,
      height: a.height ?? null,
      latitude: a.exifInfo?.latitude ?? null,
      longitude: a.exifInfo?.longitude ?? null,
    }));
}

function mapSharedLink(raw: RawSharedLinkResponse, assetsRaw: RawAsset[]): ImmichSharedLink {
  return {
    albumId: raw.album?.id ?? null,
    albumName: raw.album?.albumName ?? null,
    allowDownload: !!raw.allowDownload,
    hasPassword: raw.password != null,
    assets: mapAssets(assetsRaw),
  };
}

async function fetchAlbumAssets(
  serverUrl: string,
  shareKey: string,
  albumId: string,
  cookie: string | null,
): Promise<RawAsset[]> {
  assertSafeServerUrl(serverUrl);
  // Immich v3 serves a shared album's assets through the search API, not
  // GET /api/albums/{id}: over a share key that endpoint returns the album's
  // assetCount but an EMPTY assets array, so the old call silently synced zero
  // photos. POST /api/search/metadata returns the assets in a paginated
  // envelope ({ assets: { items, nextPage } }). withExif keeps GPS so the
  // Travel Map photo strip still works.
  const url = `${serverUrl}/api/search/metadata?key=${encodeURIComponent(shareKey)}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;

  const all: RawAsset[] = [];
  let page = 1;
  // Bounded so a misbehaving nextPage can never loop forever (100 * 1000
  // assets is far beyond any realistic shared album).
  for (let i = 0; i < 100; i += 1) {
    // safeFetch (not raw fetch) so a share URL that 30x-redirects to an
    // internal host is still re-validated per hop — same SSRF guard the rest
    // of this client uses.
    const res = await safeFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ albumIds: [albumId], page, size: 1000, withExif: true }),
    });
    if (!res.ok) {
      throw new Error(
        `Failed to fetch Immich album ${albumId}: ${res.status} ${res.statusText}`,
      );
    }

    const data = (await res.json()) as {
      assets?: { items?: RawAsset[]; nextPage?: string | number | null };
    };
    all.push(...(data.assets?.items ?? []));

    const next = data.assets?.nextPage;
    if (next == null) break;
    const nextPage = Number(next);
    if (!Number.isFinite(nextPage) || nextPage <= page) break;
    page = nextPage;
  }

  return all;
}

function extractCookies(headers: Headers): string | null {
  const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  let cookies: string[] = [];
  if (typeof getSetCookie === 'function') {
    cookies = getSetCookie.call(headers);
  } else {
    const single = headers.get('set-cookie');
    if (single) {
      // Best-effort split on commas that precede a cookie name (avoids splitting
      // on commas inside Expires=... values).
      cookies = single.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
    }
  }
  const pairs = cookies
    .map((c) => c.split(';')[0]?.trim())
    .filter((p): p is string => !!p);
  return pairs.length ? pairs.join('; ') : null;
}

async function loginShare(
  serverUrl: string,
  shareKey: string,
  password: string,
): Promise<{ raw: RawSharedLinkResponse; cookie: string | null }> {
  assertSafeServerUrl(serverUrl);
  const url = `${serverUrl}/api/shared-links/login?key=${encodeURIComponent(shareKey)}`;
  const res = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new ImmichInvalidPasswordError();
  }
  if (res.status === 404) {
    throw new ImmichShareNotFoundError();
  }
  if (!res.ok) {
    throw new Error(`Immich shared-link login failed: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as RawSharedLinkResponse;
  return { raw, cookie: extractCookies(res.headers) };
}

async function fetchSharedLinkRaw(
  creds: ImmichShareCredentials,
): Promise<{ raw: RawSharedLinkResponse; cookie: string | null }> {
  assertSafeServerUrl(creds.serverUrl);

  if (creds.password) {
    const result = await loginShare(creds.serverUrl, creds.shareKey, creds.password);
    writeCachedCookie(creds.sourceId, result.cookie);
    return result;
  }

  const url = `${creds.serverUrl}/api/shared-links/me?key=${encodeURIComponent(creds.shareKey)}`;
  const res = await safeFetch(url);

  if (res.status === 401 || res.status === 403) {
    throw new ImmichPasswordRequiredError();
  }
  if (res.status === 404) {
    throw new ImmichShareNotFoundError();
  }
  if (!res.ok) {
    throw new Error(`Immich shared-link fetch failed: ${res.status} ${res.statusText}`);
  }

  return { raw: (await res.json()) as RawSharedLinkResponse, cookie: null };
}

/**
 * Fetch shared link metadata + asset list. Throws typed errors when the share
 * requires a password, the password is wrong, or the share is missing.
 *
 * For ALBUM-type shares, Immich's /shared-links/* endpoints return the album
 * metadata but exclude its asset list — so we follow up with /albums/{id} to
 * get the photos. For INDIVIDUAL-type shares, the asset list is returned
 * inline on the share response itself.
 */
export async function fetchSharedLink(
  creds: ImmichShareCredentials,
): Promise<ImmichSharedLink> {
  const { raw, cookie } = await fetchSharedLinkRaw(creds);

  let assetsRaw: RawAsset[];
  if (raw.type === 'ALBUM' && raw.album?.id) {
    assetsRaw = await fetchAlbumAssets(creds.serverUrl, creds.shareKey, raw.album.id, cookie);
  } else {
    assetsRaw = raw.assets ?? [];
  }

  return mapSharedLink(raw, assetsRaw);
}

function thumbnailPath(
  serverUrl: string,
  assetId: string,
  shareKey: string,
  size: 'preview' | 'fullsize',
): string {
  return `${serverUrl}/api/assets/${assetId}/thumbnail?key=${encodeURIComponent(shareKey)}&size=${size}`;
}

/** True when Immich (or a cached original) handed us HEIC/HEIF bytes. */
function isHeic(contentType: string, buffer: Uint8Array): boolean {
  const mime = (contentType.split(';')[0] ?? '').trim().toLowerCase();
  if (mime === 'image/heic' || mime === 'image/heif' || mime === 'image/heic-sequence') {
    return true;
  }
  // ISO BMFF: size(4) + 'ftyp' + brand (heic / heif / mif1 / msf1)
  if (buffer.length < 12) return false;
  const brand = String.fromCharCode(buffer[4]!, buffer[5]!, buffer[6]!, buffer[7]!);
  if (brand !== 'ftyp') return false;
  const major = String.fromCharCode(buffer[8]!, buffer[9]!, buffer[10]!, buffer[11]!).toLowerCase();
  return major === 'heic' || major === 'heif' || major === 'mif1' || major === 'msf1';
}

/**
 * Browsers like Firefox (and most Linux Chromium) cannot decode HEIC.
 * Re-encode to JPEG the same way local uploads do.
 */
async function toWebJpeg(buffer: Uint8Array): Promise<{ buffer: Uint8Array<ArrayBuffer>; contentType: string }> {
  const jpeg = await sharp(buffer).rotate().jpeg({ quality: 85 }).toBuffer();
  const bytes = new Uint8Array(jpeg.byteLength);
  bytes.set(jpeg);
  return { buffer: bytes, contentType: 'image/jpeg' };
}

/**
 * Download an asset's binary via the shared link for on-screen display.
 *
 * We never fetch `/original`. That endpoint needs the share's "allow
 * download" flag (Immich 404s without it) and returns iPhone HEIC, which
 * Firefox and kiosk browsers cannot paint. Thumbnails use Immich's
 * `preview`; full-size display uses `fullsize` (JPEG/WebP when Immich has
 * generated it, otherwise Immich falls back to preview). Leftover HEIC is
 * converted with sharp before we return.
 *
 * For password-protected shares, uses the cached session cookie when one
 * is available for creds.sourceId; falls back to a fresh login on cache
 * miss (and writes the new cookie back). Without a sourceId, every call
 * does a fresh login.
 */
export async function downloadImmichAsset(
  creds: ImmichShareCredentials,
  assetId: string,
  opts: { thumb?: boolean } = {},
): Promise<{ buffer: Uint8Array<ArrayBuffer>; contentType: string }> {
  assertSafeServerUrl(creds.serverUrl);

  let cookie: string | null = null;
  if (creds.password) {
    cookie = readCachedCookie(creds.sourceId);
    if (!cookie) {
      const fresh = await loginShare(creds.serverUrl, creds.shareKey, creds.password);
      cookie = fresh.cookie;
      writeCachedCookie(creds.sourceId, cookie);
    }
  }

  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;

  const get = (size: 'preview' | 'fullsize') =>
    safeFetch(thumbnailPath(creds.serverUrl, assetId, creds.shareKey, size), { headers });

  // safeFetch re-validates any redirect Location, so a share URL that 30x-
  // redirects to an internal host can no longer be used to exfiltrate the
  // internal response (was `redirect: 'follow'`, which bypassed the guard).
  let res = await get(opts.thumb ? 'preview' : 'fullsize');
  // Older Immich (no fullsize size) or derivative not generated yet → preview.
  // Only 404/400: 401/403 mean a bad share session (drop the cookie below);
  // 5xx should fail closed rather than hide an Immich outage behind a retry.
  if (!res.ok && !opts.thumb && (res.status === 404 || res.status === 400)) {
    res = await get('preview');
  }
  if (!res.ok) {
    // If the cache returned a stale cookie that the server rejected, drop
    // it and let the next call re-login. We don't auto-retry here because
    // the proxy route's cache layer will request the next time anyway.
    if (creds.sourceId && (res.status === 401 || res.status === 403)) {
      cookieCache.delete(creds.sourceId);
    }
    throw new Error(
      `Failed to download Immich asset ${assetId}: ${res.status} ${res.statusText}`,
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  const raw = Buffer.from(arrayBuffer);
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';

  if (isHeic(contentType, raw)) {
    return toWebJpeg(raw);
  }
  const bytes = new Uint8Array(raw.byteLength);
  bytes.set(raw);
  return { buffer: bytes, contentType };
}

// Re-export so route handlers can branch on UnsafeUrlError specifically
// when shaping their HTTP response.
export { UnsafeUrlError };
