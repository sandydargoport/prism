'use client';

import { useMemo, useState } from 'react';
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
import { AlertTriangle, Plus, RefreshCw, Trash2 } from 'lucide-react';

/**
 * Generic review-and-approve modal for the sync framework. Entity-agnostic:
 * it renders any diff (adds / updates / deletes) with per-change checkboxes and
 * hands back the user's selection. Reused across recipes, tasks, shopping, etc.
 */

export interface SyncReviewChange {
  kind: 'add' | 'update' | 'delete';
  externalId: string;
  label: string;
  reason: string;
  defaultChecked: boolean;
}

export interface SyncReviewModalProps {
  title?: string;
  /** Plural entity noun for copy, e.g. "recipes". */
  entityLabel?: string;
  changes: SyncReviewChange[];
  counts: { add: number; update: number; delete: number };
  massDeleteGuardTripped?: boolean;
  withheldDeletes?: number;
  /** Optional informational notes (e.g. side-effects) shown above the list. */
  notes?: string[];
  applying?: boolean;
  onApply: (selected: Array<{ kind: string; externalId: string }>) => void;
  onClose: () => void;
}

const KIND_META = {
  add: { label: 'New', icon: Plus, cls: 'text-green-600 dark:text-green-400' },
  update: { label: 'Changed', icon: RefreshCw, cls: 'text-blue-600 dark:text-blue-400' },
  delete: { label: 'Removed in source', icon: Trash2, cls: 'text-destructive' },
} as const;

const keyOf = (c: SyncReviewChange) => `${c.kind}:${c.externalId}`;

export function SyncReviewModal({
  title = 'Review changes',
  entityLabel = 'items',
  changes,
  counts,
  massDeleteGuardTripped,
  withheldDeletes = 0,
  notes = [],
  applying,
  onApply,
  onClose,
}: SyncReviewModalProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(changes.filter((c) => c.defaultChecked).map(keyOf)),
  );

  const toggle = (c: SyncReviewChange) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = keyOf(c);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const grouped = useMemo(
    () => ({
      add: changes.filter((c) => c.kind === 'add'),
      update: changes.filter((c) => c.kind === 'update'),
      delete: changes.filter((c) => c.kind === 'delete'),
    }),
    [changes],
  );

  const nothing = changes.length === 0;
  const selectedList = Array.from(selected).map((k) => {
    const idx = k.indexOf(':');
    return { kind: k.slice(0, idx), externalId: k.slice(idx + 1) };
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {nothing ? (
            <p className="text-sm text-muted-foreground">
              Everything is up to date — no changes to review.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {counts.add} new · {counts.update} changed · {counts.delete} removed. Adds and
              updates are pre-selected; removals are opt-in.
            </p>
          )}

          {notes.length > 0 && !nothing && (
            <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300">
              {notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </div>
          )}

          {massDeleteGuardTripped && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                {withheldDeletes} {entityLabel} look deleted in the source — held back as a safety
                check so a source glitch can&apos;t wipe your data. Re-run the sync if that was
                intentional.
              </span>
            </div>
          )}

          {!nothing && (
            <ScrollArea className="max-h-[50vh] pr-3">
              <div className="space-y-3">
                {(['add', 'update', 'delete'] as const).map(
                  (kind) =>
                    grouped[kind].length > 0 && (
                      <div key={kind} className="space-y-1">
                        <div
                          className={`flex items-center gap-1.5 text-xs font-medium ${KIND_META[kind].cls}`}
                        >
                          {(() => {
                            const Icon = KIND_META[kind].icon;
                            return <Icon className="h-3.5 w-3.5" />;
                          })()}
                          {KIND_META[kind].label} ({grouped[kind].length})
                        </div>
                        {grouped[kind].map((c) => (
                          <label
                            key={keyOf(c)}
                            className="flex items-start gap-2 rounded px-1 py-1 hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={selected.has(keyOf(c))}
                              onCheckedChange={() => toggle(c)}
                              className="mt-0.5"
                            />
                            <span className="text-sm">
                              <span className="font-medium">{c.label}</span>
                              <span className="block text-xs text-muted-foreground">{c.reason}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    ),
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {nothing ? 'Close' : 'Cancel'}
          </Button>
          {!nothing && (
            <Button onClick={() => onApply(selectedList)} disabled={applying || selected.size === 0}>
              {applying ? 'Applying…' : `Apply ${selected.size} selected`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
