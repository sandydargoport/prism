import { NextRequest, NextResponse } from 'next/server';
import { householdCookieOptions, HOUSEHOLD_COOKIE_NAME } from '@/lib/auth/householdAuth';

export async function POST(_request: NextRequest) {
  const response = new NextResponse(null, {
    status: 303,
    headers: { location: '/auth/household' },
  });
  response.cookies.set(HOUSEHOLD_COOKIE_NAME, '', householdCookieOptions(0));
  return response;
}
