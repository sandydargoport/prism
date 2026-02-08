/**
 * Microsoft To-Do Integration
 *
 * Uses Microsoft Graph API to sync tasks with Microsoft To-Do.
 * Requires OAuth tokens with Tasks.ReadWrite scope.
 *
 * API Reference: https://learn.microsoft.com/en-us/graph/api/resources/todo-overview
 */

import type {
  TaskProvider,
  TaskProviderTokens,
  ExternalTaskList,
  ExternalTask,
  CreateTaskInput,
  UpdateTaskInput,
} from './types';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

interface MsGraphTaskList {
  id: string;
  displayName: string;
  isOwner: boolean;
  isShared: boolean;
  wellknownListName?: 'defaultList' | 'flaggedEmails' | 'unknownFutureValue';
}

interface MsGraphTask {
  id: string;
  title: string;
  body?: { content: string; contentType: string };
  dueDateTime?: { dateTime: string; timeZone: string };
  status: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred';
  importance: 'low' | 'normal' | 'high';
  completedDateTime?: { dateTime: string; timeZone: string };
  createdDateTime: string;
  lastModifiedDateTime: string;
}

async function graphFetch<T>(
  endpoint: string,
  tokens: TaskProviderTokens,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${GRAPH_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Microsoft Graph API error: ${response.status} - ${error}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

function mapImportance(importance: MsGraphTask['importance']): 'high' | 'medium' | 'low' | null {
  switch (importance) {
    case 'high': return 'high';
    case 'low': return 'low';
    case 'normal': return 'medium';
    default: return null;
  }
}

function mapPriorityToImportance(priority: 'high' | 'medium' | 'low' | null | undefined): MsGraphTask['importance'] {
  switch (priority) {
    case 'high': return 'high';
    case 'low': return 'low';
    case 'medium':
    default: return 'normal';
  }
}

function parseGraphTask(task: MsGraphTask, listId: string): ExternalTask {
  return {
    id: task.id,
    listId,
    title: task.title,
    description: task.body?.content || null,
    dueDate: task.dueDateTime ? new Date(task.dueDateTime.dateTime) : null,
    completed: task.status === 'completed',
    completedAt: task.completedDateTime ? new Date(task.completedDateTime.dateTime) : null,
    priority: mapImportance(task.importance),
    updatedAt: new Date(task.lastModifiedDateTime),
    createdAt: new Date(task.createdDateTime),
  };
}

export const microsoftTodoProvider: TaskProvider = {
  providerId: 'microsoft_todo',
  displayName: 'Microsoft To-Do',

  async fetchLists(tokens: TaskProviderTokens): Promise<ExternalTaskList[]> {
    const response = await graphFetch<{ value: MsGraphTaskList[] }>(
      '/me/todo/lists',
      tokens
    );

    return response.value.map((list) => ({
      id: list.id,
      name: list.displayName,
      isDefault: list.wellknownListName === 'defaultList',
    }));
  },

  async fetchTasks(tokens: TaskProviderTokens, listId: string): Promise<ExternalTask[]> {
    // Fetch all tasks including completed ones
    const response = await graphFetch<{ value: MsGraphTask[] }>(
      `/me/todo/lists/${listId}/tasks`,
      tokens
    );

    return response.value.map((task) => parseGraphTask(task, listId));
  },

  async createTask(tokens: TaskProviderTokens, task: CreateTaskInput): Promise<ExternalTask> {
    const body: Record<string, unknown> = {
      title: task.title,
    };

    if (task.description) {
      body.body = {
        content: task.description,
        contentType: 'text',
      };
    }

    if (task.dueDate) {
      body.dueDateTime = {
        dateTime: task.dueDate.toISOString(),
        timeZone: 'UTC',
      };
    }

    if (task.priority) {
      body.importance = mapPriorityToImportance(task.priority);
    }

    const response = await graphFetch<MsGraphTask>(
      `/me/todo/lists/${task.listId}/tasks`,
      tokens,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return parseGraphTask(response, task.listId);
  },

  async updateTask(
    tokens: TaskProviderTokens,
    taskId: string,
    updates: UpdateTaskInput
  ): Promise<ExternalTask> {
    // We need to know the listId to update the task
    // The taskId format in Graph API doesn't include the listId
    // So we need to find which list contains this task
    // For now, we'll require the listId to be encoded in the taskId as "listId:taskId"
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
      body.body = updates.description
        ? { content: updates.description, contentType: 'text' }
        : null;
    }

    if (updates.dueDate !== undefined) {
      body.dueDateTime = updates.dueDate
        ? { dateTime: updates.dueDate.toISOString(), timeZone: 'UTC' }
        : null;
    }

    if (updates.completed !== undefined) {
      body.status = updates.completed ? 'completed' : 'notStarted';
    }

    if (updates.priority !== undefined) {
      body.importance = mapPriorityToImportance(updates.priority);
    }

    const response = await graphFetch<MsGraphTask>(
      `/me/todo/lists/${listId}/tasks/${actualTaskId}`,
      tokens,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      }
    );

    return parseGraphTask(response, listId);
  },

  async deleteTask(tokens: TaskProviderTokens, taskId: string): Promise<void> {
    const [listId, actualTaskId] = taskId.includes(':')
      ? taskId.split(':')
      : [null, taskId];

    if (!listId) {
      throw new Error('Task ID must include list ID (format: listId:taskId)');
    }

    await graphFetch(
      `/me/todo/lists/${listId}/tasks/${actualTaskId}`,
      tokens,
      { method: 'DELETE' }
    );
  },

  async refreshTokens(tokens: TaskProviderTokens): Promise<TaskProviderTokens | null> {
    if (!tokens.refreshToken) {
      return null;
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Microsoft OAuth credentials not configured');
      return null;
    }

    try {
      const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokens.refreshToken,
          grant_type: 'refresh_token',
          scope: 'Tasks.ReadWrite offline_access',
        }),
      });

      if (!response.ok) {
        console.error('Failed to refresh Microsoft tokens:', await response.text());
        return null;
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || tokens.refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      console.error('Error refreshing Microsoft tokens:', error);
      return null;
    }
  },
};

export default microsoftTodoProvider;
