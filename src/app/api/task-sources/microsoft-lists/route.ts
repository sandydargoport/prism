import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { microsoftTodoProvider } from '@/lib/integrations/tasks/microsoft-todo';

/**
 * GET /api/task-sources/microsoft-lists
 *
 * Fetches available MS To-Do lists using temporary tokens stored after OAuth.
 * Query params: taskListId (the Prism list ID used in OAuth state)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const taskListId = searchParams.get('taskListId');
  const newConnection = searchParams.get('newConnection') === 'true';

  if (!taskListId && !newConnection) {
    return NextResponse.json(
      { error: 'taskListId or newConnection is required' },
      { status: 400 }
    );
  }

  try {
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { error: 'Redis unavailable' },
        { status: 503 }
      );
    }
    const tempKey = newConnection
      ? `ms-todo-temp:${auth.userId}:new`
      : `ms-todo-temp:${auth.userId}:${taskListId}`;
    const stored = await redis.get(tempKey);

    if (!stored) {
      return NextResponse.json(
        { error: 'Session expired. Please reconnect Microsoft To-Do.' },
        { status: 401 }
      );
    }

    const { rawAccessToken } = JSON.parse(stored);

    // Fetch lists from MS To-Do
    const lists = await microsoftTodoProvider.fetchLists({
      accessToken: rawAccessToken,
    });

    return NextResponse.json({ lists });
  } catch (error) {
    console.error('Error fetching MS lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Microsoft To-Do lists' },
      { status: 500 }
    );
  }
}
