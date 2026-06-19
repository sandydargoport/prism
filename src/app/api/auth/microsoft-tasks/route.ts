import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { logError } from '@/lib/utils/logError';
import { oauthSetupRedirect } from '@/lib/integrations/oauthSetupRedirect';

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
const SCOPES = ['Tasks.ReadWrite', 'offline_access'].join(' ');

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_TASKS_REDIRECT_URI ||
    `${process.env.BASE_URL || 'http://localhost:3000'}/api/auth/microsoft-tasks/callback`;

  if (!clientId) {
    return oauthSetupRedirect('microsoft');
  }

  try {
    const { searchParams } = new URL(request.url);
    const taskListId = searchParams.get('taskListId'); // Optional - if not provided, user picks/creates list later
    const shoppingListId = searchParams.get('shoppingListId'); // For shopping list integrations
    const wishMemberId = searchParams.get('wishMemberId'); // For wish list integrations
    const returnSection = searchParams.get('returnSection') || 'tasks'; // 'tasks', 'shopping', or 'wish'

    const state = JSON.stringify({
      taskListId: taskListId || null,
      shoppingListId: shoppingListId || null,
      wishMemberId: wishMemberId || null,
      returnSection,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      response_mode: 'query',
      state,
    });

    return NextResponse.redirect(`${MICROSOFT_AUTH_URL}?${params.toString()}`);
  } catch (error) {
    logError('Failed to initiate Microsoft Tasks OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Microsoft authentication' },
      { status: 500 }
    );
  }
}
