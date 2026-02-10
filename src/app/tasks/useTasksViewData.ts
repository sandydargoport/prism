'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth, useFamily } from '@/components/providers';
import { useTasks } from '@/lib/hooks';
import { useTaskLists } from '@/lib/hooks/useTaskLists';
import type { Task } from '@/types';

const AUTO_SYNC_STALE_MINUTES = 5; // Sync if last sync > 5 min ago
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // Background sync every 5 min

export function useTasksViewData() {
  const { requireAuth } = useAuth();

  const {
    tasks: apiTasks,
    loading,
    error,
    refresh: refreshTasks,
    toggleTask: apiToggleTask,
  } = useTasks({ showCompleted: true, limit: 100 });

  const { lists: taskLists, loading: listsLoading } = useTaskLists();
  const { members: familyMembers } = useFamily();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterCompleted, setFilterCompleted] = useState<boolean | null>(false);
  const [filterList, setFilterList] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'title'>('dueDate');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const lastAutoSyncRef = useRef<number>(0);

  // Auto-sync function
  const autoSync = useCallback(async (force = false) => {
    // Don't sync if already syncing or synced recently
    const now = Date.now();
    if (!force && now - lastAutoSyncRef.current < AUTO_SYNC_INTERVAL_MS) {
      return;
    }

    setAutoSyncing(true);
    try {
      const res = await fetch(`/api/task-sources/sync-all?staleMinutes=${AUTO_SYNC_STALE_MINUTES}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.synced > 0) {
          // Refresh tasks if any syncs happened
          refreshTasks();
        }
        lastAutoSyncRef.current = now;
      }
    } catch {
      // Silently fail auto-sync
    } finally {
      setAutoSyncing(false);
    }
  }, [refreshTasks]);

  // Auto-sync on mount
  useEffect(() => {
    autoSync();
  }, [autoSync]);

  // Background sync interval with visibility-based pause
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const startInterval = () => {
      interval = setInterval(() => {
        if (!document.hidden) {
          autoSync();
        }
      }, AUTO_SYNC_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Sync when tab becomes visible if stale
        autoSync();
      }
    };

    startInterval();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoSync]);

  useEffect(() => {
    if (apiTasks.length > 0) {
      setTasks(apiTasks.map(t => ({
        ...t,
        dueDate: t.dueDate instanceof Date ? t.dueDate : (t.dueDate ? new Date(t.dueDate) : undefined),
      })));
    }
  }, [apiTasks]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (filterPerson) {
      result = result.filter((task) => task.assignedTo?.id === filterPerson);
    }
    if (filterPriority) {
      result = result.filter((task) => task.priority === filterPriority);
    }
    if (filterCompleted !== null) {
      result = result.filter((task) => task.completed === filterCompleted);
    }
    if (filterList !== null) {
      if (filterList === 'none') {
        result = result.filter((task) => !(task as Task & { listId?: string }).listId);
      } else {
        result = result.filter((task) => (task as Task & { listId?: string }).listId === filterList);
      }
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'priority': {
          const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (priorityOrder[a.priority ?? 'low'] ?? 2) - (priorityOrder[b.priority ?? 'low'] ?? 2);
        }
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
    return result;
  }, [tasks, filterPerson, filterPriority, filterCompleted, filterList, sortBy]);

  const toggleTask = async (taskId: string): Promise<boolean> => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;
    const user = await requireAuth("Who's completing this task?");
    if (!user) return false;
    const isParent = user.role === 'parent';
    const isAssignedToUser = !task.assignedTo || task.assignedTo.id === user.id;
    if (!isParent && !isAssignedToUser) {
      alert(`This task is assigned to ${task.assignedTo?.name}. Only they can mark it complete.`);
      return false;
    }
    try {
      await apiToggleTask(taskId, !task.completed);
      return true;
    } catch (err) {
      console.error('Error toggling task:', err);
      alert('Failed to update task');
      return false;
    }
  };

  const editTask = async (task: Task) => {
    const user = await requireAuth("Who's editing this task?");
    if (!user) return;
    if (user.role !== 'parent') { alert('Only parents can edit tasks.'); return; }
    setEditingTask(task);
  };

  const deleteTask = async (taskId: string) => {
    const user = await requireAuth("Who's deleting this task?");
    if (!user) return;
    if (user.role !== 'parent') { alert('Only parents can delete tasks.'); return; }
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete task');
      refreshTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Failed to delete task');
    }
  };

  const handleAddClick = async () => {
    const user = await requireAuth("Who's adding a task?");
    if (user) setShowAddModal(true);
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  return {
    loading: loading || listsLoading, error, refreshTasks, familyMembers,
    filterPerson, setFilterPerson,
    filterPriority, setFilterPriority,
    filterCompleted, setFilterCompleted,
    filterList, setFilterList,
    sortBy, setSortBy,
    showAddModal, setShowAddModal,
    editingTask, setEditingTask,
    filteredTasks,
    toggleTask, editTask, deleteTask, handleAddClick,
    completedCount, totalCount,
    taskLists,
    autoSyncing,
  };
}
