import { NextRequest, NextResponse } from 'next/server';
import {
  constantTimeSecretEqual,
  createHouseholdSession,
  getHouseholdAuthState,
  householdCookieOptions,
  HOUSEHOLD_COOKIE_NAME,
} from '@/lib/auth/householdAuth';

export async function GET(request: NextRequest) {
  const configuredToken = process.env.KYST_AUTH_DEVICE_TOKEN;
  const suppliedToken = request.nextUrl.searchParams.get('token') || '';

  if (getHouseholdAuthState() !== 'ready' || !configuredToken) {
    return NextResponse.json({ error: 'Device authentication is unavailable' }, { status: 503 });
  }
  if (!(await constantTimeSecretEqual(suppliedToken, configuredToken))) {
    return NextResponse.json({ error: 'Invalid device credential' }, { status: 401 });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { location: '/', 'cache-control': 'no-store' },
  });
  response.cookies.set(
    HOUSEHOLD_COOKIE_NAME,
    await createHouseholdSession(process.env.KYST_AUTH_SECRET!),
    householdCookieOptions()
  );
  return response;
}
