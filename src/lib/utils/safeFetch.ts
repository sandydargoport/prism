/**
 * Outbound URL validation for endpoints that fetch user-supplied URLs.
 *
 * The threat model is server-side request forgery: a route accepts a URL
 * from the client and the server fetches it. Without a guard, the URL
 * can point at the loopback interface, RFC1918 private space, link-local
 * addresses (including the cloud metadata IP 169.254.169.254), or IPv6
 * loopback / ULA. That lets an authenticated parent (or anyone reaching
 * a setup-mode unauthenticated bypass) probe the internal network from
 * the Prism container.
 *
 * Use validatePublicUrl() before any outbound fetch whose target is
 * derived from user input. Returns the parsed URL on success and throws
 * UnsafeUrlError on rejection.
 *
 * Caveats:
 * - This validates the *hostname literal* in the URL. A DNS rebinding
 *   attacker can return a public address at validation time and a
 *   private address at fetch time. Defense for that is calling fetch
 *   with the resolved IP (e.g. dns.lookup the host, validate the IP,
 *   then fetch using that IP with a Host header). We do not implement
 *   that here because the practical threat model for a self-hosted
 *   family dashboard does not justify the complexity. If this file
 *   ever guards a route reachable by anonymous internet callers, add
 *   the resolve-then-fetch step.
 * - In NODE_ENV !== 'production' we allow localhost / 127.0.0.1 so
 *   developer flows that point at a local Immich or local iCal feed
 *   still work. Production builds reject those.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function isPrivateIPv4(host: string): boolean {
  // Match dotted-quad form. We are lenient on padding and per-octet
  // ranges since the URL parser already accepts only valid forms.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [, a, b] = m.map(Number) as [number, number, number, number, number];
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local + cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8 (this network)
  if (a === 0) return true;
  // 100.64.0.0/10 (carrier-grade NAT, often used internally)
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIPv6(host: string): boolean {
  // Strip surrounding brackets the URL parser leaves on bracketed IPv6.
  const stripped = host.startsWith('[') && host.endsWith(']')
    ? host.slice(1, -1)
    : host;
  const lower = stripped.toLowerCase();
  // Loopback ::1
  if (lower === '::1') return true;
  // Unspecified ::
  if (lower === '::') return true;
  // IPv4-mapped IPv6 in either dotted-quad form (::ffff:a.b.c.d) or in
  // the parser-normalized form Node produces (::ffff:7f00:1 etc). Reject
  // unconditionally: there is no legitimate server-to-server reason to
  // fetch via an IPv4-mapped IPv6 literal, and per-mapping IPv4-range
  // checks are easy to bypass via varying compression. Treat the whole
  // ::ffff:0:0/96 prefix as off-limits.
  if (lower.startsWith('::ffff:')) return true;
  // Unique local fc00::/7 (covers fc.. and fd.. prefixes)
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  return false;
}

function isLocalhostName(host: string): boolean {
  const lower = host.toLowerCase();
  return lower === 'localhost' || lower.endsWith('.localhost');
}

export interface ValidatePublicUrlOptions {
  /** Override the production check; defaults to NODE_ENV === 'production'. */
  isProduction?: boolean;
}

/**
 * Validate that a URL is safe for the server to fetch as an outbound
 * request. Returns the parsed URL object on success. Throws
 * UnsafeUrlError otherwise.
 *
 * Rejected: non-http(s) protocols, loopback, RFC1918 private ranges,
 * link-local, cloud metadata IP, IPv6 loopback / ULA / link-local.
 * In non-production, localhost and 127.x are permitted to keep dev
 * flows working.
 */
export function validatePublicUrl(
  rawUrl: string,
  options: ValidatePublicUrlOptions = {},
): URL {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    throw new UnsafeUrlError('URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('URL is not parseable');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new UnsafeUrlError(`Protocol ${parsed.protocol} is not allowed; use http or https`);
  }

  const isProd = options.isProduction ?? process.env.NODE_ENV === 'production';
  const host = parsed.hostname;

  // IPv6 literals come bracketed in URL.hostname on some runtimes and
  // unbracketed on others, so isPrivateIPv6 handles both shapes.
  if (host.includes(':') || (host.startsWith('[') && host.endsWith(']'))) {
    if (isPrivateIPv6(host)) {
      throw new UnsafeUrlError('URL points at a private or loopback IPv6 address');
    }
    return parsed;
  }

  if (isPrivateIPv4(host)) {
    // Loopback / 127.x is allowed in non-production for local dev.
    if (!isProd && /^127\./.test(host)) return parsed;
    throw new UnsafeUrlError('URL points at a private or loopback IPv4 address');
  }

  if (isLocalhostName(host)) {
    if (!isProd) return parsed;
    throw new UnsafeUrlError('URL points at localhost');
  }

  return parsed;
}

export interface SafeFetchOptions extends ValidatePublicUrlOptions {
  /** Maximum redirect hops to follow, each re-validated. Default 5. */
  maxRedirects?: number;
}

// 3xx statuses that carry a Location we would otherwise auto-follow.
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * SSRF-safe wrapper around fetch().
 *
 * validatePublicUrl() only guards the *initial* host. Left to the platform,
 * fetch follows 3xx redirects automatically — so a public host that 30x-
 * redirects to an internal address (loopback / RFC1918 / 169.254.169.254)
 * slips past the guard and the internal target is fetched. safeFetch closes
 * that: it validates the initial URL, fetches with `redirect: 'manual'`, and
 * re-runs validatePublicUrl() on the Location of every hop before following
 * it. Cross-host or private redirect targets throw UnsafeUrlError.
 *
 * Per-hop method handling mirrors the fetch spec: 303 (and 301/302 on a
 * non-GET/HEAD request) downgrade to GET and drop the body; 307/308 preserve
 * both. The DNS-rebinding caveat documented on validatePublicUrl() still
 * applies — each hop validates the hostname literal, not the resolved IP.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 5;
  let currentUrl = validatePublicUrl(rawUrl, options).toString();
  let method = init.method ?? 'GET';
  let body = init.body;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(currentUrl, { ...init, method, body, redirect: 'manual' });

    if (!REDIRECT_STATUSES.has(res.status)) return res;

    const location = res.headers.get('location');
    // A 3xx with no Location is not followable; hand it back unchanged.
    if (!location) return res;

    // Resolve relative Locations against the current URL, then re-validate
    // the absolute target before the next hop touches the network.
    const next = new URL(location, currentUrl);
    validatePublicUrl(next.toString(), options);
    currentUrl = next.toString();

    const downgradeToGet =
      res.status === 303 ||
      ((res.status === 301 || res.status === 302) && method !== 'GET' && method !== 'HEAD');
    if (downgradeToGet) {
      method = 'GET';
      body = undefined;
    }
  }

  throw new UnsafeUrlError(`Too many redirects (>${maxRedirects})`);
}
