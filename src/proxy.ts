import { NextRequest, NextResponse } from 'next/server';

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
export function proxy(request: NextRequest) {
  // Attach (or propagate) request ID for log correlation
  const requestId = request.headers.get('x-request-id') ?? generateRequestId();
  const response = NextResponse.next({
    request: { headers: new Headers({ ...Object.fromEntries(request.headers), 'x-request-id': requestId }) },
  });
  response.headers.set('x-request-id', requestId);

  if (!MUTATION_METHODS.has(request.method)) return response;

  const { pathname } = request.nextUrl;

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
  matcher: '/api/:path*',
};
