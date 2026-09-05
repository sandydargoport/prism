'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { isPast, parseISO } from 'date-fns';
import { useAuth, useFamily } from '@/components/providers';
import { useChores } from '@/lib/hooks';
import { toast } from '@/components/ui/use-toast';

import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { usePersistedState, useSessionScopedState, oneOf, isBoolean, isStringArray } from '@/lib/hooks/usePersistedState';
import type { Chore } from '@/types';

export interface ChoreCompletion {
  id: string;
  choreId: string;
  choreTitle: string;
  choreCategory: string;
  completedAt: string;
  pointsAwarded: number;
  completedBy: { id: string; name: string; color: string };
  approvedBy: { id: string; name: string; color: string } | null;
  approvedAt: string | null;
}

export function useChoresViewData() {
  const { requireAuth } = useAuth();
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();

  const {
    chores: apiChores,
    loading,
    error,
    refresh: refreshChores,
    approveChore: apiApproveChore,
  } = useChores({ showDisabled: true });

  const { members: familyMembers } = useFamily();

  const [chores, setChores] = useState<Chore[]>([]);
  // Narrowing choice — kept across a refresh, forgotten once the display has
  // been idle, so nobody walks up to a board that silently hides most of it.
  const [filterPerson, setFilterPerson] = useSessionScopedState<string[] | null>(
    'prism-chores-filter-person', null,
    (v): v is string[] | null => v === null || isStringArray(v),
  );
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  // Presentation choices, persisted like the Tasks page: they describe how the
  // list reads rather than narrowing what it contains.
  const [showDisabled, setShowDisabled] = usePersistedState(
    'prism-chores-show-disabled', false, isBoolean,
  );
  const [hideCompleted, setHideCompleted] = usePersistedState(
    'prism-chores-hide-completed', false, isBoolean,
  );
  const [showCompletions, setShowCompletions] = useState(false);
  const [completions, setCompletions] = useState<ChoreCompletion[]>([]);
  const [completionsLoading, setCompletionsLoading] = useState(false);
  const [sortBy, setSortBy] = usePersistedState<'nextDue' | 'category' | 'frequency'>(
    'prism-chores-sort', 'nextDue', oneOf('nextDue', 'category', 'frequency'),
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);

  const fetchCompletions = useCallback(async () => {
    setCompletionsLoading(true);
    try {
      const res = await fetch('/api/chores/completions?days=14&limit=50');
      if (res.ok) {
        const data = await res.json();
        setCompletions(data.completions || []);
      }
    } catch (err) {
      console.error('Error fetching completions:', err);
    } finally {
      setCompletionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showCompletions && completions.length === 0) {
      fetchCompletions();
    }
  }, [showCompletions, completions.length, fetchCompletions]);

  useEffect(() => {
    if (apiChores.length > 0) {
      setChores(apiChores.map(c => ({
        ...c,
        createdAt: c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt),
        pendingApproval: c.pendingApproval,
      })));
    }
  }, [apiChores]);

  const filteredChores = useMemo(() => {
    let result = [...chores];
    if (filterPerson && filterPerson.length > 0) {
      result = result.filter((chore) => chore.assignedTo?.id && filterPerson.includes(chore.assignedTo.id));
    }
    if (filterCategory) {
      result = result.filter((chore) => chore.category === filterCategory);
    }
    if (!showDisabled) {
      result = result.filter((chore) => chore.enabled);
    }
    if (hideCompleted) {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      result = result.filter((chore) => {
        if (!chore.lastCompleted) return true;
        return new Date(chore.lastCompleted).getTime() <= oneDayAgo;
      });
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'nextDue':
          if (!a.nextDue && !b.nextDue) return 0;
          if (!a.nextDue) return 1;
          if (!b.nextDue) return -1;
          return a.nextDue.localeCompare(b.nextDue);
        case 'category':
          return a.category.localeCompare(b.category);
        case 'frequency': {
          const frequencyOrder: Record<string, number> = { daily: 0, weekly: 1, biweekly: 2, monthly: 3, quarterly: 4, 'semi-annually': 5, annually: 6, custom: 7 };
          return (frequencyOrder[a.frequency] ?? 99) - (frequencyOrder[b.frequency] ?? 99);
        }
        default:
          return 0;
      }
    });
    return result;
  }, [chores, filterPerson, filterCategory, showDisabled, hideCompleted, sortBy]);

  const completeChore = async (choreId: string): Promise<boolean> => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore) return false;
    const user = await requireAuth("Who's completing this chore?");
    if (!user) return false;
    const isParent = user.role === 'parent';
    const isAssignedToUser = !chore.assignedTo || chore.assignedTo.id === user.id;
    if (!isParent && !isAssignedToUser) {
      toast({ title: `This chore is assigned to ${chore.assignedTo?.name}. Only they can mark it complete.`, variant: 'warning' });
      return false;
    }
    try {
      // Parent approving a pending completion
      if (isParent && chore.pendingApproval) {
        await apiApproveChore(choreId, chore.pendingApproval.completionId);
        toast({ title: `Approved! ${chore.pendingApproval.completedBy.name} earned ${chore.pointValue} points for "${chore.title}".`, variant: 'success' });
        refreshChores();
        return true;
      }

      // Determine who should get credit for completing the chore
      let completedById = user.id;

      // If parent is completing a chore assigned to a child, ask who actually did it
      if (isParent && chore.assignedTo && chore.assignedTo.id !== user.id) {
        const assigneeName = chore.assignedTo.name;
        const choice = await confirm(
          `Record ${assigneeName} as completing this?`,
          `This chore is assigned to ${assigneeName}. They'll get the points.`,
          { confirmLabel: `Credit ${assigneeName}`, variant: 'default' }
        );
        if (choice) {
          completedById = chore.assignedTo.id;
        } else {
          return false; // Cancel the action entirely
        }
      }

      const response = await fetch(`/api/chores/${choreId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedBy: completedById }),
      });
      if (!response.ok) {
        const data = await response.json();
        if (data.alreadyPending) { toast({ title: data.message, variant: 'warning' }); return false; }
        throw new Error(data.error || 'Failed to complete chore');
      }
      const result = await response.json();
      if (result.requiresApproval) {
        const completerName = familyMembers.find(m => m.id === completedById)?.name || 'They';
        toast({ title: `Great job! "${chore.title}" is now pending parental approval for ${completerName}.`, variant: 'success' });
      } else {
        toast({ title: `Chore completed! ${chore.pointValue} points awarded.` });
      }
      refreshChores();
      return true;
    } catch (err) {
      console.error('Error completing chore:', err);
      toast({ title: err instanceof Error ? err.message : 'Failed to complete chore', variant: 'destructive' });
      return false;
    }
  };

  const toggleEnabled = async (choreId: string) => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore) return;
    const user = await requireAuth("Who's updating this chore?");
    if (!user) return;
    if (user.role !== 'parent') { toast({ title: 'Only parents can enable or disable chores', variant: 'warning' }); return; }
    try {
      const response = await fetch(`/api/chores/${choreId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !chore.enabled }),
      });
      if (!response.ok) throw new Error('Failed to toggle chore');
      setChores((prev) => prev.map((c) => c.id === choreId ? { ...c, enabled: !c.enabled } : c));
    } catch (err) {
      console.error('Error toggling chore:', err);
    }
  };

  const deleteChore = async (choreId: string) => {
    const user = await requireAuth("Who's deleting this chore?");
    if (!user) return;
    if (user.role !== 'parent') { toast({ title: 'Only parents can delete chores', variant: 'warning' }); return; }
    if (!await confirm('Delete this chore?', 'Are you sure you want to delete this chore?')) return;
    try {
      const response = await fetch(`/api/chores/${choreId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete chore');
      setChores((prev) => prev.filter((c) => c.id !== choreId));
    } catch (err) {
      console.error('Error deleting chore:', err);
    }
  };

  const editChore = async (chore: Chore) => {
    const user = await requireAuth("Who's editing this chore?");
    if (!user) return;
    if (user.role !== 'parent') { toast({ title: 'Only parents can edit chores', variant: 'warning' }); return; }
    setEditingChore(chore);
  };

  const inlineAddChore = async (title: string, assignedToId?: string): Promise<boolean> => {
    if (!title.trim()) return false;
    const user = await requireAuth('Add Chore', 'Please log in to add a chore');
    if (!user) return false;
    if (user.role !== 'parent') {
      toast({ title: 'Only parents can add chores', variant: 'warning' });
      return false;
    }
    try {
      const response = await fetch('/api/chores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category: 'other',
          frequency: 'weekly',
          assignedTo: assignedToId || undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create chore');
      }
      refreshChores();
      return true;
    } catch (err) {
      console.error('Error creating chore:', err);
      toast({ title: err instanceof Error ? err.message : 'Failed to create chore', variant: 'destructive' });
      return false;
    }
  };

  const undoCompletion = async (completionId: string, choreId: string) => {
    const user = await requireAuth();
    if (!user) return;
    if (user.role !== 'parent') {
      toast({ title: 'Only parents can undo completions', variant: 'warning' });
      return;
    }
    try {
      const res = await fetch(`/api/chores/${choreId}/complete`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to undo completion');
      toast({ title: 'Completion removed and points reversed' });
      refreshChores();
      fetchCompletions();
    } catch {
      toast({ title: 'Failed to undo completion', variant: 'destructive' });
    }
  };

  const enabledCount = chores.filter((c) => c.enabled).length;
  const dueCount = chores.filter(
    (c) => c.enabled && c.nextDue && isPast(parseISO(c.nextDue))
  ).length;

  const handleRefreshChores = useCallback(async () => {
    await refreshChores();
    if (showCompletions) fetchCompletions();
  }, [refreshChores, showCompletions, fetchCompletions]);

  return {
    loading, error, refreshChores: handleRefreshChores, familyMembers,
    filterPerson, setFilterPerson,
    filterCategory, setFilterCategory,
    showDisabled, setShowDisabled,
    hideCompleted, setHideCompleted,
    showCompletions, setShowCompletions,
    completions, completionsLoading,
    sortBy, setSortBy,
    showAddModal, setShowAddModal,
    editingChore, setEditingChore,
    filteredChores,
    completeChore, toggleEnabled, deleteChore, editChore, undoCompletion,
    inlineAddChore,
    enabledCount, dueCount,
    confirmDialogProps,
  };
}
