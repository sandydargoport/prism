/**
 * ============================================================================
 * PRISM - Google OAuth Initiation Route
 * ============================================================================
 *
 * Redirects user to Google's OAuth consent screen.
 *
 * ============================================================================
 */

import { NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/integrations/google-calendar';

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow
 */
export async function GET(request: Request) {
  try {
    // Get the user ID from query params (optional, for linking to user)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Create state parameter to prevent CSRF and pass user info
    const state = userId ? JSON.stringify({ userId }) : undefined;

    // Generate OAuth URL and redirect
    const authUrl = getGoogleAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Failed to initiate Google OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google authentication' },
      { status: 500 }
    );
  }
}
