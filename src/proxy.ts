import { NextRequest, NextResponse } from 'next/server';
import { isAuthWallEnabled, verifyTrustedDeviceToken, TRUSTED_DEVICE_COOKIE } from '@/lib/auth/authWall';
import { validateSession } from '@/lib/auth/session';

/**
 * Paths that stay reachable with the authentication wall on (#339). Without
 * these the sign-in page cannot render, the container reports itself
 * unhealthy, and the PWA cannot fetch its own manifest — a wall that locks out
 * the machinery keeping the instance alive.
 */
const WALL_ALLOWLIST = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/health',
  // The sign-in page lists family members to pick from, so it needs this. It
  // discloses first names and avatars to an unauthenticated caller, which is
  // the same thing the sign-in page itself already admits by existing. If the
  // 404-for-strangers option on #339 is taken, this goes behind it too.
  '/api/family',
  '/manifest.json',
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.ico',
];

/**
 * The setting lives in Postgres and this runs on every request, so it is cached
 * briefly. A few seconds of staleness after flipping the toggle is the cost;
 * the alternative is a database round trip per page load, on displays that feel
 * every one of them.
 */
let wallCache: { value: boolean; at: number } | null = null;
const WALL_CACHE_MS = 5_000;

async function wallIsOn(): Promise<boolean> {
  const now = Date.now();
  if (wallCache && now - wallCache.at < WALL_CACHE_MS) return wallCache.value;
  const value = await isAuthWallEnabled();
  wallCache = { value, at: now };
  return value;
}

/**
 * What an unauthenticated caller gets. Kept as one function on purpose: the
 * open question on #339 is whether an internet-exposed instance should answer
 * 404 instead, to avoid confirming a Prism install sits at that address. When
 * that is decided, this is the only place that changes.
 */
function lockedOutResponse(request: NextRequest, requestId: string): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    const res = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const signIn = new URL('/login', request.url);
  signIn.searchParams.set('next', pathname);
  const res = NextResponse.redirect(signIn);
  res.headers.set('x-request-id', requestId);
  return res;
}

/** A session cookie that actually validates, or a device a parent trusted. */
async function callerMayPass(request: NextRequest): Promise<boolean> {
  if (verifyTrustedDeviceToken(request.cookies.get(TRUSTED_DEVICE_COOKIE)?.value)) return true;

  const token = request.cookies.get('prism_session')?.value;
  if (!token) return false;
  try {
    const result = await validateSession(token);
    return result.ok;
  } catch {
    // Session store unreachable. Refusing here would lock the household out on
    // a Redis blip, and the server-side gate in getDisplayAuth still stands.
    return true;
  }
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Routes called by external services or with their own auth/origin logic.
 * These are exempt from the blanket CSRF Origin check.
 */
const CSRF_EXEMPT_PREFIXES = [
  '/api/away-mode',      // has its own same-origin check
];

/**
 * Mutation paths that are allowed to bypass DEMO_MODE so the demo is
 * actually usable. Login is needed so visitors can switch between members
 * to see role-based UI; logout is needed so they don't get stuck.
 */
const DEMO_ALLOWED_MUTATIONS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
];

function generateRequestId(): string {
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * CSRF protection + request ID injection.
 *
 * Adds x-request-id to all API responses for log correlation.
 * For browser-originated mutation requests, verifies Origin matches Host.
 * Non-browser clients (no Origin header) bypass CSRF — they rely on other
 * auth layers (requireAuth, API tokens).
 */
export async function proxy(request: NextRequest) {
  // Attach (or propagate) request ID for log correlation
  const requestId = request.headers.get('x-request-id') ?? generateRequestId();
  const response = NextResponse.next({
    request: { headers: new Headers({ ...Object.fromEntries(request.headers), 'x-request-id': requestId }) },
  });
  response.headers.set('x-request-id', requestId);

  const { pathname } = request.nextUrl;

  // The authentication wall (#339). Off by default, and the check short-circuits
  // on a cached boolean when it is off, so an instance that never turns it on
  // pays nothing per request.
  if (!WALL_ALLOWLIST.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    if (await wallIsOn()) {
      if (!(await callerMayPass(request))) return lockedOutResponse(request, requestId);
    }
  }

  if (!MUTATION_METHODS.has(request.method)) return response;

  // DEMO_MODE: refuse mutations so visitors can't trash the seed data
  // for everyone. A friendly error tells them this is a demo and points
  // them at the repo. The login path is allowed so they can switch
  // members to see role-based UI.
  if (process.env.DEMO_MODE === 'true' && !DEMO_ALLOWED_MUTATIONS.some((p) => pathname.startsWith(p))) {
    const forbidden = NextResponse.json(
      {
        error: 'demo_mode',
        message: 'This is a read-only demo. Clone https://github.com/sandydargoport/prism to try changes on your own instance.',
      },
      { status: 403 },
    );
    forbidden.headers.set('x-request-id', requestId);
    return forbidden;
  }

  if (CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return response;

  const origin = request.headers.get('origin');
  if (!origin) {
    // No Origin header — non-browser client, allow through
    return response;
  }

  const host = request.headers.get('host');
  if (!host) return response;

  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      forbidden.headers.set('x-request-id', requestId);
      return forbidden;
    }
  } catch {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    forbidden.headers.set('x-request-id', requestId);
    return forbidden;
  }

  return response;
}

export const config = {
  // Was '/api/:path*'. Page routes were never matched, so nothing gated them —
  // half of why an instance was readable by anyone who could reach the port
  // (#339). Now everything runs through here except Next's own build output and
  // static files, which carry no household data and would only add latency.
  //
  // The CSRF and DEMO_MODE logic below still applies only to mutations, and the
  // wall short-circuits on a cached boolean when it is off, so matching more
  // paths costs a comparison per request rather than a round trip.
  matcher: ['/((?!_next/static|_next/image|_next/data|icons/|twemoji/|maplibre/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|ttf|otf|mjs|map)$).*)'],
};
