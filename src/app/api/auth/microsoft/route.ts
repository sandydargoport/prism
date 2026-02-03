import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { getMicrosoftAuthUrl } from '@/lib/integrations/onedrive';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const sourceName = searchParams.get('sourceName') || 'OneDrive Photos';

    const state = JSON.stringify({ sourceName });
    const authUrl = getMicrosoftAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Failed to initiate Microsoft OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Microsoft authentication' },
      { status: 500 }
    );
  }
}
