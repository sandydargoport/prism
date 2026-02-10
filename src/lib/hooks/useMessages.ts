/**
 * ============================================================================
 * PRISM - useMessages Hook
 * ============================================================================
 *
 * Provides a React hook for fetching and managing family messages.
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';
import type { FamilyMessage } from '@/components/widgets/MessagesWidget';

interface UseMessagesOptions {
  /** Maximum messages to fetch */
  limit?: number;
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number;
}

interface UseMessagesResult {
  messages: FamilyMessage[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
}

/**
 * Hook for fetching family messages from the API
 */
export function useMessages(
  options: UseMessagesOptions = {}
): UseMessagesResult {
  const { limit = 20, refreshInterval = 2 * 60 * 1000 } = options;

  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch messages from the API
   */
  const fetchMessages = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch(`/api/messages?limit=${limit}`);

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();

      // Transform API response to FamilyMessage format
      const transformedMessages: FamilyMessage[] = data.messages.map(
        (msg: {
          id: string;
          message: string;
          pinned: boolean;
          important: boolean;
          createdAt: string;
          author: {
            id: string;
            name: string;
            color: string;
            avatarUrl: string | null;
          };
        }) => ({
          id: msg.id,
          message: msg.message,
          pinned: msg.pinned,
          important: msg.important,
          createdAt: new Date(msg.createdAt),
          author: {
            id: msg.author.id,
            name: msg.author.name,
            color: msg.author.color,
            avatarUrl: msg.author.avatarUrl || undefined,
          },
        })
      );

      setMessages(transformedMessages);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  /**
   * Delete a message
   */
  const deleteMessage = useCallback(
    async (messageId: string) => {
      try {
        const response = await fetch(`/api/messages/${messageId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete message');
        }

        // Optimistically remove from local state
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      } catch (err) {
        console.error('Error deleting message:', err);
        // Refresh to get correct state on error
        fetchMessages();
      }
    },
    [fetchMessages]
  );

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Set up refresh interval with visibility-based pause
  useVisibilityPolling(fetchMessages, refreshInterval);

  return {
    messages,
    loading,
    error,
    refresh: fetchMessages,
    deleteMessage,
  };
}
