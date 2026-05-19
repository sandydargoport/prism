import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { discoverCalendars } from '@/lib/integrations/caldav';

/**
 * POST /api/caldav/discover
 * Discover available calendars on a CalDAV server.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const { serverUrl, username, password } = await request.json();

    if (!serverUrl || !username || !password) {
      return NextResponse.json(
        { error: 'Server URL, username, and password are required' },
        { status: 400 }
      );
    }

    const calendars = await discoverCalendars(serverUrl, username, password);
    return NextResponse.json({ calendars });
  } catch (error) {
    console.error('CalDAV discover error:', error);
    return NextResponse.json(
      { error: 'Failed to discover calendars' },
      { status: 500 }
    );
  }
}
