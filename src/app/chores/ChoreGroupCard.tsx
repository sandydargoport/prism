'use client';

import { format } from 'date-fns';
import { isPast, differenceInDays, formatDistanceToNow } from 'date-fns';
import {
  CalendarDays,
  Hourglass,
  Settings,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PendingApproval {
  completionId: string;
  completedBy: { id: string; name: string; color: string };
}

export interface ChoreCardData {
  id: string;
  title: string;
  pointValue: number;
  nextDue?: string | null;
  lastCompleted?: string | null;
  pendingApproval?: PendingApproval | null;
}

interface ChoreGroupCardProps {
  chore: ChoreCardData;
  assignedUser: { id: string; name: string } | null;
  allChores: ChoreCardData[];
  onComplete: () => Promise<boolean>;
  onEdit: () => void;
  onDelete: () => void;
  setCelebratingUser: (user: { id: string; name: string } | null) => void;
}

export function ChoreGroupCard({
  chore,
  assignedUser,
  allChores,
  onComplete,
  onEdit,
  onDelete,
  setCelebratingUser,
}: ChoreGroupCardProps) {
  const nextDue = chore.nextDue ? new Date(chore.nextDue) : null;
  const isOverdue = nextDue && isPast(nextDue);
  const daysUntil = nextDue ? differenceInDays(nextDue, new Date()) : null;
  const isCompletedToday =
    chore.lastCompleted &&
    new Date(chore.lastCompleted) > new Date(Date.now() - 24 * 60 * 60 * 1000);
  const isPendingApproval = !!chore.pendingApproval;

  return (
    <div
      className={cn(
        'p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors group',
        isPendingApproval
          ? 'bg-warning/10 border-warning/50'
          : isCompletedToday
          ? 'opacity-60 bg-success/10 border-success/30'
          : isOverdue
          ? 'border-destructive/50 bg-destructive/10'
          : 'border-border'
      )}
      onClick={async () => {
        const success = await onComplete();
        if (success && assignedUser) {
          const otherChores = allChores.filter((c) => c.id !== chore.id);
          const allOthersCompleted = otherChores.every(
            (c) =>
              c.lastCompleted &&
              new Date(c.lastCompleted) > new Date(Date.now() - 24 * 60 * 60 * 1000)
          );
          if (allOthersCompleted && !isCompletedToday) {
            setCelebratingUser({ id: assignedUser.id, name: assignedUser.name });
          }
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isPendingApproval && (
              <Hourglass className="h-3.5 w-3.5 text-warning shrink-0" />
            )}
            <p
              className={cn(
                'font-medium text-sm truncate',
                isCompletedToday && !isPendingApproval && 'line-through',
                isPendingApproval && 'text-warning'
              )}
            >
              {chore.title}
            </p>
          </div>
          {isPendingApproval && chore.pendingApproval && (
            <div className="flex items-center gap-1 text-xs mt-0.5 text-warning">
              <span>Awaiting approval</span>
              <span className="text-muted-foreground">
                &middot; {chore.pendingApproval.completedBy.name}
              </span>
            </div>
          )}
          {!isPendingApproval && nextDue && !isCompletedToday && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs mt-0.5',
                isOverdue ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {isOverdue ? (
                <span>Due {formatDistanceToNow(nextDue, { addSuffix: true })}</span>
              ) : daysUntil === 0 ? (
                <span>Due today</span>
              ) : daysUntil === 1 ? (
                <span>Due tomorrow</span>
              ) : (
                <span>Due {format(nextDue, 'MMM d')}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isPendingApproval && (
            <Badge
              variant="default"
              className="text-[10px] bg-warning hover:bg-warning px-1.5 py-0"
            >
              Pending
            </Badge>
          )}
          {chore.pointValue > 0 && (
            <Badge variant="secondary" className="text-xs">
              {chore.pointValue} pts
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Settings className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
