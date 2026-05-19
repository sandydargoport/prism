import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { testCalDAVConnection } from '@/lib/integrations/caldav';

/**
 * POST /api/caldav/test
 * Test connectivity to a CalDAV server.
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

    const result = await testCalDAVConnection(serverUrl, username, password);
    return NextResponse.json(result);
  } catch (error) {
    console.error('CalDAV test error:', error);
    return NextResponse.json(
      { success: false, error: 'Connection test failed' },
      { status: 500 }
    );
  }
}
