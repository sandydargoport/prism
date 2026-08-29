'use client';

import { format, isPast, differenceInDays, formatDistanceToNow } from 'date-fns';
import { CalendarDays, Settings, Trash2 } from 'lucide-react';
import { UserAvatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Task } from '@/types';

export function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  showAvatar = false,
  showList = false,
  taskLists = [],
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  /** Omitted where a row is not deletable; the button is then not rendered. */
  onDelete?: () => void;
  showAvatar?: boolean;
  showList?: boolean;
  taskLists?: Array<{ id: string; name: string; color?: string | null }>;
}) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && !task.completed && isPast(dueDate);
  const daysUntil = dueDate ? differenceInDays(dueDate, new Date()) : null;
  const taskList = showList ? taskLists.find(l => l.id === (task as typeof task & { listId?: string }).listId) : null;

  return (
    <div
      className={cn(
        'p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors',
        task.completed ? 'opacity-60 bg-green-50/50 dark:bg-green-950/20 border-green-500/30' : '',
        isOverdue ? 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20' : !task.completed ? 'border-border' : ''
      )}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {showAvatar && task.assignedTo && (
            <UserAvatar name={task.assignedTo.name} color={task.assignedTo.color} size="sm" className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className={cn(
              'font-medium text-sm truncate',
              task.completed && 'line-through text-muted-foreground'
            )}>
              {task.title}
            </p>
            {(dueDate || taskList) && !task.completed && (
              <div className="flex items-center gap-2 mt-0.5">
                {dueDate && (
                  <div className={cn(
                    'flex items-center gap-1 text-xs',
                    isOverdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                  )}>
                    <CalendarDays className="h-3 w-3" />
                    {isOverdue ? (
                      <span>Due {formatDistanceToNow(dueDate, { addSuffix: true })}</span>
                    ) : daysUntil === 0 ? (
                      <span>Due today</span>
                    ) : daysUntil === 1 ? (
                      <span>Due tomorrow</span>
                    ) : (
                      <span>Due {format(dueDate, 'MMM d')}</span>
                    )}
                  </div>
                )}
                {taskList && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: taskList.color || '#6B7280' }} />
                    <span>{taskList.name}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.priority === 'high' && (
            <Badge variant="destructive" className="text-xs">!</Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label="Edit task"
          >
            <Settings className="h-3 w-3" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-50 hover:opacity-100 hover:text-destructive"
              onClick={(e) => {
                // The row itself toggles completion, so a delete tap must not
                // also mark the task done on its way out.
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Delete task"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
