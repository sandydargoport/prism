'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Plus,
  Home,
  Pencil,
  Trash2,
  Check,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageWrapper } from '@/components/layout';
import { useGoals, type Goal } from '@/lib/hooks/useGoals';
import { usePoints } from '@/lib/hooks/usePoints';
import { useAuth } from '@/components/providers';
import { cn } from '@/lib/utils';

const EMOJI_OPTIONS = ['🎯', '🍦', '🎬', '🎮', '📱', '🎁', '🏖️', '🎪', '⭐', '💰', '🍕', '🎵'];

export function GoalsView() {
  const { activeUser } = useAuth();
  const isParent = activeUser?.role === 'parent';

  const {
    goals, progress, goalChildren, loading: goalsLoading, error: goalsError,
    createGoal, updateGoal, deleteGoal, reorderGoals, resetGoal, refresh: refreshGoals,
  } = useGoals();
  const { points, loading: pointsLoading, error: pointsError } = usePoints();

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPointCost, setFormPointCost] = useState('');
  const [formEmoji, setFormEmoji] = useState('🎯');
  const [formRecurring, setFormRecurring] = useState(false);
  const [formRecurrencePeriod, setFormRecurrencePeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [saving, setSaving] = useState(false);

  const loading = goalsLoading || pointsLoading;
  const error = goalsError || pointsError;

  const openAddModal = () => {
    setEditingGoal(null);
    setFormName('');
    setFormDescription('');
    setFormPointCost('');
    setFormEmoji('🎯');
    setFormRecurring(false);
    setFormRecurrencePeriod('weekly');
    setShowGoalModal(true);
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setFormName(goal.name);
    setFormDescription(goal.description || '');
    setFormPointCost(String(goal.pointCost));
    setFormEmoji(goal.emoji || '🎯');
    setFormRecurring(goal.recurring);
    setFormRecurrencePeriod(goal.recurrencePeriod || 'weekly');
    setShowGoalModal(true);
  };

  const handleSave = async () => {
    const cost = parseInt(formPointCost, 10);
    if (!formName.trim() || isNaN(cost) || cost < 1) return;

    setSaving(true);
    try {
      const data = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        pointCost: cost,
        emoji: formEmoji,
        recurring: formRecurring,
        recurrencePeriod: formRecurring ? formRecurrencePeriod : undefined,
      };

      if (editingGoal) {
        await updateGoal(editingGoal.id, data);
      } else {
        await createGoal(data);
      }
      setShowGoalModal(false);
    } catch (err) {
      console.error('Failed to save goal:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try { await deleteGoal(id); } catch (err) { console.error('Failed to delete:', err); }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const ids = goals.map((g) => g.id);
    [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
    try { await reorderGoals(ids); } catch (err) { console.error('Failed to reorder:', err); }
  };

  const handleMoveDown = async (index: number) => {
    if (index >= goals.length - 1) return;
    const ids = goals.map((g) => g.id);
    [ids[index], ids[index + 1]] = [ids[index + 1]!, ids[index]!];
    try { await reorderGoals(ids); } catch (err) { console.error('Failed to reorder:', err); }
  };

  const handleReset = async (goalId: string) => {
    try { await resetGoal(goalId); } catch (err) { console.error('Failed to reset:', err); }
  };

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/" aria-label="Back to dashboard"><Home className="h-5 w-5" /></Link>
              </Button>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">Goals & Points</h1>
              </div>
            </div>
            {isParent && (
              <Button onClick={openAddModal}>
                <Plus className="h-4 w-4 mr-1" />Add Goal
              </Button>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {error && (
            <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Point Counters */}
          {points.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Point Counters</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {points.map((child) => (
                  <div key={child.userId} className="bg-card rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: child.color }} />
                      <span className="font-medium">{child.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-2xl font-bold tabular-nums">{child.weekly}</div>
                        <div className="text-xs text-muted-foreground">This Week</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold tabular-nums">{child.monthly}</div>
                        <div className="text-xs text-muted-foreground">This Month</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold tabular-nums">{child.yearly}</div>
                        <div className="text-xs text-muted-foreground">This Year</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Goals (priority order) */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Goals (Priority Order)</h2>
            {loading && goals.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : goals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No goals yet.</p>
                {isParent && (
                  <Button variant="outline" className="mt-3" onClick={openAddModal}>
                    <Plus className="h-4 w-4 mr-1" />Add Goal
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map((goal, index) => (
                  <div
                    key={goal.id}
                    className={cn(
                      'rounded-lg border p-4',
                      goal.fullyAchieved
                        ? 'border-green-500/50 bg-green-100 dark:bg-green-950'
                        : 'bg-card border-border'
                    )}
                  >
                    {/* Goal header */}
                    <div className="flex items-center gap-2 mb-3">
                      {isParent && (
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(index)}
                            disabled={index >= goals.length - 1}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      <span className="text-xl">{goal.emoji || '🎯'}</span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{goal.name}</h3>
                          {goal.fullyAchieved && (
                            <Check className="h-5 w-5 text-green-500 shrink-0" />
                          )}
                        </div>
                        {goal.description && (
                          <p className="text-xs text-muted-foreground truncate">{goal.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="tabular-nums">
                          {goal.pointCost} pts
                        </Badge>
                        {goal.recurring && (
                          <Badge variant="outline" className="text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {goal.recurrencePeriod}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Per-child progress */}
                    <div className="space-y-2">
                      {goalChildren.map((child) => {
                        const cp = progress[child.userId]?.[goal.id];
                        const allocated = cp?.allocated || 0;
                        const pct = Math.min(100, (allocated / goal.pointCost) * 100);
                        const achieved = cp?.achieved || false;

                        return (
                          <div key={child.userId} className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 w-20 shrink-0">
                              {achieved ? (
                                <Check className="h-4 w-4" style={{ color: child.color }} />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />
                              )}
                              <span className="text-sm truncate">{child.name}</span>
                            </div>
                            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  achieved && 'opacity-80'
                                )}
                                style={{ width: `${pct}%`, backgroundColor: child.color }}
                              />
                            </div>
                            <span className="text-sm tabular-nums text-muted-foreground w-16 text-right shrink-0">
                              {allocated}/{goal.pointCost}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    {isParent && (
                      <div className="flex justify-end gap-1 pt-2 mt-2 border-t border-border/50">
                        {goal.fullyAchieved && !goal.recurring && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReset(goal.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Reset
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(goal)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(goal.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Add/Edit Goal Modal */}
        {showGoalModal && (
          <Dialog open={showGoalModal} onOpenChange={setShowGoalModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingGoal ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Emoji</Label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className={cn(
                          'w-10 h-10 rounded-lg text-xl flex items-center justify-center border transition-colors',
                          formEmoji === e ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
                        )}
                        onClick={() => setFormEmoji(e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-name">Name</Label>
                  <Input
                    id="goal-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Weekly Allowance"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-description">Description (optional)</Label>
                  <Textarea
                    id="goal-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="What does the child get?"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-cost">Point Cost</Label>
                  <Input
                    id="goal-cost"
                    type="number"
                    min={1}
                    value={formPointCost}
                    onChange={(e) => setFormPointCost(e.target.value)}
                    placeholder="e.g. 50"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formRecurring}
                    onCheckedChange={setFormRecurring}
                    id="goal-recurring"
                  />
                  <Label htmlFor="goal-recurring">Recurring (resets automatically)</Label>
                </div>
                {formRecurring && (
                  <div className="space-y-2">
                    <Label>Reset Period</Label>
                    <Select value={formRecurrencePeriod} onValueChange={(v) => setFormRecurrencePeriod(v as 'weekly' | 'monthly' | 'yearly')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowGoalModal(false)}>Cancel</Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !formName.trim() || !formPointCost || parseInt(formPointCost) < 1}
                >
                  {saving ? 'Saving...' : editingGoal ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </PageWrapper>
  );
}
