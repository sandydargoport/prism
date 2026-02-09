'use client';

import Link from 'next/link';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { useState, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  Home,
  AlertCircle,
  SortAsc,
  Clock,
  History,
  CheckCircle2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { UserAvatar } from '@/components/ui/avatar';
import { PageWrapper } from '@/components/layout';
import { ChoreItem, getCategoryEmoji } from '@/app/chores/ChoreItem';
import { ChoreModal } from '@/app/chores/ChoreModal';
import { useChoresViewData } from './useChoresViewData';
import { useAuth } from '@/components/providers';
import { cn } from '@/lib/utils';

export function ChoresView() {
  const { requireAuth } = useAuth();
  const {
    loading, error, refreshChores, familyMembers,
    filterPerson, setFilterPerson,
    filterCategory, setFilterCategory,
    showDisabled, setShowDisabled,
    showCompletions, setShowCompletions,
    completions, completionsLoading,
    sortBy, setSortBy,
    showAddModal, setShowAddModal,
    editingChore, setEditingChore,
    filteredChores,
    completeChore, toggleEnabled, deleteChore, editChore,
    enabledCount, dueCount,
  } = useChoresViewData();

  // Group by user toggle
  const [groupByUser, setGroupByUser] = useState(false);

  // Group chores by assigned user
  const choresByUser = useMemo(() => {
    if (!groupByUser) return null;

    const groups: { user: { id: string; name: string; color: string } | null; chores: typeof filteredChores }[] = [];

    // Group by each family member
    familyMembers.forEach((member) => {
      const userChores = filteredChores.filter((c) => c.assignedTo?.id === member.id);
      if (userChores.length > 0) {
        groups.push({ user: member, chores: userChores });
      }
    });

    // Unassigned chores
    const unassigned = filteredChores.filter((c) => !c.assignedTo);
    if (unassigned.length > 0) {
      groups.push({ user: null, chores: unassigned });
    }

    return groups;
  }, [groupByUser, filteredChores, familyMembers]);

  const handleAddWithAuth = async () => {
    const user = await requireAuth('Add Chore', 'Please log in to add a chore');
    if (!user) return;
    setShowAddModal(true);
  };

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3 safe-area-top">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex">
                <Link href="/" aria-label="Back to dashboard"><Home className="h-5 w-5" /></Link>
              </Button>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">Chores</h1>
                <Badge variant="secondary">{enabledCount} active</Badge>
                {dueCount > 0 && <Badge variant="destructive">{dueCount} due</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showCompletions ? 'secondary' : 'outline'}
                size="icon"
                onClick={() => setShowCompletions(!showCompletions)}
                className="h-10 w-10"
              >
                <History className="h-5 w-5" />
                <span className="sr-only">History</span>
              </Button>
              <Button onClick={handleAddWithAuth} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Chore
              </Button>
            </div>
          </div>
        </header>

        <div className="hidden md:block flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-2">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Person:</span>
              <div className="flex gap-1">
                <Button variant={filterPerson === null ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterPerson(null)}>All</Button>
                {familyMembers.map((member) => (
                  <Button key={member.id} variant={filterPerson === member.id ? 'secondary' : 'ghost'} size="sm"
                    onClick={() => setFilterPerson(member.id)} className="gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: member.color }} />
                    {member.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Category:</span>
              <div className="flex gap-1">
                <Button variant={filterCategory === null ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterCategory(null)}>All</Button>
                {['cleaning', 'laundry', 'dishes', 'yard', 'pets', 'trash'].map((category) => (
                  <Button key={category} variant={filterCategory === category ? 'secondary' : 'ghost'} size="sm"
                    onClick={() => setFilterCategory(category)} className="capitalize">{category}</Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show disabled:</span>
              <Switch checked={showDisabled} onCheckedChange={setShowDisabled} />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={groupByUser ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setGroupByUser(!groupByUser)}
                className="gap-1"
              >
                <Users className="h-4 w-4" />
                Group by Person
              </Button>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <SortAsc className="h-4 w-4 text-muted-foreground" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-sm bg-card text-foreground border border-border rounded px-2 py-1 [&>option]:bg-card [&>option]:text-foreground">
                <option value="nextDue">Next Due</option>
                <option value="category">Category</option>
                <option value="frequency">Frequency</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {showCompletions ? (
            <div className="max-w-4xl mx-auto space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Completions (Last 14 Days)
              </h2>
              {completionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : completions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No completed chores in the last 14 days.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {completions.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border bg-card/85 backdrop-blur-sm',
                        c.approvedBy ? 'border-border' : 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/30'
                      )}
                    >
                      <span className="text-lg shrink-0">{getCategoryEmoji(c.choreCategory)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{c.choreTitle}</span>
                          {c.pointsAwarded > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              +{c.pointsAwarded} pts
                            </Badge>
                          )}
                          {c.approvedBy ? (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                              <ShieldCheck className="h-3 w-3 mr-0.5" />Approved
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs bg-amber-500 hover:bg-amber-500">
                              Pending Approval
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <UserAvatar
                              name={c.completedBy.name}
                              color={c.completedBy.color}
                              size="sm"
                              className="h-4 w-4 text-[8px]"
                            />
                            <span>{c.completedBy.name}</span>
                          </div>
                          {c.approvedBy && (
                            <div className="flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3 text-green-500" />
                              <span>{c.approvedBy.name}</span>
                            </div>
                          )}
                          <span title={format(parseISO(c.completedAt), 'PPpp')}>
                            {formatDistanceToNow(parseISO(c.completedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Clock className="h-12 w-12 mb-4 opacity-50 animate-pulse" /><p>Loading chores...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-destructive">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" /><p>{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refreshChores()}>Try Again</Button>
            </div>
          ) : filteredChores.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-4 opacity-50" /><p>No chores found</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleAddWithAuth}>Add your first chore</Button>
            </div>
          ) : groupByUser && choresByUser ? (
            <div className="space-y-6 max-w-4xl mx-auto">
              {choresByUser.map(({ user, chores }) => (
                <div key={user?.id || 'unassigned'} className="space-y-2">
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border-l-4"
                    style={{
                      borderLeftColor: user?.color || '#6B7280',
                      backgroundColor: (user?.color || '#6B7280') + '10',
                    }}
                  >
                    {user ? (
                      <UserAvatar name={user.name} color={user.color} size="sm" className="h-6 w-6" />
                    ) : (
                      <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold" style={{ color: user?.color || '#6B7280' }}>
                      {user?.name || 'Unassigned'}
                    </h3>
                    <Badge variant="outline" className="ml-auto">
                      {chores.length} chore{chores.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="space-y-2 pl-2">
                    {chores.map((chore) => (
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
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-w-4xl mx-auto">
              {filteredChores.map((chore) => (
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
          <ChoreModal
            onClose={() => setShowAddModal(false)}
            onSave={async (chore) => {
              try {
                const response = await fetch('/api/chores', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: chore.title, description: chore.description, category: chore.category,
                    frequency: chore.frequency, pointValue: chore.pointValue,
                    requiresApproval: chore.requiresApproval, assignedTo: chore.assignedTo?.id,
                  }),
                });
                if (!response.ok) {
                  const data = await response.json().catch(() => ({}));
                  throw new Error(data.error || 'Failed to create chore');
                }
                refreshChores();
                setShowAddModal(false);
              } catch (err) {
                console.error('Error creating chore:', err);
                alert(err instanceof Error ? err.message : 'Failed to create chore');
              }
            }}
            familyMembers={familyMembers}
          />
        )}

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
                    title: updatedChore.title, description: updatedChore.description, category: updatedChore.category,
                    frequency: updatedChore.frequency, pointValue: updatedChore.pointValue,
                    requiresApproval: updatedChore.requiresApproval, assignedTo: updatedChore.assignedTo?.id,
                    enabled: updatedChore.enabled,
                  }),
                });
                if (!response.ok) throw new Error('Failed to update chore');
                refreshChores();
                setEditingChore(null);
              } catch (err) {
                console.error('Error updating chore:', err);
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
