'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, ArrowRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { PendingDeletion } from '@/lib/hooks/usePendingDeletions';

/**
 * Deletes-only review (#171 Stage 3). Lists events the sync found removed from
 * their source and held instead of deleting. The user Deletes (remove from
 * Prism too) or Keeps (retain as a local event) the selected ones.
 */
export function PendingDeletionsModal({
  pending,
  onApply,
  onClose,
}: {
  pending: PendingDeletion[];
  onApply: (eventIds: string[], action: 'delete' | 'keep') => Promise<boolean>;
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
    const ok = await onApply(bulk, action);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Review removals
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            These events were removed from their source calendar and held for review.{' '}
            <span className="font-medium text-foreground">Delete</span> removes them from Prism too.{' '}
            <span className="font-medium text-foreground">Keep</span> transfers each one to your{' '}
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Home className="h-3 w-3" />local calendar
            </span>{' '}
            — it stops syncing and stays put.
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

          <ScrollArea className="max-h-[45vh] pr-3">
            <div className="space-y-1">
              {pending.map((p) => (
                <label
                  key={p.id}
                  className="flex items-start gap-2 rounded px-1 py-1 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} className="mt-0.5" />
                  <span className="text-sm flex-1 min-w-0">
                    <span className="font-medium">{p.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {p.allDay
                        ? format(parseISO(p.startTime), 'EEE, MMM d')
                        : format(parseISO(p.startTime), 'EEE, MMM d · p')}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: p.color || 'var(--muted-foreground)' }}
                        />
                        <span className="truncate">{p.sourceCalendar}</span>
                      </span>
                      <ArrowRight className="h-3 w-3 opacity-60 shrink-0" />
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <Home className="h-3 w-3" />Local (if kept)
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => act('keep')} disabled={busy || selected.size === 0}>
            <Home className="h-4 w-4 mr-1.5" />
            Keep {selected.size} in Local
          </Button>
          <Button variant="destructive" onClick={() => act('delete')} disabled={busy || selected.size === 0}>
            Delete {selected.size}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
