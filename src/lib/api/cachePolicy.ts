/**
 * API routes that send their own Cache-Control, and so must not get the
 * default below. A header the proxy sets is one the route can no longer
 * change: Next copies a route's headers onto the response only where the
 * proxy left them unset. Matched against the pathname.
 *
 * These are the binary files a display shows over and over (photos, recipe
 * images, avatars), which are worth caching. Health checks send no-store
 * themselves, so the default already agrees with them.
 */
export const OWN_CACHE_POLICY: readonly RegExp[] = [
  /^\/api\/photos\/[^/]+\/file$/,
  /^\/api\/recipes\/[^/]+\/image$/,
  /^\/api\/family\/[^/]+\/avatar$/,
];

/**
 * Whether a response may be kept by the browser. API data is the household's
 * live state, so the answer is no unless the route says otherwise.
 *
 * Without this the JSON went out with no caching instructions at all, which
 * is fine for a browser that follows the defaults and not for one that does
 * not: Fully Kiosk's "Use cache even if expired" answers every repeat request
 * from its cache, so a wall display kept polling and kept getting the
 * response from its first load. no-store, rather than no-cache, because that
 * mode serves anything it has stored, fresh or not; the only way to keep it
 * from serving stale data is for there to be nothing stored.
 */
export function applyApiCachePolicy(pathname: string, headers: Headers): void {
  if (!pathname.startsWith('/api/')) return;
  if (OWN_CACHE_POLICY.some((pattern) => pattern.test(pathname))) return;
  headers.set('Cache-Control', 'no-store');
}
