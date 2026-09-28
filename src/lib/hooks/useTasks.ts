'use client';

import { useCallback } from 'react';
import { useFetch } from './useFetch';
import type { Task } from '@/components/widgets/TasksWidget';

interface UseTasksOptions {
  userId?: string;
  showCompleted?: boolean;
  limit?: number;
  refreshInterval?: number;
  enabled?: boolean;
}

function transformTasks(json: unknown): Task[] {
  const data = json as {
    tasks: Array<{
      id: string;
      title: string;
      description: string | null;
      completed: boolean;
      dueDate: string | null;
      dueTime: string | null;
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
    }>;
  };
  return data.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description || undefined,
    completed: task.completed,
    dueDate: task.dueDate || undefined,
    dueTime: task.dueTime || undefined,
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
  }));
}

export function useTasks(options: UseTasksOptions = {}) {
  const {
    userId,
    showCompleted = false,
    limit = 50,
    refreshInterval = 5 * 60 * 1000,
    enabled,
  } = options;

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (userId) params.set('userId', userId);
  if (!showCompleted) params.set('completed', 'false');

  const { data: tasks, setData: setTasks, loading, error, refresh } = useFetch<Task[]>({
    url: `/api/tasks?${params.toString()}`,
    initialData: [],
    transform: transformTasks,
    refreshInterval,
    label: 'tasks',
    enabled,
  });

  const toggleTask = useCallback(
    async (taskId: string, completed: boolean) => {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, completed } : task
        )
      );

      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed }),
        });

        if (!response.ok) {
          throw new Error('Failed to update task');
        }
      } catch (err) {
        console.error('Error updating task:', err);
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId ? { ...task, completed: !completed } : task
          )
        );
        throw err;
      }
    },
    [setTasks]
  );

  return { tasks, loading, error, refresh, toggleTask };
}
