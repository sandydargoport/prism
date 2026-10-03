'use client';

import { useCallback } from 'react';
import { useFetch } from './useFetch';
import type { FamilyMessage } from '@/components/widgets/MessagesWidget';
import type { GuestKind } from '@/lib/messages/guestNotes';

interface UseMessagesOptions {
  limit?: number;
  refreshInterval?: number;
  enabled?: boolean;
}

function transformMessages(json: unknown): FamilyMessage[] {
  const data = json as {
    messages: Array<{
      id: string;
      message: string;
      pinned: boolean;
      important: boolean;
      createdAt: string;
      expiresAt?: string | null;
      guest?: GuestKind | null;
      author: {
        id: string;
        name: string;
        color: string;
        avatarUrl: string | null;
      };
    }>;
  };
  return data.messages.map((msg) => ({
    id: msg.id,
    message: msg.message,
    pinned: msg.pinned,
    important: msg.important,
    createdAt: new Date(msg.createdAt),
    expiresAt: msg.expiresAt ? new Date(msg.expiresAt) : null,
    guest: msg.guest ?? null,
    author: {
      id: msg.author.id,
      name: msg.author.name,
      color: msg.author.color,
      avatarUrl: msg.author.avatarUrl || undefined,
    },
  }));
}

export function useMessages(options: UseMessagesOptions = {}) {
  const { limit = 20, refreshInterval = 2 * 60 * 1000, enabled } = options;

  const { data: messages, setData: setMessages, loading, error, refresh } = useFetch<FamilyMessage[]>({
    url: `/api/messages?limit=${limit}`,
    initialData: [],
    transform: transformMessages,
    refreshInterval,
    label: 'messages',
    enabled,
  });

  const deleteMessage = useCallback(
    async (messageId: string) => {
      try {
        const response = await fetch(`/api/messages/${messageId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete message');
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      } catch (err) {
        console.error('Error deleting message:', err);
        refresh();
      }
    },
    [setMessages, refresh]
  );

  const updateMessage = useCallback(
    async (messageId: string, updates: { message?: string; pinned?: boolean; important?: boolean }) => {
      try {
        const response = await fetch(`/api/messages/${messageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error('Failed to update message');
        const updated = await response.json();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, message: updated.message, pinned: updated.pinned, important: updated.important }
              : msg
          )
        );
      } catch (err) {
        console.error('Error updating message:', err);
        refresh();
        throw err;
      }
    },
    [setMessages, refresh]
  );

  return { messages, loading, error, refresh, deleteMessage, updateMessage };
}
