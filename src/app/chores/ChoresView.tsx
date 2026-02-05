/**
 * ============================================================================
 * PRISM - Chores View Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * The main interactive chores view with filtering, sorting, and chore management.
 *
 * FEATURES:
 * - Chore list with completion tracking
 * - Filter by person, category, frequency
 * - Sort by next due, category, frequency
 * - Complete chore (with approval workflow)
 * - Add/edit chore modal
 * - Enable/disable chores
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { isPast, parseISO } from 'date-fns';
import {
  ClipboardList,
  Plus,
  Home,
  AlertCircle,
  SortAsc,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PageWrapper } from '@/components/layout';
import { useAuth, useFamily } from '@/components/providers';
import { useChores } from '@/lib/hooks';
import { ChoreItem } from '@/app/chores/ChoreItem';
import { ChoreModal } from '@/app/chores/ChoreModal';
import type { Chore } from '@/types';


/**
 * CHORES VIEW COMPONENT
 */
export function ChoresView() {

  const { requireAuth } = useAuth();

  // Fetch chores from API using the hook
  const {
    chores: apiChores,
    loading: choresLoading,
    error: choresError,
    refresh: refreshChores,
    approveChore: apiApproveChore,
  } = useChores({ showDisabled: true });

  // Family members from context
  const { members: familyMembers } = useFamily();

  // Local state for UI transformations
  const [chores, setChores] = useState<Chore[]>([]);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [sortBy, setSortBy] = useState<'nextDue' | 'category' | 'frequency'>('nextDue');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);

  // Sync API chores to local state
  useEffect(() => {
    if (apiChores.length > 0) {
      setChores(apiChores.map(c => ({
        ...c,
        // Ensure createdAt is a Date object
        createdAt: c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt),
        // Keep pendingApproval info
        pendingApproval: c.pendingApproval,
      })));
    }
  }, [apiChores]);

  // Filter and sort chores
  const filteredChores = useMemo(() => {
    let result = [...chores];

    // Apply filters
    if (filterPerson) {
      result = result.filter((chore) => chore.assignedTo?.id === filterPerson);
    }

    if (filterCategory) {
      result = result.filter((chore) => chore.category === filterCategory);
    }

    if (!showDisabled) {
      result = result.filter((chore) => chore.enabled);
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'nextDue':
          if (!a.nextDue && !b.nextDue) return 0;
          if (!a.nextDue) return 1;
          if (!b.nextDue) return -1;
          return a.nextDue.localeCompare(b.nextDue);
        case 'category':
          return a.category.localeCompare(b.category);
        case 'frequency':
          const frequencyOrder: Record<string, number> = { daily: 0, weekly: 1, biweekly: 2, monthly: 3, quarterly: 4, 'semi-annually': 5, annually: 6, custom: 7 };
          return (frequencyOrder[a.frequency] ?? 99) - (frequencyOrder[b.frequency] ?? 99);
        default:
          return 0;
      }
    });

    return result;
  }, [chores, filterPerson, filterCategory, showDisabled, sortBy]);

  // Complete chore - requires auth and ownership check
  const completeChore = async (choreId: string) => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore) return;

    // Require authentication
    const user = await requireAuth("Who's completing this chore?");
    if (!user) return;

    // Check ownership - can only complete own chores or unassigned chores
    // Parents can complete any chore
    const isParent = user.role === 'parent';
    const isAssignedToUser = !chore.assignedTo || chore.assignedTo.id === user.id;

    if (!isParent && !isAssignedToUser) {
      alert(`This chore is assigned to ${chore.assignedTo?.name}. Only they can mark it complete.`);
      return;
    }

    try {
      // If parent and chore has pending approval, approve it instead of creating new completion
      if (isParent && chore.pendingApproval) {
        await apiApproveChore(choreId, chore.pendingApproval.completionId);
        // Refresh to show chore disappeared
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
        // Handle "already pending" case gracefully
        if (data.alreadyPending) {
          alert(data.message);
          return;
        }
        throw new Error(data.error || 'Failed to complete chore');
      }

      const result = await response.json();

      // Show appropriate message based on approval status
      if (result.requiresApproval && user.role === 'child') {
        alert(`Great job! "${chore.title}" is now pending parental approval.`);
      }

      // Refresh to get updated state
      refreshChores();
    } catch (error) {
      console.error('Error completing chore:', error);
      alert(error instanceof Error ? error.message : 'Failed to complete chore');
    }
  };

  // Toggle chore enabled status - requires auth and parent role
  const toggleEnabled = async (choreId: string) => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore) return;

    const user = await requireAuth("Who's updating this chore?");
    if (!user) return;

    // Only parents can enable/disable chores
    if (user.role !== 'parent') {
      alert('Only parents can enable or disable chores.');
      return;
    }

    try {
      const response = await fetch(`/api/chores/${choreId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !chore.enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle chore');
      }

      // Update local state
      setChores((prev) =>
        prev.map((c) =>
          c.id === choreId ? { ...c, enabled: !c.enabled } : c
        )
      );
    } catch (error) {
      console.error('Error toggling chore:', error);
    }
  };

  // Delete chore - requires auth and parent role
  const deleteChore = async (choreId: string) => {
    const user = await requireAuth("Who's deleting this chore?");
    if (!user) return;

    // Only parents can delete chores
    if (user.role !== 'parent') {
      alert('Only parents can delete chores.');
      return;
    }

    if (!confirm('Are you sure you want to delete this chore?')) {
      return;
    }

    try {
      const response = await fetch(`/api/chores/${choreId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete chore');
      }

      // Remove from local state
      setChores((prev) => prev.filter((chore) => chore.id !== choreId));
    } catch (error) {
      console.error('Error deleting chore:', error);
    }
  };

  // Edit chore - requires auth and parent role
  const editChore = async (chore: Chore) => {
    const user = await requireAuth("Who's editing this chore?");
    if (!user) return;

    // Only parents can edit chores
    if (user.role !== 'parent') {
      alert('Only parents can edit chores.');
      return;
    }

    setEditingChore(chore);
  };

  // Chore counts
  const enabledCount = chores.filter((c) => c.enabled).length;
  const dueCount = chores.filter(
    (c) => c.enabled && c.nextDue && isPast(parseISO(c.nextDue))
  ).length;

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* HEADER */}
      <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="Back to dashboard">
                <Home className="h-5 w-5" />
              </Link>
            </Button>

            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Chores</h1>
              <Badge variant="secondary">
                {enabledCount} active
              </Badge>
              {dueCount > 0 && (
                <Badge variant="destructive">
                  {dueCount} due
                </Badge>
              )}
            </div>
          </div>

          <Button onClick={async () => {
              const user = await requireAuth("Who's adding a chore?");
              if (user) setShowAddModal(true);
            }}>
              <Plus className="h-4 w-4 mr-1" />
              Add Chore
            </Button>
        </div>
      </header>

      {/* FILTERS */}
      <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Person:</span>
            <div className="flex gap-1">
              <Button
                variant={filterPerson === null ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterPerson(null)}
              >
                All
              </Button>
              {familyMembers.map((member) => (
                <Button
                  key={member.id}
                  variant={filterPerson === member.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterPerson(member.id)}
                  className="gap-1"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                  {member.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Category:</span>
            <div className="flex gap-1">
              <Button
                variant={filterCategory === null ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterCategory(null)}
              >
                All
              </Button>
              {['cleaning', 'laundry', 'dishes', 'yard', 'pets', 'trash'].map((category) => (
                <Button
                  key={category}
                  variant={filterCategory === category ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterCategory(category)}
                  className="capitalize"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show disabled:</span>
            <Switch
              checked={showDisabled}
              onCheckedChange={setShowDisabled}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <SortAsc className="h-4 w-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'nextDue' | 'category' | 'frequency')}
              className="text-sm bg-card text-foreground border border-border rounded px-2 py-1 [&>option]:bg-card [&>option]:text-foreground"
            >
              <option value="nextDue">Next Due</option>
              <option value="category">Category</option>
              <option value="frequency">Frequency</option>
            </select>
          </div>
        </div>
      </div>

      {/* CHORE LIST */}
      <div className="flex-1 overflow-y-auto p-4">
        {choresLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Clock className="h-12 w-12 mb-4 opacity-50 animate-pulse" />
            <p>Loading chores...</p>
          </div>
        ) : choresError ? (
          <div className="flex flex-col items-center justify-center h-full text-destructive">
            <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
            <p>{choresError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => refreshChores()}
            >
              Try Again
            </Button>
          </div>
        ) : filteredChores.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ClipboardList className="h-12 w-12 mb-4 opacity-50" />
            <p>No chores found</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowAddModal(true)}
            >
              Add your first chore
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl mx-auto">
            {filteredChores.map((chore) => (
              <ChoreItem
                key={chore.id}
                chore={chore}
                onComplete={() => completeChore(chore.id)}
                onToggleEnabled={() => toggleEnabled(chore.id)}
                onEdit={() => editChore(chore)}
                onDelete={() => deleteChore(chore.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Chore Modal */}
      {showAddModal && (
        <ChoreModal
          onClose={() => setShowAddModal(false)}
          onSave={async (chore) => {
            try {
              const response = await fetch('/api/chores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: chore.title,
                  description: chore.description,
                  category: chore.category,
                  frequency: chore.frequency,
                  pointValue: chore.pointValue,
                  requiresApproval: chore.requiresApproval,
                  assignedTo: chore.assignedTo?.id,
                }),
              });
              if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to create chore');
              }
              refreshChores();
              setShowAddModal(false);
            } catch (error) {
              console.error('Error creating chore:', error);
              alert(error instanceof Error ? error.message : 'Failed to create chore');
            }
          }}
          familyMembers={familyMembers}
        />
      )}

      {/* Edit Chore Modal */}
      {editingChore && (
        <ChoreModal
          chore={editingChore}
          onClose={() => setEditingChore(null)}
          onSave={async (updatedChore) => {
            try {
              const response = await fetch(`/api/chores/${editingChore.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: updatedChore.title,
                  description: updatedChore.description,
                  category: updatedChore.category,
                  frequency: updatedChore.frequency,
                  pointValue: updatedChore.pointValue,
                  requiresApproval: updatedChore.requiresApproval,
                  assignedTo: updatedChore.assignedTo?.id,
                  enabled: updatedChore.enabled,
                }),
              });
              if (!response.ok) throw new Error('Failed to update chore');
              refreshChores();
              setEditingChore(null);
            } catch (error) {
              console.error('Error updating chore:', error);
              alert('Failed to update chore');
            }
          }}
          familyMembers={familyMembers}
        />
      )}
      </div>
    </PageWrapper>
  );
}
