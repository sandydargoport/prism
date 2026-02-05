'use client';

import { useState, useMemo, useEffect } from 'react';
import { isPast, parseISO } from 'date-fns';
import { useAuth, useFamily } from '@/components/providers';
import { useChores } from '@/lib/hooks';
import type { Chore } from '@/types';

export function useChoresViewData() {
  const { requireAuth } = useAuth();

  const {
    chores: apiChores,
    loading,
    error,
    refresh: refreshChores,
    approveChore: apiApproveChore,
  } = useChores({ showDisabled: true });

  const { members: familyMembers } = useFamily();

  const [chores, setChores] = useState<Chore[]>([]);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [sortBy, setSortBy] = useState<'nextDue' | 'category' | 'frequency'>('nextDue');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);

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
    if (filterPerson) {
      result = result.filter((chore) => chore.assignedTo?.id === filterPerson);
    }
    if (filterCategory) {
      result = result.filter((chore) => chore.category === filterCategory);
    }
    if (!showDisabled) {
      result = result.filter((chore) => chore.enabled);
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
  }, [chores, filterPerson, filterCategory, showDisabled, sortBy]);

  const completeChore = async (choreId: string) => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore) return;
    const user = await requireAuth("Who's completing this chore?");
    if (!user) return;
    const isParent = user.role === 'parent';
    const isAssignedToUser = !chore.assignedTo || chore.assignedTo.id === user.id;
    if (!isParent && !isAssignedToUser) {
      alert(`This chore is assigned to ${chore.assignedTo?.name}. Only they can mark it complete.`);
      return;
    }
    try {
      if (isParent && chore.pendingApproval) {
        await apiApproveChore(choreId, chore.pendingApproval.completionId);
        refreshChores();
        return;
      }
      const response = await fetch(`/api/chores/${choreId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedBy: user.id }),
      });
      if (!response.ok) {
        const data = await response.json();
        if (data.alreadyPending) { alert(data.message); return; }
        throw new Error(data.error || 'Failed to complete chore');
      }
      const result = await response.json();
      if (result.requiresApproval && user.role === 'child') {
        alert(`Great job! "${chore.title}" is now pending parental approval.`);
      }
      refreshChores();
    } catch (err) {
      console.error('Error completing chore:', err);
      alert(err instanceof Error ? err.message : 'Failed to complete chore');
    }
  };

  const toggleEnabled = async (choreId: string) => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore) return;
    const user = await requireAuth("Who's updating this chore?");
    if (!user) return;
    if (user.role !== 'parent') { alert('Only parents can enable or disable chores.'); return; }
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
    if (user.role !== 'parent') { alert('Only parents can delete chores.'); return; }
    if (!confirm('Are you sure you want to delete this chore?')) return;
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
    if (user.role !== 'parent') { alert('Only parents can edit chores.'); return; }
    setEditingChore(chore);
  };

  const enabledCount = chores.filter((c) => c.enabled).length;
  const dueCount = chores.filter(
    (c) => c.enabled && c.nextDue && isPast(parseISO(c.nextDue))
  ).length;

  return {
    loading, error, refreshChores, familyMembers,
    filterPerson, setFilterPerson,
    filterCategory, setFilterCategory,
    showDisabled, setShowDisabled,
    sortBy, setSortBy,
    showAddModal, setShowAddModal,
    editingChore, setEditingChore,
    filteredChores,
    completeChore, toggleEnabled, deleteChore, editChore,
    enabledCount, dueCount,
  };
}
