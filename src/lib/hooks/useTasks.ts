/**
 * ============================================================================
 * PRISM - useTasks Hook
 * ============================================================================
 *
 * Provides a React hook for fetching and managing tasks.
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';
import type { Task } from '@/components/widgets/TasksWidget';

interface UseTasksOptions {
  /** Filter by user ID */
  userId?: string;
  /** Show completed tasks */
  showCompleted?: boolean;
  /** Maximum tasks to fetch */
  limit?: number;
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number;
}

interface UseTasksResult {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleTask: (taskId: string, completed: boolean) => Promise<void>;
}

/**
 * Hook for fetching tasks from the API
 */
export function useTasks(options: UseTasksOptions = {}): UseTasksResult {
  const {
    userId,
    showCompleted = false,
    limit = 50,
    refreshInterval = 5 * 60 * 1000,
  } = options;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch tasks from the API
   */
  const fetchTasks = useCallback(async () => {
    try {
      setError(null);

      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (userId) params.set('userId', userId);
      if (!showCompleted) params.set('completed', 'false');

      const response = await fetch(`/api/tasks?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();

      // Transform API response to Task format
      const transformedTasks: Task[] = data.tasks.map(
        (task: {
          id: string;
          title: string;
          description: string | null;
          completed: boolean;
          dueDate: string | null;
          priority: 'high' | 'medium' | 'low' | null;
          category: string | null;
          listId: string | null;
          taskSourceId: string | null;
          assignedTo: {
            id: string;
            name: string;
            color: string;
            avatarUrl: string | null;
          } | null;
        }) => ({
          id: task.id,
          title: task.title,
          description: task.description || undefined,
          completed: task.completed,
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          priority: task.priority || 'medium',
          category: task.category || undefined,
          listId: task.listId || undefined,
          taskSourceId: task.taskSourceId || undefined,
          assignedTo: task.assignedTo
            ? {
                id: task.assignedTo.id,
                name: task.assignedTo.name,
                color: task.assignedTo.color,
                avatarUrl: task.assignedTo.avatarUrl || undefined,
              }
            : undefined,
        })
      );

      setTasks(transformedTasks);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [userId, showCompleted, limit]);

  /**
   * Toggle task completion status
   */
  const toggleTask = useCallback(
    async (taskId: string, completed: boolean) => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed }),
        });

        if (!response.ok) {
          throw new Error('Failed to update task');
        }

        // Optimistically update local state
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId ? { ...task, completed } : task
          )
        );
      } catch (err) {
        console.error('Error updating task:', err);
        // Refresh to get correct state on error
        fetchTasks();
      }
    },
    [fetchTasks]
  );

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Set up refresh interval with visibility-based pause
  useVisibilityPolling(fetchTasks, refreshInterval);

  return {
    tasks,
    loading,
    error,
    refresh: fetchTasks,
    toggleTask,
  };
}
