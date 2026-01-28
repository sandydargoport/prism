/**
 * ============================================================================
 * PRISM - Tasks Widget
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
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
 *   <TasksWidget userId="alex" />
 *   <TasksWidget showCompleted={false} />
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { CheckSquare, Plus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { Button, Checkbox, Badge, ScrollArea, UserAvatar } from '@/components/ui';


/**
 * TASK TYPE
 * ============================================================================
 * Represents a single task item.
 * ============================================================================
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  assignedTo?: {
    id: string;
    name: string;
    color: string;
    avatarUrl?: string;
  };
  category?: string;
}


/**
 * TASKS WIDGET PROPS
 * ============================================================================
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
  /** URL for the full tasks page (makes title clickable) */
  titleHref?: string;
  /** Additional CSS classes */
  className?: string;
}


/**
 * TASKS WIDGET COMPONENT
 * ============================================================================
 * Displays a list of tasks with completion checkboxes.
 *
 * @example Basic usage
 * <TasksWidget />
 *
 * @example Filter by user
 * <TasksWidget userId="alex" />
 *
 * @example With callbacks
 * <TasksWidget
 *   onTaskToggle={(id, done) => updateTask(id, done)}
 *   onAddClick={() => openAddTaskDialog()}
 * />
 * ============================================================================
 */
export function TasksWidget({
  tasks: externalTasks,
  userId,
  showCompleted = false,
  maxTasks = 8,
  loading = false,
  error = null,
  onTaskToggle,
  onAddClick,
  titleHref,
  className,
}: TasksWidgetProps) {
  // Use provided tasks or demo data
  // Use provided tasks (no demo data fallback in production)
  const allTasks = externalTasks || [];

  // Filter tasks
  let filteredTasks = allTasks;

  // Filter by user if specified
  if (userId) {
    filteredTasks = filteredTasks.filter(
      (task) => task.assignedTo?.id === userId
    );
  }

  // Filter out completed tasks if not showing them
  if (!showCompleted) {
    filteredTasks = filteredTasks.filter((task) => !task.completed);
  }

  // Sort by priority and due date
  filteredTasks = filteredTasks.sort((a, b) => {
    // Priority order: high > medium > low
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by due date (earlier first)
    if (a.dueDate && b.dueDate) {
      return a.dueDate.getTime() - b.dueDate.getTime();
    }
    return 0;
  });

  // Limit number of tasks
  const displayTasks = filteredTasks.slice(0, maxTasks);

  // Handle toggle - calls external handler which manages auth
  // No optimistic update since auth might be cancelled
  const handleToggle = (taskId: string, currentCompleted: boolean) => {
    const newCompleted = !currentCompleted;
    // Call external handler - it will handle auth and refresh
    onTaskToggle?.(taskId, newCompleted);
  };

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
        <ScrollArea className="h-full -mr-2 pr-2">
          <div className="space-y-2">
            {displayTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                completed={task.completed || false}
                onToggle={() => handleToggle(task.id, task.completed || false)}
              />
            ))}
          </div>

          {/* Show count of remaining tasks */}
          {filteredTasks.length > maxTasks && (
            <div className="mt-3 text-center text-xs text-muted-foreground">
              +{filteredTasks.length - maxTasks} more tasks
            </div>
          )}
        </ScrollArea>
      )}
    </WidgetContainer>
  );
}


/**
 * TASK ITEM
 * ============================================================================
 * A single task row with checkbox, title, and metadata.
 * ============================================================================
 */
function TaskItem({
  task,
  completed,
  onToggle,
}: {
  task: Task;
  completed: boolean;
  onToggle: () => void;
}) {
  // Format due date
  const dueDateDisplay = task.dueDate ? formatDueDate(task.dueDate) : null;

  // Check if overdue
  const isOverdue = task.dueDate && isPast(task.dueDate) && !completed;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2 rounded-lg',
        'hover:bg-accent/50 transition-colors',
        'touch-action-manipulation',
        completed && 'opacity-60'
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={completed}
        onCheckedChange={onToggle}
        className="mt-0.5"
        style={
          task.assignedTo
            ? { borderColor: task.assignedTo.color }
            : undefined
        }
      />

      {/* Task content */}
      <div className="flex-1 min-w-0">
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
 * ============================================================================
 * Formats a due date in a human-friendly way.
 * ============================================================================
 */
function formatDueDate(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isPast(date)) return format(date, 'MMM d'); // Overdue
  return format(date, 'EEE, MMM d'); // e.g., "Mon, Jan 21"
}


