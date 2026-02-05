'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth, useFamily } from '@/components/providers';
import { useTasks } from '@/lib/hooks';
import type { Task } from '@/types';

export function useTasksViewData() {
  const { requireAuth } = useAuth();

  const {
    tasks: apiTasks,
    loading,
    error,
    refresh: refreshTasks,
    toggleTask: apiToggleTask,
  } = useTasks({ showCompleted: true, limit: 100 });

  const { members: familyMembers } = useFamily();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterCompleted, setFilterCompleted] = useState<boolean | null>(false);
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'title'>('dueDate');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
  }, [tasks, filterPerson, filterPriority, filterCompleted, sortBy]);

  const toggleTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const user = await requireAuth("Who's completing this task?");
    if (!user) return;
    const isParent = user.role === 'parent';
    const isAssignedToUser = !task.assignedTo || task.assignedTo.id === user.id;
    if (!isParent && !isAssignedToUser) {
      alert(`This task is assigned to ${task.assignedTo?.name}. Only they can mark it complete.`);
      return;
    }
    try {
      await apiToggleTask(taskId, !task.completed);
    } catch (err) {
      console.error('Error toggling task:', err);
      alert('Failed to update task');
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
    loading, error, refreshTasks, familyMembers,
    filterPerson, setFilterPerson,
    filterPriority, setFilterPriority,
    filterCompleted, setFilterCompleted,
    sortBy, setSortBy,
    showAddModal, setShowAddModal,
    editingTask, setEditingTask,
    filteredTasks,
    toggleTask, editTask, deleteTask, handleAddClick,
    completedCount, totalCount,
  };
}
