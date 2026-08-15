import { isPrivateHostname } from '@/lib/utils/safeFetch';

/**
 * Resolve an OAuth redirect URI from the current request, honoring reverse-proxy
 * forwarded headers (Cloudflare Tunnel, nginx, etc.).
 *
 * Prism is commonly reached via more than one host — a public https hostname
 * over WAN and an http://192.168.x.x:3000 LAN address. The OAuth redirect URI
 * must match the host the user actually started the flow from: the provider
 * validates that /token's `redirect_uri` equals /authorize's, and the post-auth
 * redirect has to land back on the same origin so the Prism session cookie is
 * sent. Deriving it from the request — instead of a single static
 * `*_REDIRECT_URI` env var — removes the most common self-host footgun, a
 * `redirect_uri_mismatch` when the env var doesn't byte-match what was
 * registered in the provider console (#124). Generalizes
 * `resolveKrogerRedirectUri` to any callback path.
 *
 * The user still registers the resulting URI(s) in their provider app; this just
 * picks the right one per request and keeps /authorize and /token in lockstep.
 */
export function resolveRedirectUri(request: Request, callbackPath: string): string {
  const headers = request.headers;
  const xfHost = headers.get('x-forwarded-host');
  const xfProto = headers.get('x-forwarded-proto');
  const url = new URL(request.url);
  const host = xfHost ?? headers.get('host') ?? url.host;
  const proto = xfProto ?? url.protocol.replace(':', '');
  const derived = `${proto}://${host}${callbackPath}`;

  // OAuth providers (notably Google) reject private-IP / non-HTTPS redirect
  // URIs. If the request resolved to one — usually because Prism was reached
  // directly on the LAN (http://192.168.x.x:3000) instead of through its public
  // HTTPS proxy — fall back to the configured public base URL (APP_URL) so the
  // provider still gets a valid redirect_uri. When APP_URL is unset or itself
  // non-public (the dev default localhost), the derived value is kept, so
  // multi-host setups (#124) and local development are unaffected.
  if (proto !== 'https' || isPrivateHostname(hostnameOf(host))) {
    const base = process.env.APP_URL;
    if (base) {
      try {
        const b = new URL(base);
        if (b.protocol === 'https:' && !isPrivateHostname(b.hostname)) {
          return new URL(callbackPath, b).toString();
        }
      } catch { /* malformed APP_URL — fall through to the derived value */ }
    }
  }
  return derived;
}

/** Extract the bare hostname (no port, no IPv6 brackets) from a Host value. */
function hostnameOf(host: string): string {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return host;
  }
}
