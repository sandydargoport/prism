'use client';

import { useState, useCallback, useEffect } from 'react';

export interface TaskList {
  id: string;
  name: string;
  color?: string | null;
  sortOrder: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateTaskListInput {
  name: string;
  color?: string | null;
}

interface UpdateTaskListInput {
  name?: string;
  color?: string | null;
  sortOrder?: number;
}

export function useTaskLists() {
  const [lists, setLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/task-lists');

      if (!res.ok) {
        throw new Error('Failed to fetch task lists');
      }

      const data: TaskList[] = await res.json();
      setLists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const createList = useCallback(async (input: CreateTaskListInput): Promise<TaskList> => {
    const res = await fetch('/api/task-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create task list');
    }

    const newList = await res.json();
    setLists(prev => [...prev, newList]);
    return newList;
  }, []);

  const updateList = useCallback(async (id: string, updates: UpdateTaskListInput): Promise<TaskList> => {
    const res = await fetch(`/api/task-lists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update task list');
    }

    const updated = await res.json();
    setLists(prev => prev.map(l => l.id === id ? updated : l));
    return updated;
  }, []);

  const deleteList = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/task-lists/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete task list');
    }

    setLists(prev => prev.filter(l => l.id !== id));
  }, []);

  const reorderLists = useCallback(async (orderedIds: string[]): Promise<void> => {
    // Optimistically update local state
    const reorderedLists = orderedIds.map((id, index) => {
      const list = lists.find(l => l.id === id);
      return list ? { ...list, sortOrder: index } : null;
    }).filter((l): l is TaskList => l !== null);

    setLists(reorderedLists);

    // Update each list's sortOrder on the server
    try {
      await Promise.all(
        orderedIds.map((id, index) =>
          fetch(`/api/task-lists/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sortOrder: index }),
          })
        )
      );
    } catch {
      // Revert on error
      await fetchLists();
    }
  }, [lists, fetchLists]);

  return {
    lists,
    loading,
    error,
    refresh: fetchLists,
    createList,
    updateList,
    deleteList,
    reorderLists,
  };
}

export default useTaskLists;
