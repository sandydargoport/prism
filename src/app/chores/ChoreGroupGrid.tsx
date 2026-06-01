'use client';

import { useMemo, useState, useCallback } from 'react';
import { ClipboardList, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/avatar';
import { useDragReorder } from '@/lib/hooks/useDragReorder';
import { useIsTouch } from '@/lib/hooks/useIsTouch';
import { ChoreGroupCard } from './ChoreGroupCard';
import { cn } from '@/lib/utils';

export interface ChoreGroupEntry {
  user: { id: string; name: string; color: string } | null;
  chores: any[];
}

interface ChoreGroupGridProps {
  choresByUser: ChoreGroupEntry[];
  inlineChoreByUser: Record<string, string>;
  setInlineChoreByUser: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  inlineAddChore: (title: string, assignedTo?: string) => Promise<boolean>;
  completeChore: (id: string) => Promise<boolean>;
  editChore: (chore: any) => void;
  deleteChore: (id: string) => void;
  setCelebratingUser: (user: { id: string; name: string } | null) => void;
  isMobile?: boolean;
}

export function ChoreGroupGrid({
  choresByUser,
  inlineChoreByUser,
  setInlineChoreByUser,
  inlineAddChore,
  completeChore,
  editChore,
  deleteChore,
  setCelebratingUser,
  isMobile = false,
}: ChoreGroupGridProps) {
  const isTouch = useIsTouch();
  const groupKeys = useMemo(
    () => choresByUser.map((g) => g.user?.id || 'unassigned'),
    [choresByUser]
  );

  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('prism:chore-group-order');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const effectiveOrder = useMemo(() => {
    const known = groupOrder.filter((k) => groupKeys.includes(k));
    const newKeys = groupKeys.filter((k) => !known.includes(k));
    return [...known, ...newKeys];
  }, [groupOrder, groupKeys]);

  const saveOrder = useCallback((order: string[]) => {
    setGroupOrder(order);
    try {
      localStorage.setItem('prism:chore-group-order', JSON.stringify(order));
    } catch {}
  }, []);

  const { draggedId, getDragProps, moveUp, moveDown } = useDragReorder({ order: effectiveOrder, onReorder: saveOrder });

  const sortedGroups = useMemo(() => {
    const map = new Map(choresByUser.map((g) => [g.user?.id || 'unassigned', g]));
    return effectiveOrder.map((k) => map.get(k)).filter(Boolean) as ChoreGroupEntry[];
  }, [choresByUser, effectiveOrder]);

  // Desktop / tablet: each column gets a minimum readable width (220px);
  // grid overflows horizontally when the viewport can't fit every column.
  // Mobile (with multiple groups): each column is sized to the viewport
  // width and CSS scroll-snap turns the row into a swipeable carousel —
  // user swipes left/right between profiles, scrolls up/down inside each.
  // Replaces the previous `grid-cols-2 md:grid-cols-3` squeeze (bug #105).
  // Same shape now used across all per-person list views.
  const isSwipeCarousel = isMobile && sortedGroups.length > 1;
  return (
    <div
      className={cn(
        'grid gap-2 h-full overflow-x-auto',
        isSwipeCarousel && 'snap-x snap-mandatory'
      )}
      style={{
        gridTemplateColumns: isSwipeCarousel
          ? `repeat(${sortedGroups.length}, calc(100vw - 32px))`
          : `repeat(${Math.max(sortedGroups.length, 1)}, minmax(220px, 1fr))`,
      }}
    >
      {sortedGroups.map(({ user, chores }, idx) => {
        const userColor = user?.color || '#6B7280';
        const key = user?.id || 'unassigned';
        const isDragging = draggedId === key;
        return (
          <div
            key={key}
            {...(!isTouch && !isMobile ? getDragProps(key) : {})}
            className={cn(
              'flex flex-col border-2 rounded-lg overflow-hidden bg-card/90 backdrop-blur-sm transition-all',
              !isTouch && !isMobile && 'cursor-grab active:cursor-grabbing touch-none',
              isDragging && 'opacity-50 scale-95 ring-4 ring-primary/50',
              isSwipeCarousel && 'snap-start'
            )}
            style={{ borderColor: userColor }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2 shrink-0"
              style={{ backgroundColor: userColor + '20' }}
            >
              {/* Mouse: grip icon / Touch: up-down arrows */}
              {isTouch || isMobile ? (
                <div className="flex flex-col shrink-0">
                  <button
                    type="button"
                    onClick={() => moveUp(key)}
                    disabled={idx === 0}
                    className="p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20 transition-colors"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(key)}
                    disabled={idx === sortedGroups.length - 1}
                    className="p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20 transition-colors"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              )}
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
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <Input
                placeholder="Add chore..."
                value={inlineChoreByUser[key] || ''}
                onChange={(e) =>
                  setInlineChoreByUser((prev) => ({ ...prev, [key]: e.target.value }))
                }
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = (inlineChoreByUser[key] || '').trim();
                    if (!val) return;
                    const success = await inlineAddChore(val, user?.id);
                    if (success) setInlineChoreByUser((prev) => ({ ...prev, [key]: '' }));
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                draggable={false}
                className="h-8 text-sm mb-1"
              />
              {chores.map((chore) => (
                <ChoreGroupCard
                  key={chore.id}
                  chore={chore}
                  assignedUser={user}
                  allChores={chores}
                  onComplete={() => completeChore(chore.id)}
                  onEdit={() => editChore(chore)}
                  onDelete={() => deleteChore(chore.id)}
                  setCelebratingUser={setCelebratingUser}
                />
              ))}
              {chores.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">No chores</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
