'use client';

import Link from 'next/link';
import { format, parseISO, formatDistanceToNow, isPast, differenceInDays } from 'date-fns';
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
  CalendarDays,
  Settings,
} from 'lucide-react';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { PlaneCelebration } from '@/components/ui/PlaneCelebration';
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

  // Group by user toggle (default to true)
  const [groupByUser, setGroupByUser] = useState(true);

  // Celebration state
  const [celebratingUser, setCelebratingUser] = useState<{ id: string; name: string } | null>(null);

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
                size="sm"
                onClick={() => setShowCompletions(!showCompletions)}
              >
                <History className="h-4 w-4 mr-1" />
                History
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
            <div className={cn(
              'grid gap-2 h-full',
              choresByUser.length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
              choresByUser.length <= 4 ? 'grid-cols-2' :
              'grid-cols-2 md:grid-cols-3'
            )}>
              {choresByUser.map(({ user, chores }) => {
                const userColor = user?.color || '#6B7280';
                return (
                  <div
                    key={user?.id || 'unassigned'}
                    className="flex flex-col border-2 rounded-lg overflow-hidden bg-card/90 backdrop-blur-sm"
                    style={{ borderColor: userColor }}
                  >
                    {/* User header */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 shrink-0"
                      style={{ backgroundColor: userColor + '20' }}
                    >
                      {user ? (
                        <UserAvatar name={user.name} color={user.color} size="sm" className="h-7 w-7" />
                      ) : (
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                      )}
                      <h3 className="font-bold text-lg" style={{ color: userColor }}>
                        {user?.name || 'Unassigned'}
                      </h3>
                      <Badge variant="outline" className="ml-auto">
                        {chores.length}
                      </Badge>
                    </div>
                    {/* Scrollable chores list */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {chores.map((chore) => {
                        const nextDue = chore.nextDue ? new Date(chore.nextDue) : null;
                        const isOverdue = nextDue && isPast(nextDue);
                        const daysUntil = nextDue ? differenceInDays(nextDue, new Date()) : null;
                        const isCompletedToday = chore.lastCompleted &&
                          new Date(chore.lastCompleted) > new Date(Date.now() - 24 * 60 * 60 * 1000);

                        return (
                          <div
                            key={chore.id}
                            className={cn(
                              'p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors',
                              isCompletedToday ? 'opacity-60 bg-green-50/50 dark:bg-green-950/20 border-green-500/30' :
                              isOverdue ? 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20' : 'border-border'
                            )}
                            onClick={async () => {
                              const success = await completeChore(chore.id);
                              // Only celebrate if chore was actually completed
                              if (success && user) {
                                const otherChores = chores.filter((c) => c.id !== chore.id);
                                const allOthersCompleted = otherChores.every((c) =>
                                  c.lastCompleted && new Date(c.lastCompleted) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                                );
                                if (allOthersCompleted && !isCompletedToday) {
                                  setCelebratingUser({ id: user.id, name: user.name });
                                }
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  'font-medium text-sm truncate',
                                  isCompletedToday && 'line-through'
                                )}>{chore.title}</p>
                                {nextDue && !isCompletedToday && (
                                  <div className={cn(
                                    'flex items-center gap-1 text-xs mt-0.5',
                                    isOverdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                                  )}>
                                    <CalendarDays className="h-3 w-3" />
                                    {isOverdue ? (
                                      <span>Due {formatDistanceToNow(nextDue, { addSuffix: true })}</span>
                                    ) : daysUntil === 0 ? (
                                      <span>Due today</span>
                                    ) : daysUntil === 1 ? (
                                      <span>Due tomorrow</span>
                                    ) : (
                                      <span>Due {format(nextDue, 'MMM d')}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {chore.pointValue > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {chore.pointValue} pts
                                  </Badge>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    editChore(chore);
                                  }}
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {chores.length === 0 && (
                        <p className="text-center text-muted-foreground text-sm py-4">No chores</p>
                      )}
                    </div>
                  </div>
                );
              })}
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

        <PlaneCelebration
          show={!!celebratingUser}
          userName={celebratingUser?.name || ''}
          onComplete={() => setCelebratingUser(null)}
        />
      </div>
    </PageWrapper>
  );
}
