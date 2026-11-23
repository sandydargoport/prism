/**
 * Microsoft To-Do Wish Item Integration
 *
 * Uses Microsoft Graph API to sync wish items with a Microsoft To-Do list.
 * Wish items are represented as tasks in MS To-Do.
 * - title ↔ name
 * - body.content ↔ notes (with URL appended as "\n\nLink: <url>")
 * - No checked/status handling (wish items have no completion state)
 */

import type {
  WishItemProvider,
  WishItemProviderTokens,
  ExternalWishList,
  ExternalWishItem,
  CreateWishItemInput,
  UpdateWishItemInput,
} from './types';
import { envCredential } from '@/lib/integrations/envCredential';

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
  status: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred';
  createdDateTime: string;
  lastModifiedDateTime: string;
}

async function graphFetch<T>(
  endpoint: string,
  tokens: WishItemProviderTokens,
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

function parseGraphTask(task: MsGraphTask, listId: string): ExternalWishItem {
  return {
    id: task.id,
    listId,
    name: task.title,
    notes: task.body?.content || null,
    updatedAt: new Date(task.lastModifiedDateTime),
    createdAt: new Date(task.createdDateTime),
  };
}

export const microsoftTodoWishItemProvider: WishItemProvider = {
  providerId: 'microsoft_todo',
  displayName: 'Microsoft To-Do',

  async fetchLists(tokens: WishItemProviderTokens): Promise<ExternalWishList[]> {
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

  async fetchItems(tokens: WishItemProviderTokens, listId: string): Promise<ExternalWishItem[]> {
    const response = await graphFetch<{ value: MsGraphTask[] }>(
      `/me/todo/lists/${listId}/tasks`,
      tokens
    );

    return response.value.map((task) => parseGraphTask(task, listId));
  },

  async createItem(tokens: WishItemProviderTokens, item: CreateWishItemInput): Promise<ExternalWishItem> {
    const body: Record<string, unknown> = {
      title: item.name,
    };

    if (item.notes) {
      body.body = {
        content: item.notes,
        contentType: 'text',
      };
    }

    const response = await graphFetch<MsGraphTask>(
      `/me/todo/lists/${item.listId}/tasks`,
      tokens,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return parseGraphTask(response, item.listId);
  },

  async updateItem(
    tokens: WishItemProviderTokens,
    itemId: string,
    listId: string,
    updates: UpdateWishItemInput
  ): Promise<ExternalWishItem> {
    const body: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      body.title = updates.name;
    }

    if (updates.notes !== undefined) {
      body.body = updates.notes
        ? { content: updates.notes, contentType: 'text' }
        : null;
    }

    const response = await graphFetch<MsGraphTask>(
      `/me/todo/lists/${listId}/tasks/${itemId}`,
      tokens,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      }
    );

    return parseGraphTask(response, listId);
  },

  async deleteItem(tokens: WishItemProviderTokens, itemId: string, listId: string): Promise<void> {
    await graphFetch(
      `/me/todo/lists/${listId}/tasks/${itemId}`,
      tokens,
      { method: 'DELETE' }
    );
  },

  async refreshTokens(tokens: WishItemProviderTokens): Promise<WishItemProviderTokens | null> {
    if (!tokens.refreshToken) {
      return null;
    }

    const clientId = envCredential('MICROSOFT_CLIENT_ID');
    const clientSecret = envCredential('MICROSOFT_CLIENT_SECRET');

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

export default microsoftTodoWishItemProvider;
