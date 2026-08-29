'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, ArrowRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import type { PendingTaskDeletion, ApplyResult } from '@/lib/hooks/usePendingTaskDeletions';

/**
 * Deletes-only review for task sync. Lists tasks the provider stopped
 * returning, held rather than deleted. The user Deletes them or Keeps them as
 * local tasks.
 *
 * Matches the calendar review modal, since the decision is the same one.
 */
export function PendingTaskDeletionsModal({
  pending,
  onApply,
  onClose,
}: {
  pending: PendingTaskDeletion[];
  onApply: (taskIds: string[], action: 'delete' | 'keep') => Promise<ApplyResult>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pending.map((p) => p.id)));
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = selected.size === pending.length && pending.length > 0;
  const bulk = useMemo(() => Array.from(selected), [selected]);

  const act = async (action: 'delete' | 'keep') => {
    if (bulk.length === 0) return;
    setBusy(true);
    const result = await onApply(bulk, action);
    setBusy(false);
    if (result.ok) {
      onClose();
      return;
    }
    // Stay open and say why. Closing on failure, or closing silently, would
    // leave the user thinking it worked.
    toast({ title: 'Nothing was changed', description: result.reason, variant: 'destructive' });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Review removals
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1 flex-1 min-h-0 flex flex-col">
          <p className="text-sm text-muted-foreground">
            These tasks were removed from the app they sync with, and held for review.{' '}
            <span className="font-medium text-foreground">Delete</span> removes them from Prism too.{' '}
            <span className="font-medium text-foreground">Keep</span> turns each one into a{' '}
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Home className="h-3 w-3" />local task
            </span>{' '}
            — it stops syncing and will not be added back to the other app.
          </p>

          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={() =>
                setSelected(allSelected ? new Set() : new Set(pending.map((p) => p.id)))
              }
            />
            Select all ({selected.size}/{pending.length})
          </label>

          {/* Native scroll, matching the calendar modal: drag-scrolls on touch
              wall displays and cannot clip a long list. */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-3 -mr-1">
            <div className="space-y-1">
              {pending.map((p) => (
                <label
                  key={p.id}
                  className="flex items-start gap-2 rounded px-1 py-1 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} className="mt-0.5" />
                  <span className="text-sm flex-1 min-w-0">
                    <span className={`font-medium ${p.completed ? 'line-through opacity-70' : ''}`}>
                      {p.title}
                    </span>
                    {p.dueDate && (
                      <span className="block text-xs text-muted-foreground">
                        Due {format(parseISO(p.dueDate), 'EEE, MMM d')}
                      </span>
                    )}
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                      <span className="truncate min-w-0">{p.source}</span>
                      <ArrowRight className="h-3 w-3 opacity-60 shrink-0" />
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <Home className="h-3 w-3" />Local (if kept)
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => act('keep')} disabled={busy || selected.size === 0}>
            <Home className="h-4 w-4 mr-1.5" />
            Keep {selected.size} in Prism
          </Button>
          <Button variant="destructive" onClick={() => act('delete')} disabled={busy || selected.size === 0}>
            Delete {selected.size}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
