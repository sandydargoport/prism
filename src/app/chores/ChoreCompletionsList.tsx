'use client';

import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { History, CheckCircle2, ShieldCheck, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { getCategoryEmoji } from '@/app/chores/ChoreItem';
import type { ChoreCompletion } from './useChoresViewData';
import { cn } from '@/lib/utils';

interface ChoreCompletionsListProps {
  completions: ChoreCompletion[];
  completionsLoading: boolean;
  onUndo: (completionId: string, choreId: string) => void;
}

export function ChoreCompletionsList({
  completions,
  completionsLoading,
  onUndo,
}: ChoreCompletionsListProps) {
  return (
    // min-h-full + flex-col so the empty state (below) can center in the
    // space BELOW the heading, matching every other page's toolbar-then-
    // content layout — instead of sitting stuck right under the heading,
    // which is what a plain block flow (no stretch) previously did.
    <div className="max-w-4xl mx-auto space-y-3 min-h-full flex flex-col">
      <h2 className="text-lg font-semibold flex items-center gap-2 flex-shrink-0">
        <History className="h-5 w-5" />
        Recent Completions (Last 14 Days)
      </h2>
      {completionsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : completions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState icon={<CheckCircle2 />} title="No completed chores in the last 14 days." />
        </div>
      ) : (
        <div className="space-y-2">
          {completions.map((c) => (
            <div
              key={c.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border bg-card/85 backdrop-blur-sm',
                c.approvedBy
                  ? 'border-border'
                  : 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/30'
              )}
            >
              <span className="text-lg shrink-0">{getCategoryEmoji(c.choreCategory)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{c.choreTitle}</span>
                  {c.pointsAwarded > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      +{c.pointsAwarded} pts
                    </Badge>
                  )}
                  {c.approvedBy ? (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                      <ShieldCheck className="h-3 w-3 mr-0.5" />Approved
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-xs bg-amber-500 hover:bg-amber-500">
                      Pending Approval
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <UserAvatar
                      name={c.completedBy.name}
                      color={c.completedBy.color}
                      size="sm"
                      className="h-4 w-4 text-[8px]"
                    />
                    <span>{c.completedBy.name}</span>
                  </div>
                  {c.approvedBy && (
                    <div className="flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-green-500" />
                      <span>{c.approvedBy.name}</span>
                    </div>
                  )}
                  <span title={format(parseISO(c.completedAt), 'PPpp')}>
                    {formatDistanceToNow(parseISO(c.completedAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onUndo(c.id, c.choreId)}
                title="Undo completion and reverse points"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
