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
  const url = `${serverUrl}/api/albums/${albumId}?key=${encodeURIComponent(shareKey)}`;
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;

  const res = await safeFetch(url, { headers });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch Immich album ${albumId}: ${res.status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as { assets?: RawAsset[] };
  return data.assets ?? [];
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

/**
 * Download an asset's binary via the shared link. Returns the raw buffer +
 * upstream Content-Type so the proxy can pass it through unchanged.
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

  const path = opts.thumb
    ? `/api/assets/${assetId}/thumbnail?key=${encodeURIComponent(creds.shareKey)}&size=preview`
    : `/api/assets/${assetId}/original?key=${encodeURIComponent(creds.shareKey)}`;

  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;

  // safeFetch re-validates any redirect Location, so a share URL that 30x-
  // redirects to an internal host can no longer be used to exfiltrate the
  // internal response (was `redirect: 'follow'`, which bypassed the guard).
  const res = await safeFetch(`${creds.serverUrl}${path}`, { headers });
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
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

// Re-export so route handlers can branch on UnsafeUrlError specifically
// when shaping their HTTP response.
export { UnsafeUrlError };
