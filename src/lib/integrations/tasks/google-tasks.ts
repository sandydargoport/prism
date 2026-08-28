/**
 * Google Tasks Integration
 *
 * Uses Google Tasks API v1 to sync tasks bidirectionally.
 * Requires OAuth tokens carrying GOOGLE_SCOPE.tasks (see googleScopes.ts).
 *
 * API Reference: https://developers.google.com/tasks/reference/rest
 */

import type {
  TaskProvider,
  TaskProviderTokens,
  ExternalTaskList,
  ExternalTask,
  CreateTaskInput,
  UpdateTaskInput,
} from './types';

const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  due?: string; // RFC 3339 date (date-only, midnight UTC)
  status: 'needsAction' | 'completed';
  completed?: string; // RFC 3339 timestamp
  updated: string; // RFC 3339 timestamp
  position: string;
  parent?: string;
}

async function googleFetch<T>(
  endpoint: string,
  tokens: TaskProviderTokens,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${TASKS_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Tasks API error: ${response.status} - ${error}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

function parseGoogleTask(task: GoogleTask, listId: string): ExternalTask {
  return {
    id: task.id,
    listId,
    title: task.title || '(untitled)',
    description: task.notes || null,
    dueDate: task.due ? new Date(task.due) : null,
    completed: task.status === 'completed',
    completedAt: task.completed ? new Date(task.completed) : null,
    priority: null, // Google Tasks has no priority field
    updatedAt: new Date(task.updated),
  };
}

export const googleTasksProvider: TaskProvider = {
  providerId: 'google_tasks',
  displayName: 'Google Tasks',

  async fetchLists(tokens: TaskProviderTokens): Promise<ExternalTaskList[]> {
    const response = await googleFetch<{ items?: GoogleTaskList[] }>(
      '/users/@me/lists',
      tokens
    );

    return (response.items || []).map((list) => ({
      id: list.id,
      name: list.title,
      // The first list is typically the default "My Tasks" list
    }));
  },

  async fetchTasks(tokens: TaskProviderTokens, listId: string): Promise<ExternalTask[]> {
    const allTasks: ExternalTask[] = [];
    let pageToken: string | undefined;

    // Paginate through all tasks
    do {
      const params = new URLSearchParams({
        showCompleted: 'true',
        showHidden: 'true',
        maxResults: '100',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await googleFetch<{ items?: GoogleTask[]; nextPageToken?: string }>(
        `/lists/${listId}/tasks?${params.toString()}`,
        tokens
      );

      if (response.items) {
        // Only sync top-level tasks (skip subtasks for now)
        const topLevel = response.items.filter(t => !t.parent);
        allTasks.push(...topLevel.map(t => parseGoogleTask(t, listId)));
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    return allTasks;
  },

  async createTask(tokens: TaskProviderTokens, task: CreateTaskInput): Promise<ExternalTask> {
    const body: Record<string, unknown> = {
      title: task.title,
    };

    if (task.description) {
      body.notes = task.description;
    }

    if (task.dueDate) {
      // Google Tasks expects date-only in RFC 3339 format (midnight UTC)
      body.due = task.dueDate.toISOString().split('T')[0] + 'T00:00:00.000Z';
    }

    const response = await googleFetch<GoogleTask>(
      `/lists/${task.listId}/tasks`,
      tokens,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return parseGoogleTask(response, task.listId);
  },

  async updateTask(
    tokens: TaskProviderTokens,
    taskId: string,
    updates: UpdateTaskInput
  ): Promise<ExternalTask> {
    // taskId format: "listId:taskId"
    const [listId, actualTaskId] = taskId.includes(':')
      ? taskId.split(':')
      : [null, taskId];

    if (!listId) {
      throw new Error('Task ID must include list ID (format: listId:taskId)');
    }

    const body: Record<string, unknown> = {};

    if (updates.title !== undefined) {
      body.title = updates.title;
    }

    if (updates.description !== undefined) {
      body.notes = updates.description || '';
    }

    if (updates.dueDate !== undefined) {
      body.due = updates.dueDate
        ? updates.dueDate.toISOString().split('T')[0] + 'T00:00:00.000Z'
        : null;
    }

    if (updates.completed !== undefined) {
      body.status = updates.completed ? 'completed' : 'needsAction';
      if (!updates.completed) {
        body.completed = null; // Clear completed timestamp
      }
    }

    // Note: Google Tasks has no priority field — updates.priority is ignored

    const response = await googleFetch<GoogleTask>(
      `/lists/${listId}/tasks/${actualTaskId}`,
      tokens,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      }
    );

    return parseGoogleTask(response, listId!);
  },

  async deleteTask(tokens: TaskProviderTokens, taskId: string): Promise<void> {
    const [listId, actualTaskId] = taskId.includes(':')
      ? taskId.split(':')
      : [null, taskId];

    if (!listId) {
      throw new Error('Task ID must include list ID (format: listId:taskId)');
    }

    await googleFetch(
      `/lists/${listId}/tasks/${actualTaskId}`,
      tokens,
      { method: 'DELETE' }
    );
  },

  async refreshTokens(tokens: TaskProviderTokens): Promise<TaskProviderTokens | null> {
    if (!tokens.refreshToken) {
      return null;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Google OAuth credentials not configured');
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokens.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        console.error('Failed to refresh Google tokens:', await response.text());
        return null;
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: tokens.refreshToken, // Google doesn't return new refresh tokens
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      console.error('Error refreshing Google tokens:', error);
      return null;
    }
  },
};

export default googleTasksProvider;
