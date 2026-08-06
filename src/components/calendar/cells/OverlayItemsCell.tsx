'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { WeekItemCard, type WeekItemSize, type WeekItemLayout } from './WeekItemCard';
import type { DayBucket } from '@/lib/hooks/useWeekViewData';

const MEAL_FALLBACK_COLOR = '#10b981';
const CHORE_FALLBACK_COLOR = '#f59e0b';
const TASK_FALLBACK_COLOR = '#3b82f6';

function mealStripeColor(meal: {
  cookedBy?: { color: string } | null;
  createdBy?: { color: string } | null;
}): string {
  return meal.cookedBy?.color || meal.createdBy?.color || MEAL_FALLBACK_COLOR;
}

/**
 * Stripe color = assigned user's avatar color so a glance at a card
 * tells you who owns it. Pending-approval status is conveyed by a
 * separate diagonal-stripe overlay on the card body.
 */
function choreStripeColor(chore: { assignedTo?: { color: string } | null }): string {
  return chore.assignedTo?.color || CHORE_FALLBACK_COLOR;
}

function taskStripeColor(task: { assignedTo?: { color: string } | null }): string {
  return task.assignedTo?.color || TASK_FALLBACK_COLOR;
}

export type OverlayItemRef =
  | { kind: 'meal'; id: string }
  | { kind: 'chore'; id: string }
  | { kind: 'task'; id: string };

interface OverlayItemsCellProps {
  bucket: Pick<DayBucket, 'meals' | 'chores' | 'tasks'>;
  size?: WeekItemSize;
  layout?: WeekItemLayout;
  /** When true, items are draggable. */
  enableDrag?: boolean;
  /** Which item kinds to render. Defaults to all three. */
  include?: { meals?: boolean; chores?: boolean; tasks?: boolean };
  /** When set, every meal uses this stripe color (e.g. the Family calendar
   * group color) instead of the cookedBy / createdBy color. */
  mealColor?: string;
  /** Called when an item card is clicked (not dragged). */
  onItemClick?: (ref: OverlayItemRef) => void;
  className?: string;
}

/**
 * Renders meals + chores + tasks for a single day as a vertical stack of
 * `WeekItemCard`s. Used by every calendar view to surface non-event streams
 * alongside the event cards.
 */
export function OverlayItemsCell({
  bucket,
  size = 'sm',
  layout = 'column',
  enableDrag = false,
  include,
  mealColor,
  onItemClick,
  className,
}: OverlayItemsCellProps) {
  const showMeals = include?.meals ?? true;
  const showChores = include?.chores ?? true;
  const showTasks = include?.tasks ?? true;
  const meals = showMeals ? bucket.meals : [];
  const chores = showChores ? bucket.chores : [];
  const tasks = showTasks ? bucket.tasks : [];
  const hasItems = meals.length + chores.length + tasks.length > 0;
  if (!hasItems) return null;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {chores.map((chore) => (
        <WeekItemCard
          key={`chore-${chore.id}`}
          variant="chore"
          size={size}
          layout={layout}
          stripeColor={choreStripeColor(chore)}
          title={chore.title}
          subtitle={chore.assignedTo?.name}
          pendingApproval={Boolean(chore.pendingApproval)}
          dragId={enableDrag ? `chore:${chore.id}` : undefined}
          onClick={onItemClick ? () => onItemClick({ kind: 'chore', id: chore.id }) : undefined}
        />
      ))}
      {tasks.map((task) => (
        <WeekItemCard
          key={`task-${task.id}`}
          variant="task"
          size={size}
          layout={layout}
          stripeColor={taskStripeColor(task)}
          title={task.title}
          subtitle={task.assignedTo?.name}
          muted={task.completed}
          dragId={enableDrag ? `task:${task.id}` : undefined}
          onClick={onItemClick ? () => onItemClick({ kind: 'task', id: task.id }) : undefined}
        />
      ))}
      {/* Meals pinned to the bottom (Skylight-style), consistent with DayColumn. */}
      {meals.map((meal) => (
        <WeekItemCard
          key={`meal-${meal.id}`}
          variant="meal"
          size={size}
          layout={layout}
          stripeColor={mealColor ?? mealStripeColor(meal)}
          title={meal.name}
          timeLabel={meal.mealType}
          subtitle={meal.cookedBy?.name ? `Cooked by ${meal.cookedBy.name}` : undefined}
          muted={Boolean(meal.cookedAt)}
          dragId={enableDrag ? `meal:${meal.id}` : undefined}
          onClick={onItemClick ? () => onItemClick({ kind: 'meal', id: meal.id }) : undefined}
        />
      ))}
    </div>
  );
}
