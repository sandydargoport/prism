'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { Check } from 'lucide-react';
import type { Goal, ChildProgress, GoalChild } from '@/lib/hooks/useGoals';

export interface PointsWidgetProps {
  goals: Goal[];
  progress: Record<string, Record<string, ChildProgress>>;
  goalChildren: GoalChild[];
  loading?: boolean;
  error?: string | null;
  titleHref?: string;
}

export function PointsWidget({
  goals,
  progress,
  goalChildren,
  loading,
  error,
  titleHref = '/goals',
}: PointsWidgetProps) {
  return (
    <WidgetContainer
      title="Points"
      icon={<span className="text-sm">🏆</span>}
      loading={loading}
      error={error}
      titleHref={titleHref}
    >
      {goals.length === 0 ? (
        <WidgetEmpty message="No goals yet" />
      ) : (
        <div className="space-y-3 p-2 overflow-y-auto h-full">
          {/* Per-child weekly counters */}
          {goalChildren.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {goalChildren.map((child) => (
                <div key={child.userId} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: child.color }}
                  />
                  <span className="font-medium">{child.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {child.counters.weekly}/wk
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Goals in priority order with per-child progress */}
          {goals.map((goal) => (
            <div key={goal.id} className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm">
                {goal.fullyAchieved && (
                  <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                )}
                <span>{goal.emoji || '🎯'}</span>
                <span className="font-medium truncate">{goal.name}</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums shrink-0">
                  {goal.pointCost}pts
                </span>
              </div>

              {goalChildren.map((child) => {
                const cp = progress[child.userId]?.[goal.id];
                const allocated = cp?.allocated || 0;
                const pct = Math.min(100, (allocated / goal.pointCost) * 100);
                return (
                  <div key={child.userId} className="flex items-center gap-1.5">
                    {cp?.achieved ? (
                      <Check className="h-3 w-3 shrink-0" style={{ color: child.color }} />
                    ) : (
                      <div className="w-3 h-3 shrink-0" />
                    )}
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: child.color }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                      {allocated}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </WidgetContainer>
  );
}
