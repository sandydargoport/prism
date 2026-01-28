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
import { useRouter } from 'next/navigation';
import { format, parseISO, isPast, isToday, isTomorrow } from 'date-fns';
import {
  Sparkles,
  Plus,
  Home,
  AlertCircle,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  SortAsc,
  Settings,
  Clock,
  Hourglass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { PageWrapper } from '@/components/layout';
import { useAuth } from '@/components/providers';
import { useChores } from '@/lib/hooks';

/**
 * CHORE INTERFACE
 */
interface Chore {
  id: string;
  title: string;
  description?: string;
  category: 'cleaning' | 'laundry' | 'dishes' | 'yard' | 'pets' | 'trash' | 'other';
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  customIntervalDays?: number;
  lastCompleted?: Date;
  nextDue?: string;
  enabled: boolean;
  requiresApproval: boolean;
  pointValue: number;
  assignedTo?: {
    id: string;
    name: string;
    color: string;
  };
  createdAt: Date;
  // Pending approval info
  pendingApproval?: {
    completionId: string;
    completedAt: string;
    completedBy: {
      id: string;
      name: string;
      color: string;
    };
  };
}

/**
 * FAMILY MEMBER TYPE
 */
interface FamilyMember {
  id: string;
  name: string;
  color: string;
}


/**
 * CHORES VIEW COMPONENT
 */
export function ChoresView() {
  const router = useRouter();
  const { activeUser, requireAuth, clearActiveUser } = useAuth();

  // Fetch chores from API using the hook
  const {
    chores: apiChores,
    loading: choresLoading,
    error: choresError,
    refresh: refreshChores,
    approveChore: apiApproveChore,
  } = useChores({ showDisabled: true });

  // Local state for UI transformations
  const [chores, setChores] = useState<Chore[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
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

  // Fetch family members from API
  useEffect(() => {
    async function fetchFamilyMembers() {
      try {
        const response = await fetch('/api/family');
        if (response.ok) {
          const data = await response.json();
          setFamilyMembers(data.members.map((m: { id: string; name: string; color: string }) => ({
            id: m.id,
            name: m.name,
            color: m.color,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch family members:', error);
      }
    }
    fetchFamilyMembers();
  }, []);

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
          const frequencyOrder = { daily: 0, weekly: 1, biweekly: 2, monthly: 3, custom: 4 };
          return frequencyOrder[a.frequency] - frequencyOrder[b.frequency];
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
  const totalCount = chores.length;
  const dueCount = chores.filter(
    (c) => c.enabled && c.nextDue && isPast(parseISO(c.nextDue))
  ).length;

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* ================================================================ */}
        {/* HEADER */}
      {/* ================================================================== */}
      <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Back and title */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="Back to dashboard">
                <Home className="h-5 w-5" />
              </Link>
            </Button>

            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
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

          {/* Right: Add button, user avatar, settings */}
          <div className="flex items-center gap-2">
            <Button onClick={async () => {
              const user = await requireAuth("Who's adding a chore?");
              if (user) setShowAddModal(true);
            }}>
              <Plus className="h-4 w-4 mr-1" />
              Add Chore
            </Button>

            {/* User avatar */}
            <button
              onClick={activeUser ? clearActiveUser : () => requireAuth()}
              className="flex items-center gap-2 p-1.5 rounded-full hover:bg-accent transition-colors"
              aria-label={activeUser ? 'Log out' : 'Log in'}
            >
              {activeUser ? (
                <UserAvatar
                  name={activeUser.name}
                  color={activeUser.color}
                  size="sm"
                  className="h-8 w-8"
                />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted border-2 border-dashed border-muted-foreground/50">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
            </button>

            {/* Settings */}
            <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* FILTERS */}
      {/* ================================================================== */}
      <div className="flex-shrink-0 border-b border-border bg-card/50 px-4 py-2">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Filter by person */}
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

          {/* Filter by category */}
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

          {/* Show disabled */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show disabled:</span>
            <Switch
              checked={showDisabled}
              onCheckedChange={setShowDisabled}
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <SortAsc className="h-4 w-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'nextDue' | 'category' | 'frequency')}
              className="text-sm bg-transparent border border-border rounded px-2 py-1"
            >
              <option value="nextDue">Next Due</option>
              <option value="category">Category</option>
              <option value="frequency">Frequency</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* CHORE LIST */}
      {/* ================================================================== */}
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
            <Sparkles className="h-12 w-12 mb-4 opacity-50" />
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
              if (!response.ok) throw new Error('Failed to create chore');
              refreshChores();
              setShowAddModal(false);
            } catch (error) {
              console.error('Error creating chore:', error);
              alert('Failed to create chore');
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

/**
 * CHORE ITEM COMPONENT
 */
function ChoreItem({
  chore,
  onComplete,
  onToggleEnabled,
  onEdit,
  onDelete,
}: {
  chore: Chore;
  onComplete: () => void;
  onToggleEnabled: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isOverdue = chore.nextDue && isPast(parseISO(chore.nextDue));
  const isPendingApproval = !!chore.pendingApproval;
  const categoryEmoji = getCategoryEmoji(chore.category);

  const formatDueDate = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Due today';
    if (isTomorrow(date)) return 'Due tomorrow';
    if (isPast(date)) return 'Overdue';
    return `Due ${format(date, 'MMM d')}`;
  };

  const formatFrequency = (frequency: string, customDays?: number) => {
    switch (frequency) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Every 2 weeks';
      case 'monthly': return 'Monthly';
      case 'custom': return customDays ? `Every ${customDays} days` : 'Custom';
      default: return frequency;
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg border border-border',
        'hover:bg-accent/30 transition-colors group',
        !chore.enabled && 'opacity-50 bg-muted/30',
        isPendingApproval && 'bg-amber-500/10 border-amber-500/30'
      )}
    >
      {/* Complete button - always enabled for parents, shows pending state visually */}
      <Button
        size="icon"
        variant="ghost"
        onClick={onComplete}
        disabled={!chore.enabled}
        className={cn(
          'flex-shrink-0 h-9 w-9',
          isOverdue && !isPendingApproval && 'text-destructive hover:text-destructive',
          isPendingApproval && 'text-amber-500'
        )}
        title={isPendingApproval ? 'Approve and complete chore' : 'Mark as complete'}
      >
        {isPendingApproval ? (
          <Hourglass className="h-5 w-5" />
        ) : (
          <CheckCircle2 className="h-5 w-5" />
        )}
      </Button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base">{categoryEmoji}</span>
          <span className={cn(
            'font-medium',
            isPendingApproval && 'text-amber-700 dark:text-amber-400'
          )}>{chore.title}</span>

          {chore.pointValue > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{chore.pointValue} pts
            </Badge>
          )}

          {/* Show pending badge if pending approval, otherwise show requires approval */}
          {isPendingApproval ? (
            <Badge variant="default" className="text-xs bg-amber-500 hover:bg-amber-500">
              Pending Approval
            </Badge>
          ) : chore.requiresApproval && (
            <Badge variant="outline" className="text-xs">
              Requires approval
            </Badge>
          )}

          <Badge variant="outline" className="text-xs capitalize">
            {chore.category}
          </Badge>
        </div>

        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          {/* Show who completed it if pending approval */}
          {isPendingApproval && chore.pendingApproval && (
            <div className="flex items-center gap-1">
              <UserAvatar
                name={chore.pendingApproval.completedBy.name}
                color={chore.pendingApproval.completedBy.color}
                size="sm"
                className="h-4 w-4 text-[8px]"
              />
              <span className="text-amber-600 dark:text-amber-400">
                Completed by {chore.pendingApproval.completedBy.name}
              </span>
            </div>
          )}

          {/* Show assigned to only if not pending */}
          {!isPendingApproval && chore.assignedTo && (
            <div className="flex items-center gap-1">
              <UserAvatar
                name={chore.assignedTo.name}
                color={chore.assignedTo.color}
                size="sm"
                className="h-4 w-4 text-[8px]"
              />
              <span>{chore.assignedTo.name}</span>
            </div>
          )}

          <span>{formatFrequency(chore.frequency, chore.customIntervalDays)}</span>

          {/* Show due date only if not pending */}
          {!isPendingApproval && chore.nextDue && (
            <span className={cn(isOverdue && 'text-destructive font-medium')}>
              {isOverdue && <AlertCircle className="h-3 w-3 inline mr-1" />}
              {formatDueDate(chore.nextDue)}
            </span>
          )}
        </div>

        {chore.description && (
          <p className="text-sm text-muted-foreground mt-1">{chore.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">
            {chore.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            checked={chore.enabled}
            onCheckedChange={onToggleEnabled}
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * GET CATEGORY EMOJI
 */
function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'cleaning': return '🧹';
    case 'laundry': return '🧺';
    case 'dishes': return '🍽️';
    case 'yard': return '🌿';
    case 'pets': return '🐾';
    case 'trash': return '🗑️';
    default: return '✨';
  }
}

/**
 * CHORE MODAL COMPONENT
 */
function ChoreModal({
  chore,
  onClose,
  onSave,
  familyMembers,
}: {
  chore?: Chore;
  onClose: () => void;
  onSave: (chore: Omit<Chore, 'id' | 'createdAt'>) => void;
  familyMembers: FamilyMember[];
}) {
  const [title, setTitle] = useState(chore?.title || '');
  const [description, setDescription] = useState(chore?.description || '');
  const [category, setCategory] = useState<Chore['category']>(chore?.category || 'cleaning');
  const [frequency, setFrequency] = useState<Chore['frequency']>(chore?.frequency || 'weekly');
  const [pointValue, setPointValue] = useState(chore?.pointValue || 5);
  const [requiresApproval, setRequiresApproval] = useState(chore?.requiresApproval || false);
  const [assignedTo, setAssignedTo] = useState(chore?.assignedTo?.id || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedMember = familyMembers.find((m) => m.id === assignedTo);

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      frequency,
      pointValue,
      requiresApproval,
      assignedTo: selectedMember || undefined,
      enabled: chore?.enabled ?? true,
      lastCompleted: chore?.lastCompleted,
      nextDue: chore?.nextDue,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {chore ? 'Edit Chore' : 'Add Chore'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chore title..."
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any details..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {(['cleaning', 'laundry', 'dishes', 'yard', 'pets', 'trash', 'other'] as const).map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  variant={category === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategory(cat)}
                  className="capitalize"
                >
                  {getCategoryEmoji(cat)} {cat}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Frequency</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {(['daily', 'weekly', 'biweekly', 'monthly'] as const).map((freq) => (
                <Button
                  key={freq}
                  type="button"
                  variant={frequency === freq ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFrequency(freq)}
                  className="capitalize"
                >
                  {freq}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Points</label>
            <Input
              type="number"
              value={pointValue}
              onChange={(e) => setPointValue(parseInt(e.target.value) || 0)}
              min="0"
              max="100"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={requiresApproval}
              onCheckedChange={setRequiresApproval}
            />
            <label className="text-sm font-medium">Requires approval</label>
          </div>

          <div>
            <label className="text-sm font-medium">Assign To</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              <Button
                type="button"
                variant={!assignedTo ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAssignedTo('')}
              >
                Anyone
              </Button>
              {familyMembers.map((member) => (
                <Button
                  key={member.id}
                  type="button"
                  variant={assignedTo === member.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignedTo(member.id)}
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

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {chore ? 'Save Changes' : 'Add Chore'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
