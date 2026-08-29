'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth, useFamily } from '@/components/providers';
import { useTasks } from '@/lib/hooks';
import { useTaskLists } from '@/lib/hooks/useTaskLists';
import { toast } from '@/components/ui/use-toast';
import { pushUndo } from '@/lib/hooks/useUndoStack';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import type { Task } from '@/types';
import { usePersistedState, useSessionScopedState, oneOf, isBoolean } from '@/lib/hooks/usePersistedState';

const AUTO_SYNC_STALE_MINUTES = 5; // Sync if last sync > 5 min ago
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // Background sync every 5 min

export function useTasksViewData() {
  const { requireAuth, activeUser } = useAuth();
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();

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
  const [filterPerson, setFilterPerson] = useState<string[] | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  // Persisted alongside grouping: both describe how the list is presented,
  // rather than narrowing what it contains.
  const [showCompleted, setShowCompleted] = usePersistedState(
    'prism-tasks-show-completed', false, isBoolean,
  );
  // Persisted, but forgotten once the display has been idle a while. Keeping
  // a filter across a refresh is useful mid-session; keeping it after the
  // screensaver has been and gone means walking up to a list that silently
  // hides most of it, which reads as missing tasks.
  const [filterList, setFilterList] = useSessionScopedState<string | null>(
    'prism-tasks-filter-list', null, (v): v is string | null => v === null || typeof v === 'string',
  );
  const [sortBy, setSortBy] = usePersistedState<'dueDate' | 'priority' | 'title'>(
    'prism-tasks-sort', 'dueDate', oneOf('dueDate', 'priority', 'title'),
  );
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

    // sync-all requires canManageIntegrations, which only a parent has. A
    // child profile would fire this every five minutes, be refused, and land
    // in the silent catch below — so the page quietly stopped updating with
    // nothing to indicate why. Not attempting it is honest; the refusal was
    // never going to become a sync.
    if (activeUser && activeUser.role !== 'parent') {
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
  }, [refreshTasks, activeUser]);

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
    setTasks(apiTasks.map(t => ({
      ...t,
      dueDate: t.dueDate instanceof Date ? t.dueDate : (t.dueDate ? new Date(t.dueDate) : undefined),
    })));
  }, [apiTasks]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (filterPerson && filterPerson.length > 0) {
      result = result.filter((task) => task.assignedTo?.id && filterPerson.includes(task.assignedTo.id));
    }
    if (filterPriority) {
      result = result.filter((task) => task.priority === filterPriority);
    }
    if (!showCompleted) {
      result = result.filter((task) => !task.completed);
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
  }, [tasks, filterPerson, filterPriority, showCompleted, filterList, sortBy]);

  const toggleTask = async (taskId: string): Promise<boolean> => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;
    const user = await requireAuth("Who's completing this task?");
    if (!user) return false;
    const isParent = user.role === 'parent';
    const isAssignedToUser = !task.assignedTo || task.assignedTo.id === user.id;
    if (!isParent && !isAssignedToUser) {
      toast({ title: `This task is assigned to ${task.assignedTo?.name}. Only they can mark it complete.`, variant: 'warning' });
      return false;
    }
    try {
      const newCompleted = !task.completed;
      await apiToggleTask(taskId, newCompleted);
      if (newCompleted) {
        pushUndo(task.title, () => apiToggleTask(taskId, false));
      }
      return true;
    } catch (err) {
      console.error('Error toggling task:', err);
      toast({ title: 'Failed to update task', variant: 'destructive' });
      return false;
    }
  };

  const editTask = async (task: Task) => {
    const user = await requireAuth("Who's editing this task?");
    if (!user) return;
    if (user.role !== 'parent') { toast({ title: 'Only parents can edit tasks', variant: 'warning' }); return; }
    setEditingTask(task);
  };

  const deleteTask = async (taskId: string) => {
    const user = await requireAuth("Who's deleting this task?");
    if (!user) return;
    if (user.role !== 'parent') { toast({ title: 'Only parents can delete tasks', variant: 'warning' }); return; }
    if (!await confirm('Delete this task?', 'Are you sure you want to delete this task?')) return;
    // Optimistically remove from UI
    const previousTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete task');
    } catch (err) {
      console.error('Error deleting task:', err);
      setTasks(previousTasks); // Revert on failure
      toast({ title: 'Failed to delete task', variant: 'destructive' });
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
    showCompleted, setShowCompleted,
    filterList, setFilterList,
    sortBy, setSortBy,
    showAddModal, setShowAddModal,
    editingTask, setEditingTask,
    filteredTasks,
    toggleTask, editTask, deleteTask, handleAddClick,
    completedCount, totalCount,
    taskLists,
    autoSyncing,
    confirmDialogProps,
  };
}
