import { NextRequest, NextResponse } from 'next/server';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import {
  constantTimeSecretEqual,
  createHouseholdSession,
  getHouseholdAuthState,
  householdCookieOptions,
  HOUSEHOLD_COOKIE_NAME,
} from '@/lib/auth/householdAuth';

function clientAddress(request: NextRequest): string {
  return (
    request.headers.get('fly-client-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  if (getHouseholdAuthState() !== 'ready') {
    return NextResponse.json({ error: 'Household authentication is unavailable' }, { status: 503 });
  }

  const limited = await rateLimitGuard(`household:${clientAddress(request)}`, 'login', 8, 15 * 60);
  if (limited) return limited;

  let password = '';
  try {
    const body = await request.json();
    if (typeof body.password === 'string') password = body.password;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!(await constantTimeSecretEqual(password, process.env.KYST_AUTH_PASSWORD!))) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(
    HOUSEHOLD_COOKIE_NAME,
    await createHouseholdSession(process.env.KYST_AUTH_SECRET!),
    householdCookieOptions()
  );
  return response;
}
