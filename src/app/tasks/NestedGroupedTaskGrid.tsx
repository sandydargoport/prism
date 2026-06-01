'use client';

import { useState, useMemo, useCallback } from 'react';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDragReorder } from '@/lib/hooks/useDragReorder';
import { useIsTouch } from '@/lib/hooks/useIsTouch';
import { TaskRow } from '@/app/tasks/TaskRow';
import type { Task } from '@/types';
import type { NestedGroupDef } from '@/app/tasks/taskGroupTypes';

export function NestedGroupedTaskGrid({
  primaryGroups,
  toggleTask,
  editTask,
  setCelebratingUser,
  isMobile = false,
}: {
  primaryGroups: NestedGroupDef[];
  toggleTask: (id: string) => Promise<boolean>;
  editTask: (task: Task) => void;
  setCelebratingUser: (user: { id: string; name: string } | null) => void;
  isMobile?: boolean;
}) {
  const groupKeys = useMemo(() => primaryGroups.map(g => g.key), [primaryGroups]);
  const [groupOrder, setGroupOrder] = useState<string[]>([]);

  const effectiveOrder = useMemo(() => {
    const known = groupOrder.filter(k => groupKeys.includes(k));
    const newKeys = groupKeys.filter(k => !known.includes(k));
    return [...known, ...newKeys];
  }, [groupOrder, groupKeys]);

  const saveOrder = useCallback((order: string[]) => {
    setGroupOrder(order);
    try { localStorage.setItem('prism:task-nested-group-order', JSON.stringify(order)); } catch {}
  }, []);

  useState(() => {
    try {
      const saved = localStorage.getItem('prism:task-nested-group-order');
      if (saved) setGroupOrder(JSON.parse(saved));
    } catch {}
  });

  const isTouch = useIsTouch();
  const { draggedId, getDragProps, moveUp, moveDown } = useDragReorder({ order: effectiveOrder, onReorder: saveOrder });

  const sortedGroups = useMemo(() => {
    const map = new Map(primaryGroups.map(g => [g.key, g]));
    return effectiveOrder.map(k => map.get(k)).filter(Boolean) as NestedGroupDef[];
  }, [primaryGroups, effectiveOrder]);

  // See ChoreGroupGrid for full context. Desktop: min-width columns +
  // horizontal scroll. Mobile (multi-group): viewport-wide columns +
  // scroll-snap carousel — swipe between groups, vertical scroll inside.
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
      {sortedGroups.map((group, idx) => {
        const completedCount = group.tasks.filter(t => t.completed).length;
        const isDragging = draggedId === group.key;
        return (
          <div
            key={group.key}
            {...(!isTouch && !isMobile ? getDragProps(group.key) : {})}
            className={cn(
              'flex flex-col border-2 rounded-lg overflow-hidden bg-card/90 backdrop-blur-sm transition-all',
              !isTouch && !isMobile && 'cursor-grab active:cursor-grabbing touch-none',
              isDragging && 'opacity-50 scale-95 ring-4 ring-primary/50',
              isSwipeCarousel && 'snap-start'
            )}
            style={{ borderColor: group.color }}
          >
            {/* Primary group header */}
            <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ backgroundColor: group.color + '20' }}>
              {isTouch || isMobile ? (
                <div className="flex flex-col shrink-0">
                  <button type="button" onClick={() => moveUp(group.key)} disabled={idx === 0} className="p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20 transition-colors">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => moveDown(group.key)} disabled={idx === sortedGroups.length - 1} className="p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20 transition-colors">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              )}
              {group.avatar}
              <h3 className="font-bold text-lg" style={{ color: group.color }}>{group.label}</h3>
              <Badge variant="outline" className="ml-auto">{completedCount}/{group.tasks.length}</Badge>
            </div>

            {/* Inline add at primary level */}
            <div className="px-2 pt-2 pb-1 shrink-0">
              <Input
                placeholder="Add a task..."
                value={group.inlineValue}
                onChange={(e) => group.onInlineChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); group.onInlineSubmit(); }
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-8 text-sm"
                draggable={false}
              />
            </div>

            {/* Sub-groups */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
              {group.subGroups.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">No tasks</p>
              )}
              {group.subGroups.map((sub) => (
                <div key={sub.key}>
                  <div className="flex items-center gap-1.5 py-1">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                    <span className="text-xs font-medium text-muted-foreground">{sub.label}</span>
                    <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1">
                      {sub.tasks.filter(t => t.completed).length}/{sub.tasks.length}
                    </Badge>
                  </div>
                  <div className="space-y-1 pl-2 border-l-2" style={{ borderColor: sub.color + '60' }}>
                    {sub.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onToggle={async () => {
                          const success = await toggleTask(task.id);
                          if (success && group.celebrationTarget && !task.completed) {
                            const allOthers = group.tasks.filter(t => t.id !== task.id);
                            if (allOthers.every(t => t.completed)) {
                              setCelebratingUser(group.celebrationTarget);
                            }
                          }
                        }}
                        onEdit={() => editTask(task)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
