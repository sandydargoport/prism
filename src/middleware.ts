import { NextRequest, NextResponse } from 'next/server';
import {
  createHouseholdSession,
  getHouseholdAuthState,
  householdCookieOptions,
  HOUSEHOLD_COOKIE_NAME,
  HOUSEHOLD_SERVICE_HEADER,
  constantTimeSecretEqual,
  validateHouseholdSession,
} from '@/lib/auth/householdAuth';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Routes called by external services or with their own auth/origin logic.
 * These are exempt from the blanket CSRF Origin check.
 */
const CSRF_EXEMPT_PREFIXES = [
  '/api/away-mode', // has its own same-origin check
];

/**
 * Mutation paths that are allowed to bypass DEMO_MODE so the demo is
 * actually usable. Login is needed so visitors can switch between members
 * to see role-based UI; logout is needed so they don't get stuck.
 */
const DEMO_ALLOWED_MUTATIONS = ['/api/auth/login', '/api/auth/logout', '/api/auth/session'];

const HOUSEHOLD_PUBLIC_PATHS = ['/auth/household', '/api/health', '/api/health/ready'];
const HOUSEHOLD_PUBLIC_PREFIXES = ['/api/household-auth/', '/workbox-'];

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
function isHouseholdPublicPath(pathname: string): boolean {
  return (
    HOUSEHOLD_PUBLIC_PATHS.includes(pathname) ||
    pathname === '/sw.js' ||
    HOUSEHOLD_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function attachRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('x-request-id', requestId);
  return response;
}

async function enforceHouseholdAuth(
  request: NextRequest,
  response: NextResponse,
  requestId: string
): Promise<NextResponse | null> {
  const state = getHouseholdAuthState();
  if (state === 'disabled') return null;

  const { pathname } = request.nextUrl;
  if (isHouseholdPublicPath(pathname)) return null;

  if (state === 'misconfigured') {
    return attachRequestId(
      NextResponse.json({ error: 'Household authentication is misconfigured' }, { status: 503 }),
      requestId
    );
  }

  const secret = process.env.KYST_AUTH_SECRET!;
  const session = await validateHouseholdSession(
    request.cookies.get(HOUSEHOLD_COOKIE_NAME)?.value,
    secret
  );

  let serviceAuthenticated = false;
  const configuredServiceToken = process.env.KYST_AUTH_SERVICE_TOKEN;
  const suppliedServiceToken = request.headers.get(HOUSEHOLD_SERVICE_HEADER);
  if (configuredServiceToken && suppliedServiceToken) {
    serviceAuthenticated = await constantTimeSecretEqual(
      suppliedServiceToken,
      configuredServiceToken
    );
  }

  if (!session.valid && !serviceAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return attachRequestId(
        NextResponse.json({ error: 'Household authentication required' }, { status: 401 }),
        requestId
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/auth/household';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return attachRequestId(NextResponse.redirect(loginUrl), requestId);
  }

  if (session.valid && session.renew) {
    response.cookies.set(
      HOUSEHOLD_COOKIE_NAME,
      await createHouseholdSession(secret),
      householdCookieOptions()
    );
  }

  return null;
}

export async function middleware(request: NextRequest) {
  // Attach (or propagate) request ID for log correlation
  const requestId = request.headers.get('x-request-id') ?? generateRequestId();
  const response = NextResponse.next({
    request: {
      headers: new Headers({ ...Object.fromEntries(request.headers), 'x-request-id': requestId }),
    },
  });
  response.headers.set('x-request-id', requestId);

  const householdAuthResponse = await enforceHouseholdAuth(request, response, requestId);
  if (householdAuthResponse) return householdAuthResponse;

  if (!MUTATION_METHODS.has(request.method)) return response;

  const { pathname } = request.nextUrl;

  // DEMO_MODE: refuse mutations so visitors can't trash the seed data
  // for everyone. A friendly error tells them this is a demo and points
  // them at the repo. The login path is allowed so they can switch
  // members to see role-based UI.
  if (
    process.env.DEMO_MODE === 'true' &&
    !DEMO_ALLOWED_MUTATIONS.some((p) => pathname.startsWith(p))
  ) {
    const forbidden = NextResponse.json(
      {
        error: 'demo_mode',
        message:
          'This is a read-only demo. Clone https://github.com/sandydargoport/prism to try changes on your own instance.',
      },
      { status: 403 }
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
  matcher: [
    '/api/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-|icons/|logo-prism.png).*)',
  ],
};
