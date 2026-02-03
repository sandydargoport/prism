'use client';

import { isToday, isTomorrow, isPast, format } from 'date-fns';
import { AlertCircle, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import type { Task } from '@/types';

export function TaskItem({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isOverdue = task.dueDate && isPast(task.dueDate) && !task.completed;

  const formatDueDate = (date: Date | string) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg border border-border bg-card/85 backdrop-blur-sm',
        'hover:border-seasonal-accent hover:ring-2 hover:ring-seasonal-accent/50 transition-all',
        task.completed && 'opacity-60'
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={task.completed}
        onCheckedChange={onToggle}
        className="flex-shrink-0"
        style={task.assignedTo ? { borderColor: task.assignedTo.color } : undefined}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-medium',
              task.completed && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </span>

          {task.priority === 'high' && (
            <Badge variant="destructive" className="text-xs">
              High
            </Badge>
          )}

          {task.category && (
            <Badge variant="outline" className="text-xs">
              {task.category}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          {task.assignedTo && (
            <div className="flex items-center gap-1">
              <UserAvatar
                name={task.assignedTo.name}
                color={task.assignedTo.color}
                size="sm"
                className="h-4 w-4 text-[8px]"
              />
              <span>{task.assignedTo.name}</span>
            </div>
          )}

          {task.dueDate && (
            <span className={cn(isOverdue && 'text-destructive font-medium')}>
              {isOverdue && <AlertCircle className="h-3 w-3 inline mr-1" />}
              {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-8 w-8"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
