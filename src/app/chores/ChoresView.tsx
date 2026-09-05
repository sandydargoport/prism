'use client';

import { useState, useMemo } from 'react';
import { usePersistedState, useSessionScopedStringSet, isBoolean } from '@/lib/hooks/usePersistedState';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  ClipboardList,
  Plus,
  AlertCircle,
  History,
  Users,
  X,
} from 'lucide-react';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { PlaneCelebration } from '@/components/ui/PlaneCelebration';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { PageWrapper, SubpageHeader, FilterBar, SortSelect, FilterDropdown, PersonFilter } from '@/components/layout';
import type { OverflowItem } from '@/components/layout';
import { ChoreItem } from '@/app/chores/ChoreItem';
import { ChoreModal } from '@/app/chores/ChoreModal';
import { ChoreGroupGrid } from './ChoreGroupGrid';
import { ChoreCompletionsList } from './ChoreCompletionsList';
import { useChoresViewData } from './useChoresViewData';
import { useChoreModals } from './useChoreModals';
import { useAuth } from '@/components/providers';

const CHORE_CATEGORIES = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'dishes', label: 'Dishes' },
  { value: 'yard', label: 'Yard' },
  { value: 'pets', label: 'Pets' },
  { value: 'trash', label: 'Trash' },
];

export function ChoresView() {
  const isMobile = useIsMobile();
  const { requireAuth } = useAuth();
  const {
    loading, error, refreshChores, familyMembers,
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
  } = useChoresViewData();

  const { saveNewChore, saveEditedChore, handleDeleteFromModal } = useChoreModals({
    refreshChores, setShowAddModal, setEditingChore, deleteChore,
  });

  // Defaults to the flat/ungrouped list — group-by-person previously opened
  // by default, which surfaced an empty "Add chore" row for every person
  // column (including whoever had no chores yet) and read awkwardly as the
  // first thing a new user saw. Group mode is still one click away via the
  // toggle below.
  // Persisted: grouping describes how the list is presented, not what it
  // contains, so restoring it cannot hide anything. The default stays off for
  // the reason above; once someone turns it on, it is a deliberate choice about
  // how this display reads and should survive the next reload.
  const [groupByUser, setGroupByUser] = usePersistedState(
    'prism-chores-group-by-user', false, isBoolean,
  );
  const [celebratingUser, setCelebratingUser] = useState<{ id: string; name: string } | null>(null);
  const [inlineChore, setInlineChore] = useState('');
  const [inlineChoreByUser, setInlineChoreByUser] = useState<Record<string, string>>({});
  // Session-scoped, not persisted outright: this one NARROWS the list, and
  // walking up to a silently filtered board with no memory of setting it reads
  // as missing chores. Kept across a refresh, dropped once the display has been
  // idle a while.
  const [categoryFilters, setCategoryFilters] = useSessionScopedStringSet(
    'prism-chores-category-filters',
  );
  // Whoever authenticated to open the "Add Chore" modal — preselected as the
  // assignee so the chore lands in their group instead of "Unassigned" by
  // default (bug: the header-level add control sat outside every per-person
  // group and always produced an unassigned chore).
  const [addModalDefaultAssignee, setAddModalDefaultAssignee] = useState<string | undefined>(undefined);

  const effectiveFilteredChores = useMemo(() => {
    if (categoryFilters.size === 0) return filteredChores;
    return filteredChores.filter((chore) => categoryFilters.has(chore.category));
  }, [filteredChores, categoryFilters]);

  const hasActiveFilters = (filterPerson !== null && filterPerson.length > 0) || categoryFilters.size > 0;

  const clearFilters = () => {
    setFilterPerson(null);
    setCategoryFilters(new Set());
    setFilterCategory(null);
  };

  const choresByUser = useMemo(() => {
    if (!groupByUser) return null;

    // Build assignee list from chore data itself — works even when familyMembers has
    // empty IDs (unauthenticated state: /api/family returns id:'' before login).
    const assigneeMap = new Map<string, { id: string; name: string; color: string }>();
    effectiveFilteredChores.forEach(c => { if (c.assignedTo) assigneeMap.set(c.assignedTo.id, c.assignedTo); });

    // When the person filter is active, only render columns for the
    // selected people — without this, all family members appear as columns
    // and the non-filtered ones are empty (bug #105). Matches the pattern
    // Tasks (TaskContentArea.tsx) and Wishes (WishesView.tsx) already use.
    const personFilterActive = filterPerson !== null && filterPerson.length > 0;
    const isMemberAllowed = (id: string) =>
      !personFilterActive || filterPerson!.includes(id);

    // All family members always get a column; append any extra assignees not in family
    const ordered: { id: string; name: string; color: string }[] = [];
    familyMembers.forEach(member => {
      if (member.id && isMemberAllowed(member.id)) {
        ordered.push(member);
        assigneeMap.delete(member.id);
      }
    });
    assigneeMap.forEach(a => { if (isMemberAllowed(a.id)) ordered.push(a); });

    const groups: { user: { id: string; name: string; color: string } | null; chores: typeof effectiveFilteredChores }[] = [];
    ordered.forEach(member => {
      const userChores = effectiveFilteredChores.filter(c => c.assignedTo?.id === member.id);
      groups.push({ user: member, chores: userChores });
    });

    // Unassigned column is hidden when a person filter is active — the user
    // explicitly asked to see only those people, not the "no one" bucket.
    if (!personFilterActive) {
      const unassigned = effectiveFilteredChores.filter(c => !c.assignedTo);
      if (unassigned.length > 0) groups.push({ user: null, chores: unassigned });
    }
    return groups;
  }, [groupByUser, effectiveFilteredChores, familyMembers, filterPerson]);

  const handleAddWithAuth = async () => {
    const user = await requireAuth('Add Chore', 'Please log in to add a chore');
    if (!user) return;
    // Preselect the person who's adding it — only relevant when they're an
    // actual family member (not a role-less guest) present in the groups.
    setAddModalDefaultAssignee(familyMembers.some((m) => m.id === user.id) ? user.id : undefined);
    setShowAddModal(true);
  };

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <SubpageHeader
          icon={<ClipboardList className="h-5 w-5 text-primary" />}
          title="Chores"
          badge={<>
            <Badge variant="secondary">{enabledCount} active</Badge>
            {dueCount > 0 && <Badge variant="destructive">{dueCount} due</Badge>}
          </>}
          actions={<>
            <Button variant={showCompletions ? 'secondary' : 'outline'} size="sm"
              onClick={() => setShowCompletions(!showCompletions)}>
              <History className="h-4 w-4 mr-1" />History
            </Button>
            <Button onClick={handleAddWithAuth} size="sm">
              <Plus className="h-4 w-4 mr-1" />Add Chore
            </Button>
          </>}
          overflow={[
            { label: 'Hide Completed', checked: hideCompleted, onClick: () => setHideCompleted(!hideCompleted) },
            { label: 'Show Disabled', checked: showDisabled, onClick: () => setShowDisabled(!showDisabled) },
          ] as OverflowItem[]}
        />

        <FilterBar>
          <PersonFilter members={familyMembers} selected={filterPerson} onSelect={setFilterPerson} />
          <div className="w-px h-5 bg-border shrink-0" />
          <FilterDropdown label="Category" options={CHORE_CATEGORIES} selected={categoryFilters}
            onSelectionChange={setCategoryFilters} mode="multi" />
          <FilterDropdown label="Group"
            options={[{ value: 'none', label: 'None' }, { value: 'person', label: 'Person' }]}
            selected={new Set([groupByUser ? 'person' : 'none'])}
            onSelectionChange={(s) => setGroupByUser(s.size > 0 && [...s][0] === 'person')}
            mode="single" icon={<Users className="h-4 w-4" />} />
          <SortSelect value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}
            options={[
              { value: 'nextDue', label: 'Next Due' },
              { value: 'category', label: 'Category' },
              { value: 'frequency', label: 'Frequency' },
            ]}
            showSortIcon className="ml-auto" />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0 text-muted-foreground h-8">
              <X className="h-3 w-3 mr-1" />Clear
            </Button>
          )}
        </FilterBar>

        <div className="flex-1 overflow-y-auto p-4">
          {showCompletions ? (
            <ChoreCompletionsList completions={completions} completionsLoading={completionsLoading}
              onUndo={undoCompletion} />
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <PageLoader label="Loading chores..." />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-destructive">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" /><p>{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refreshChores()}>Try Again</Button>
            </div>
          ) : effectiveFilteredChores.length === 0 && !(groupByUser && familyMembers.length > 0) ? (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon={<ClipboardList />}
                title="No chores found"
                action={<Button variant="outline" size="sm" onClick={handleAddWithAuth}>Add your first chore</Button>}
              />
            </div>
          ) : groupByUser && choresByUser && choresByUser.length > 0 ? (
            <ChoreGroupGrid choresByUser={choresByUser} inlineChoreByUser={inlineChoreByUser}
              setInlineChoreByUser={setInlineChoreByUser} inlineAddChore={inlineAddChore}
              completeChore={completeChore} editChore={editChore} deleteChore={deleteChore}
              setCelebratingUser={setCelebratingUser} isMobile={isMobile} />
          ) : (
            <div className="space-y-2 max-w-4xl mx-auto">
              <Input placeholder="Add chore..." value={inlineChore}
                onChange={(e) => setInlineChore(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!inlineChore.trim()) return;
                    const success = await inlineAddChore(inlineChore.trim());
                    if (success) setInlineChore('');
                  }
                }}
                className="h-9 mb-2" />
              {effectiveFilteredChores.map((chore) => (
                <ChoreItem key={chore.id} chore={chore}
                  onComplete={() => completeChore(chore.id)}
                  onToggleEnabled={() => toggleEnabled(chore.id)}
                  onEdit={() => editChore(chore)}
                  onDelete={() => deleteChore(chore.id)} />
              ))}
            </div>
          )}
        </div>

        {showAddModal && (
          <ChoreModal onClose={() => setShowAddModal(false)} onSave={saveNewChore}
            familyMembers={familyMembers} defaultAssignedTo={addModalDefaultAssignee} />
        )}
        {editingChore && (
          <ChoreModal chore={editingChore} onClose={() => setEditingChore(null)}
            onDelete={() => handleDeleteFromModal(editingChore.id)}
            onSave={(chore) => saveEditedChore(editingChore.id, chore)}
            familyMembers={familyMembers} />
        )}

        <PlaneCelebration show={!!celebratingUser} userName={celebratingUser?.name || ''}
          onComplete={() => setCelebratingUser(null)} />
        <ConfirmDialog {...confirmDialogProps} />
      </div>
    </PageWrapper>
  );
}
