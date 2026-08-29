/**
 * Can Google's browser sign-in work from the address the user is on?
 *
 * Google validates redirect URIs before it will show a consent screen. It
 * accepts https on a public domain, and makes one exception for loopback
 * (http://localhost and http://127.0.0.1, any port). Everything a home install
 * typically uses — http://192.168.x.x:3000, a Tailscale IP, homeassistant.local
 * — is refused outright with `invalid_request` before the user can do anything
 * about it.
 *
 * Offering a Connect button that cannot succeed is the wrong end of the
 * problem: the user clicks it, Google refuses in its own words, and nothing on
 * the Prism side explains why. Knowing in advance lets the UI point at the
 * paste-a-token flow, which needs no redirect URI at all.
 */

/** Loopback is the one non-https address Google allows. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * True when Google would accept a redirect URI built from this origin.
 *
 * Deliberately conservative: anything unparseable is treated as unusable, so
 * the UI steers toward the flow that always works rather than the one that
 * might not.
 */
export function browserOAuthUsable(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();

    if (LOOPBACK.has(host)) return true;
    if (url.protocol !== 'https:') return false;

    // A bare IP is refused even over https — Google requires a domain.
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) return false;

    // Google requires a public top-level domain. `.local`, single-label hosts
    // and `.internal` are all rejected by the console and the auth endpoint.
    if (!host.includes('.')) return false;
    const tld = host.slice(host.lastIndexOf('.') + 1);
    if (['local', 'internal', 'lan', 'home', 'localdomain'].includes(tld)) return false;

    return true;
  } catch {
    return false;
  }
}
