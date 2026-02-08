import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { microsoftTodoProvider } from '@/lib/integrations/tasks/microsoft-todo';

/**
 * GET /api/task-sources/microsoft-lists
 *
 * Fetches available MS To-Do lists using temporary tokens stored after OAuth.
 * Query params:
 *   - taskListId: Prism task list ID (for task integrations)
 *   - shoppingListId: Prism shopping list ID (for shopping integrations)
 *   - newConnection: true if creating new connection without pre-selected list
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const taskListId = searchParams.get('taskListId');
  const shoppingListId = searchParams.get('shoppingListId');
  const newConnection = searchParams.get('newConnection') === 'true';

  if (!taskListId && !shoppingListId && !newConnection) {
    return NextResponse.json(
      { error: 'taskListId, shoppingListId, or newConnection is required' },
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

    // Determine the temp key based on what type of connection this is
    let tempKey: string;
    if (shoppingListId) {
      tempKey = `ms-todo-temp:${auth.userId}:shopping:${shoppingListId}`;
    } else if (taskListId) {
      tempKey = `ms-todo-temp:${auth.userId}:task:${taskListId}`;
    } else {
      // For new connections, try shopping first then task (based on returnSection)
      tempKey = `ms-todo-temp:${auth.userId}:task:new`;
    }
    let stored = await redis.get(tempKey);

    // Fallback for old key format (backwards compatibility)
    if (!stored && taskListId) {
      stored = await redis.get(`ms-todo-temp:${auth.userId}:${taskListId}`);
    }
    if (!stored && newConnection) {
      stored = await redis.get(`ms-todo-temp:${auth.userId}:new`);
    }

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
