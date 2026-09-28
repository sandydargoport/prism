/**
 *
 * Displays a list of tasks/to-dos for the family.
 * Shows tasks organized by person or priority.
 *
 * FEATURES:
 * - List of upcoming tasks with checkboxes
 * - Color-coded by assigned family member
 * - Priority indicators (high, medium, low)
 * - Due date display
 * - Quick add task button
 * - Filter by person
 *
 * INTERACTION:
 * - Tap checkbox to mark complete
 * - Tap task to see details (future)
 * - Swipe to delete (future)
 *
 * USAGE:
 *   <TasksWidget />
 *   <TasksWidget userId="user1" />
 *   <TasksWidget showCompleted={false} />
 *
 */

'use client';

import * as React from 'react';
import { useMemo, useCallback } from 'react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { CheckSquare, Plus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { Button, Checkbox, Badge, UserAvatar } from '@/components/ui';
import { compareTaskDue, dueLocalDate, isTaskOverdue } from '@/lib/utils/taskDue';


/**
 * TASK TYPE
 * Represents a single task item.
 */
// Task type imported from shared types
import type { Task } from '@/types';
import { useLocalDateKey } from '@/lib/hooks/useLocalDateKey';
export type { Task };


/**
 * TASKS WIDGET PROPS
 */
export interface TasksWidgetProps {
  /** Tasks to display (if provided externally) */
  tasks?: Task[];
  /** Filter tasks by user ID */
  userId?: string;
  /** Show completed tasks */
  showCompleted?: boolean;
  /** Maximum number of tasks to show */
  maxTasks?: number;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Callback when task is toggled */
  onTaskToggle?: (taskId: string, completed: boolean) => void;
  /** Callback when add button is clicked */
  onAddClick?: () => void;
  /** Callback when a task row is clicked (opens edit modal). */
  onTaskClick?: (task: Task) => void;
  /** URL for the full tasks page (makes title clickable) */
  titleHref?: string;
  /** Additional CSS classes */
  className?: string;
}


/**
 * TASKS WIDGET COMPONENT
 * Displays a list of tasks with completion checkboxes.
 *
 * @example Basic usage
 * <TasksWidget />
 *
 * @example Filter by user
 * <TasksWidget userId="user1" />
 *
 * @example With callbacks
 * <TasksWidget
 *   onTaskToggle={(id, done) => updateTask(id, done)}
 *   onAddClick={() => openAddTaskDialog()}
 * />
 */
export const TasksWidget = React.memo(function TasksWidget({
  tasks: externalTasks,
  userId,
  showCompleted = false,
  maxTasks = 8,
  loading = false,
  error = null,
  onTaskToggle,
  onAddClick,
  onTaskClick,
  titleHref,
  className,
}: TasksWidgetProps) {
  // Re-render at midnight so "Today" and "Tomorrow" move on with the date;
  // the item labels below are computed from the clock on each render.
  useLocalDateKey();
  const allTasks = externalTasks || [];

  const { filteredTasks, displayTasks } = useMemo(() => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    let filtered = allTasks;
    if (userId) filtered = filtered.filter((t) => t.assignedTo?.id === userId);
    if (!showCompleted) filtered = filtered.filter((t) => !t.completed);
    filtered = [...filtered].sort((a, b) => {
      const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (diff !== 0) return diff;
      if (a.dueDate && b.dueDate) return compareTaskDue(a, b);
      return 0;
    });
    return { filteredTasks: filtered, displayTasks: filtered.slice(0, maxTasks) };
  }, [allTasks, userId, showCompleted, maxTasks]);

  // Handle toggle - calls external handler which manages auth
  // No optimistic update since auth might be cancelled
  const handleToggle = useCallback((taskId: string, currentCompleted: boolean) => {
    const newCompleted = !currentCompleted;
    // Call external handler - it will handle auth and refresh
    onTaskToggle?.(taskId, newCompleted);
  }, [onTaskToggle]);

  return (
    <WidgetContainer
      title="Tasks"
      titleHref={titleHref}
      icon={<CheckSquare className="h-4 w-4" />}
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
            aria-label="Add task"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )
      }
      className={className}
    >
      {displayTasks.length === 0 ? (
        <WidgetEmpty
          icon={<CheckSquare className="h-8 w-8" />}
          message="No tasks for today"
          action={
            onAddClick && (
              <Button size="sm" variant="outline" onClick={onAddClick}>
                Add Task
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-auto h-full -mr-2 pr-2">
          <div className="space-y-2">
            {displayTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                completed={task.completed || false}
                onToggle={() => handleToggle(task.id, task.completed || false)}
                onClick={onTaskClick ? () => onTaskClick(task) : undefined}
              />
            ))}
          </div>

          {/* Show count of remaining tasks */}
          {filteredTasks.length > maxTasks && (
            <div className="mt-3 text-center text-xs text-muted-foreground">
              +{filteredTasks.length - maxTasks} more tasks
            </div>
          )}
        </div>
      )}
    </WidgetContainer>
  );
});


/**
 * TASK ITEM
 * A single task row with checkbox, title, and metadata.
 */
function TaskItem({
  task,
  completed,
  onToggle,
  onClick,
}: {
  task: Task;
  completed: boolean;
  onToggle: () => void;
  onClick?: () => void;
}) {
  // Format due date
  const dueDateDisplay = task.dueDate ? formatDueDate(dueLocalDate(task.dueDate)) : null;

  // Check if overdue
  const isOverdue = isTaskOverdue(task) && !completed;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2 rounded-lg',
        'hover:bg-accent/50 transition-colors',
        'touch-action-manipulation',
        completed && 'opacity-60'
      )}
    >
      {/* Checkbox — stops propagation so the row click doesn't open the
          edit modal when the user is just toggling completion. */}
      <Checkbox
        checked={completed}
        onCheckedChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5"
        style={
          task.assignedTo
            ? { borderColor: task.assignedTo.color }
            : undefined
        }
      />

      {/* Task content — clickable surface that opens the edit modal. */}
      <div
        className={cn('flex-1 min-w-0', onClick && 'cursor-pointer')}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      >
        <div className="flex items-center gap-2">
          {/* Title */}
          <span
            className={cn(
              'text-sm font-medium truncate',
              completed && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </span>

          {/* Priority badge */}
          {task.priority === 'high' && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              High
            </Badge>
          )}
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2 mt-0.5">
          {/* Assigned to */}
          {task.assignedTo && (
            <div className="flex items-center gap-1">
              <UserAvatar
                name={task.assignedTo.name}
                color={task.assignedTo.color}
                imageUrl={task.assignedTo.avatarUrl}
                size="sm"
                className="h-4 w-4 text-[8px]"
              />
              <span className="text-xs text-muted-foreground">
                {task.assignedTo.name}
              </span>
            </div>
          )}

          {/* Due date */}
          {dueDateDisplay && (
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
function formatDueDate(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isPast(date)) return format(date, 'MMM d'); // Overdue
  return format(date, 'EEE, MMM d'); // e.g., "Mon, Jan 21"
}


