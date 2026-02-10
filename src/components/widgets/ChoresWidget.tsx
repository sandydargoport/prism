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
 *   <ChoresWidget userId="alex" />
 *   <ChoresWidget showDisabled={false} />
 *
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { ClipboardList, Plus, AlertCircle, CheckCircle, Clock, Hourglass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { Button, Badge, ScrollArea, UserAvatar } from '@/components/ui';

/**
 * CHORE TYPE
 * Represents a single chore item.
 */
// Chore type imported from shared types
import type { Chore } from '@/types';
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
 * <ChoresWidget userId="alex" />
 *
 * @example With callbacks
 * <ChoresWidget
 *   onChoreComplete={(id) => handleComplete(id)}
 *   onAddClick={() => openAddChoreDialog()}
 * />
 */
export function ChoresWidget({
  chores: externalChores,
  userId,
  showDisabled = false,
  maxChores = 8,
  loading = false,
  error = null,
  onChoreComplete,
  onAddClick,
  titleHref,
  className,
}: ChoresWidgetProps) {
  // Use provided chores (no demo data fallback in production)
  const allChores = externalChores || [];

  // Filter chores
  let filteredChores = allChores;

  // Filter by user if specified
  if (userId) {
    filteredChores = filteredChores.filter(
      (chore) => chore.assignedTo?.id === userId
    );
  }

  // Filter out disabled chores if not showing them
  if (!showDisabled) {
    filteredChores = filteredChores.filter((chore) => chore.enabled);
  }

  // Sort by next due date (overdue first, then soonest)
  filteredChores = filteredChores.sort((a, b) => {
    if (!a.nextDue && !b.nextDue) return 0;
    if (!a.nextDue) return 1;
    if (!b.nextDue) return -1;
    return a.nextDue.localeCompare(b.nextDue);
  });

  // Limit number of chores
  const displayChores = filteredChores.slice(0, maxChores);

  // Local state for optimistic updates
  const [completingChores, setCompletingChores] = useState<Set<string>>(new Set());

  const handleComplete = async (choreId: string) => {
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
  };

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
        <ScrollArea className="h-full -mr-2 pr-2">
          <div className="space-y-2">
            {displayChores.map((chore) => (
              <ChoreItem
                key={chore.id}
                chore={chore}
                completing={completingChores.has(chore.id)}
                onComplete={() => handleComplete(chore.id)}
              />
            ))}
          </div>

          {/* Show count of remaining chores */}
          {filteredChores.length > maxChores && (
            <div className="mt-3 text-center text-xs text-muted-foreground">
              +{filteredChores.length - maxChores} more chores
            </div>
          )}
        </ScrollArea>
      )}
    </WidgetContainer>
  );
}

/**
 * CHORE ITEM
 * A single chore row with completion button, title, and metadata.
 */
function ChoreItem({
  chore,
  completing,
  onComplete,
}: {
  chore: Chore;
  completing: boolean;
  onComplete: () => void;
}) {
  // Format next due date
  const dueDateDisplay = chore.nextDue ? formatDueDate(chore.nextDue) : null;

  // Check if overdue
  const isOverdue = chore.nextDue && isPast(parseISO(chore.nextDue));

  // Check if pending approval
  const isPendingApproval = !!chore.pendingApproval;

  // Get category emoji
  const categoryEmoji = getCategoryEmoji(chore.category);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2 rounded-lg',
        'hover:bg-accent/50 transition-colors',
        'touch-action-manipulation',
        isPendingApproval && 'bg-amber-500/10 border border-amber-500/30'
      )}
    >
      {/* Complete button - always enabled, shows pending state visually */}
      <Button
        size="icon"
        variant="ghost"
        onClick={onComplete}
        disabled={completing}
        className={cn(
          'h-8 w-8 shrink-0',
          isOverdue && !isPendingApproval && 'text-destructive hover:text-destructive',
          isPendingApproval && 'text-amber-500'
        )}
        title={isPendingApproval ? 'Pending approval - click to complete or approve' : 'Mark as complete'}
      >
        {completing ? (
          <Clock className="h-4 w-4 animate-spin" />
        ) : isPendingApproval ? (
          <Hourglass className="h-4 w-4" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
      </Button>

      {/* Chore content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Category emoji */}
          <span className="text-base">{categoryEmoji}</span>

          {/* Title */}
          <span className={cn(
            'text-sm font-medium truncate',
            isPendingApproval && 'text-amber-700 dark:text-amber-400'
          )}>{chore.title}</span>

          {/* Points badge */}
          {chore.pointValue > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              +{chore.pointValue}
            </Badge>
          )}

          {/* Pending approval badge - takes priority over "requires approval" */}
          {isPendingApproval ? (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-amber-500 hover:bg-amber-500">
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
              <span className="text-xs text-amber-600 dark:text-amber-400">
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

