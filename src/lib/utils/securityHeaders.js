/**
 * Builds security headers for Next.js config.
 *
 * Iframe embedding is controlled via the ALLOWED_FRAME_ANCESTORS env var, read
 * at request time by src/proxy.ts:
 *   - Not set:          Only same-origin embedding allowed (X-Frame-Options: SAMEORIGIN)
 *   - Comma-separated:  Specific origins allowed (e.g., "http://homeassistant.local:8123")
 *   - "*":              Any origin can embed (no X-Frame-Options, frame-ancestors *)
 *
 * Example for Home Assistant:
 *   ALLOWED_FRAME_ANCESTORS=http://homeassistant.local:8123
 */
/**
 * The frame policy for a given ALLOWED_FRAME_ANCESTORS value: the full
 * Content-Security-Policy, and X-Frame-Options when only same-origin framing
 * is allowed (null otherwise).
 *
 * next.config.js headers are computed when the image is BUILT, so they only
 * ever see the build's environment. src/proxy.ts calls this again per request
 * with the running container's value, which is what makes the variable work
 * on a published image or the Home Assistant add-on.
 *
 * @param {string | undefined} allowedAncestorsRaw
 * @returns {{ csp: string; xFrameOptions: string | null }}
 */
function buildFramePolicy(allowedAncestorsRaw) {
  const allowedAncestors = allowedAncestorsRaw?.trim();
  let frameAncestors;
  let xFrameOptions = null;

  if (allowedAncestors === '*') {
    frameAncestors = 'frame-ancestors *';
  } else if (allowedAncestors) {
    const origins = allowedAncestors
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    frameAncestors = `frame-ancestors 'self' ${origins.join(' ')}`;
  } else {
    xFrameOptions = 'SAMEORIGIN';
    frameAncestors = "frame-ancestors 'self'";
  }

  // Note: Next.js 15 App Router requires 'unsafe-inline' for script/style
  // (hydration and Tailwind). The meaningful protections here are object-src,
  // base-uri, and frame-src.
  const csp = [
    "default-src 'self'",
    // Next.js requires unsafe-inline for hydration; unsafe-eval for dev HMR
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    // Tailwind requires unsafe-inline for style attributes
    "style-src 'self' 'unsafe-inline'",
    // Images from configured remote patterns + data URIs + blob URLs
    "img-src 'self' data: blob: https:",
    // Fonts served locally
    "font-src 'self'",
    // API calls: self + external integrations (weather, MS Graph, Google, Open Food Facts)
    "connect-src 'self' https: wss:",
    // Audio for voice input beep feedback
    "media-src 'self' blob:",
    // PWA service worker
    "worker-src 'self' blob:",
    // Prism never loads external frames
    "frame-src 'none'",
    // Block all plugin content (Flash, etc.)
    "object-src 'none'",
    // Prevent base tag injection attacks
    "base-uri 'self'",
    frameAncestors,
  ].join('; ');

  return { csp, xFrameOptions };
}

function buildSecurityHeaders() {
  /** @type {{ key: string; value: string }[]} */
  const headers = [];

  // X-Frame-Options is set only by src/proxy.ts, at request time: a header
  // added here cannot be removed there, so a build-time SAMEORIGIN would
  // outlive a runtime ALLOWED_FRAME_ANCESTORS. The CSP here is the build's
  // default, and the proxy replaces it with the runtime one.
  const { csp } = buildFramePolicy(process.env.ALLOWED_FRAME_ANCESTORS);
  headers.push({ key: 'Content-Security-Policy', value: csp });

  // ---------------------------------------------------------------------------
  // Other security headers
  // ---------------------------------------------------------------------------

  headers.push({ key: 'X-Content-Type-Options', value: 'nosniff' });
  headers.push({ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' });

  // HSTS: enforce HTTPS for 1 year (applies when served over TLS via Cloudflare tunnel)
  headers.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  });

  // Restrict unused browser features. Microphone kept for voice input.
  headers.push({
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), payment=(), usb=(), bluetooth=()',
  });

  headers.push({ key: 'X-DNS-Prefetch-Control', value: 'off' });

  return headers;
}

module.exports = { buildSecurityHeaders, buildFramePolicy };
