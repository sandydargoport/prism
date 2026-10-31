/**
 *
 * Displays a list of household chores with completion tracking.
 *
 * FEATURES:
 * - List of upcoming chores
 * - Color-coded by assigned family member
 * - Frequency indicators (daily, weekly, etc.)
 * - Next due date display
 * - Quick complete button
 * - Filter by person
 * - Point values for completed chores
 *
 * INTERACTION:
 * - Tap checkbox to mark complete
 * - Shows approval status for chores requiring approval
 *
 * USAGE:
 *   <ChoresWidget />
 *   <ChoresWidget userId="user1" />
 *   <ChoresWidget showDisabled={false} />
 *
 */

'use client';

import * as React from 'react';
import { Emoji } from '@/components/ui/Emoji';
import { useState, useMemo, useCallback } from 'react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { ClipboardList, Plus, AlertCircle, Clock, Hourglass, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { Button, Badge, UserAvatar } from '@/components/ui';

/**
 * CHORE TYPE
 * Represents a single chore item.
 */
// Chore type imported from shared types
import type { Chore } from '@/types';
import { useLocalDateKey } from '@/lib/hooks/useLocalDateKey';
export type { Chore };

/**
 * CHORES WIDGET PROPS
 */
export interface ChoresWidgetProps {
  /** Chores to display (if provided externally) */
  chores?: Chore[];
  /** Filter chores by user ID */
  userId?: string;
  /** Show disabled chores */
  showDisabled?: boolean;
  /** Maximum number of chores to show */
  maxChores?: number;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Callback when chore is completed */
  onChoreComplete?: (choreId: string) => void;
  /** Callback when add button is clicked */
  onAddClick?: () => void;
  /** Callback when a chore row is clicked (opens edit modal). */
  onChoreClick?: (chore: Chore) => void;
  /** URL for the full chores page (makes title clickable) */
  titleHref?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * CHORES WIDGET COMPONENT
 * Displays a list of chores with completion tracking.
 *
 * @example Basic usage
 * <ChoresWidget />
 *
 * @example Filter by user
 * <ChoresWidget userId="user1" />
 *
 * @example With callbacks
 * <ChoresWidget
 *   onChoreComplete={(id) => handleComplete(id)}
 *   onAddClick={() => openAddChoreDialog()}
 * />
 */
export const ChoresWidget = React.memo(function ChoresWidget({
  chores: externalChores,
  userId,
  showDisabled = false,
  maxChores = 8,
  loading = false,
  error = null,
  onChoreComplete,
  onAddClick,
  onChoreClick,
  titleHref,
  className,
}: ChoresWidgetProps) {
  // Re-render at midnight so "Today" and "Tomorrow" move on with the date;
  // the item labels below are computed from the clock on each render.
  useLocalDateKey();
  // Use provided chores (no demo data fallback in production)
  const allChores = externalChores || [];

  const { filteredChores, displayChores } = useMemo(() => {
    let filtered = allChores;
    if (userId) filtered = filtered.filter((c) => c.assignedTo?.id === userId);
    if (!showDisabled) filtered = filtered.filter((c) => c.enabled);
    filtered = [...filtered].sort((a, b) => {
      if (!a.nextDue && !b.nextDue) return 0;
      if (!a.nextDue) return 1;
      if (!b.nextDue) return -1;
      return a.nextDue.localeCompare(b.nextDue);
    });
    return { filteredChores: filtered, displayChores: filtered.slice(0, maxChores) };
  }, [allChores, userId, showDisabled, maxChores]);

  // Local state for optimistic updates
  const [completingChores, setCompletingChores] = useState<Set<string>>(new Set());

  const handleComplete = useCallback(async (choreId: string) => {
    // Mark as completing
    setCompletingChores((prev) => new Set(prev).add(choreId));

    // Call external handler
    try {
      await onChoreComplete?.(choreId);
    } finally {
      // Remove from completing state
      setCompletingChores((prev) => {
        const next = new Set(prev);
        next.delete(choreId);
        return next;
      });
    }
  }, [onChoreComplete]);

  return (
    <WidgetContainer
      title="Chores"
      titleHref={titleHref}
      icon={<ClipboardList className="h-4 w-4" />}
      size="medium"
      loading={loading}
      error={error}
      actions={
        onAddClick && (
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onAddClick();
            }}
            className="h-8 w-8"
            aria-label="Add chore"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )
      }
      className={className}
    >
      {displayChores.length === 0 ? (
        <WidgetEmpty
          icon={<ClipboardList className="h-8 w-8" />}
          message="No chores due today"
          action={
            onAddClick && (
              <Button size="sm" variant="outline" onClick={onAddClick}>
                Add Chore
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-auto h-full -mr-2 pr-2">
          <div className="space-y-2">
            {displayChores.map((chore) => (
              <ChoreItem
                key={chore.id}
                chore={chore}
                completing={completingChores.has(chore.id)}
                onComplete={() => handleComplete(chore.id)}
                onEdit={onChoreClick ? () => onChoreClick(chore) : undefined}
              />
            ))}
          </div>

          {/* Show count of remaining chores */}
          {filteredChores.length > maxChores && (
            <div className="mt-3 text-center text-xs text-muted-foreground">
              +{filteredChores.length - maxChores} more chores
            </div>
          )}
        </div>
      )}
    </WidgetContainer>
  );
});

/**
 * CHORE ITEM
 * A single chore row: tap anywhere on it to complete it (or approve it, when
 * it is waiting), pencil to edit.
 */
function ChoreItem({
  chore,
  completing,
  onComplete,
  onEdit,
}: {
  chore: Chore;
  completing: boolean;
  onComplete: () => void;
  onEdit?: () => void;
}) {
  // Format next due date
  const dueDateDisplay = chore.nextDue ? formatDueDate(chore.nextDue) : null;

  // Check if overdue
  const isOverdue = chore.nextDue && isPast(parseISO(chore.nextDue));

  // Check if pending approval
  const isPendingApproval = !!chore.pendingApproval;

  // Get category emoji
  const categoryEmoji = getCategoryEmoji(chore.category);

  // The whole row is the tap target, as the Tasks page and recipe
  // ingredients are: a tap completes the chore (approves it when it is
  // waiting), and it is crossed out while that is under way.
  const complete = () => { if (!completing) onComplete(); };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={isPendingApproval ? `Approve ${chore.title}` : `Complete ${chore.title}`}
      aria-disabled={completing || undefined}
      onClick={complete}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); complete(); } }}
      className={cn(
        'flex items-start gap-3 p-2 rounded-lg cursor-pointer select-none',
        'hover:bg-accent/50 transition-colors',
        'touch-action-manipulation',
        completing && 'opacity-60',
        isPendingApproval && 'bg-warning/10 border border-warning/30'
      )}
    >
      {/* Status, not a button: busy while completing, waiting for approval. */}
      {(completing || isPendingApproval) && (
        <span aria-hidden className={cn('mt-0.5 shrink-0', isPendingApproval ? 'text-warning' : 'text-muted-foreground')}>
          {completing ? <Clock className="h-4 w-4 animate-spin" /> : <Hourglass className="h-4 w-4" />}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Category emoji */}
          <span className="text-base"><Emoji e={categoryEmoji} /></span>

          {/* Title */}
          <span className={cn(
            'text-sm font-medium truncate',
            isPendingApproval && 'text-warning',
            completing && 'line-through text-muted-foreground'
          )}>{chore.title}</span>

          {/* Points badge */}
          {chore.pointValue > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              +{chore.pointValue}
            </Badge>
          )}

          {/* Pending approval badge - takes priority over "requires approval" */}
          {isPendingApproval ? (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-warning hover:bg-warning">
              Pending
            </Badge>
          ) : chore.requiresApproval && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Approval
            </Badge>
          )}
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2 mt-0.5">
          {/* Show who completed it if pending approval */}
          {isPendingApproval && chore.pendingApproval && (
            <div className="flex items-center gap-1">
              <UserAvatar
                name={chore.pendingApproval.completedBy.name}
                color={chore.pendingApproval.completedBy.color}
                size="sm"
                className="h-4 w-4 text-[8px]"
              />
              <span className="text-xs text-warning">
                Done by {chore.pendingApproval.completedBy.name}
              </span>
            </div>
          )}

          {/* Assigned to - only show if not pending */}
          {!isPendingApproval && chore.assignedTo && (
            <div className="flex items-center gap-1">
              <UserAvatar
                name={chore.assignedTo.name}
                color={chore.assignedTo.color}
                size="sm"
                className="h-4 w-4 text-[8px]"
              />
              <span className="text-xs text-muted-foreground">
                {chore.assignedTo.name}
              </span>
            </div>
          )}

          {/* Frequency */}
          <span className="text-xs text-muted-foreground">
            {formatFrequency(chore.frequency, chore.customIntervalDays)}
          </span>

          {/* Due date - only show if not pending */}
          {!isPendingApproval && dueDateDisplay && (
            <span
              className={cn(
                'text-xs',
                isOverdue
                  ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              )}
            >
              {isOverdue && <AlertCircle className="h-3 w-3 inline mr-0.5" />}
              {dueDateDisplay}
            </span>
          )}
        </div>
      </div>

      {onEdit && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-muted-foreground opacity-60 hover:opacity-100"
          // The row completes the chore, so the pencil must not also do that.
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Edit chore"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/**
 * FORMAT DUE DATE
 * Formats a due date in a human-friendly way.
 */
function formatDueDate(dateString: string): string {
  const date = parseISO(dateString);
  if (isToday(date)) return 'Due today';
  if (isTomorrow(date)) return 'Due tomorrow';
  if (isPast(date)) return 'Overdue';
  return `Due ${format(date, 'MMM d')}`;
}

/**
 * FORMAT FREQUENCY
 * Formats chore frequency in a human-friendly way.
 */
function formatFrequency(frequency: string, customIntervalDays?: number): string {
  switch (frequency) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Every 2 weeks';
    case 'monthly':
      return 'Monthly';
    case 'custom':
      return customIntervalDays ? `Every ${customIntervalDays} days` : 'Custom';
    default:
      return frequency;
  }
}

/**
 * GET CATEGORY EMOJI
 * Returns an emoji for the chore category.
 */
function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'cleaning':
      return '🧹';
    case 'laundry':
      return '🧺';
    case 'dishes':
      return '🍽️';
    case 'yard':
      return '🌿';
    case 'pets':
      return '🐾';
    case 'trash':
      return '🗑️';
    default:
      return '✨';
  }
}

