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
import { AlertTriangle, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';

/**
 * Generic review-and-approve modal for the sync framework. Entity-agnostic:
 * it renders any diff (adds / updates / deletes) with per-change checkboxes and
 * hands back the user's selection. Reused across recipes, tasks, shopping, etc.
 */

export type SyncReviewKind = 'add' | 'update' | 'delete' | 'push-add' | 'push-update' | 'push-delete';

export interface SyncReviewChange {
  kind: SyncReviewKind;
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
  /** Changes made in Prism to send to the source (#1206). */
  pushCounts?: { add: number; update: number; delete: number };
  /** The source's name for the send groups, e.g. "Tandoor". */
  remoteName?: string;
  massDeleteGuardTripped?: boolean;
  withheldDeletes?: number;
  pushDeleteGuardTripped?: boolean;
  withheldPushDeletes?: number;
  /** Optional informational notes (e.g. side-effects) shown above the list. */
  notes?: string[];
  applying?: boolean;
  onApply: (selected: Array<{ kind: string; externalId: string }>) => void;
  onClose: () => void;
}

const KIND_META = (remote: string) => ({
  add: { label: 'New', icon: Plus, cls: 'text-success' },
  update: { label: 'Changed', icon: RefreshCw, cls: 'text-blue-600 dark:text-blue-400' },
  delete: { label: 'Removed in source', icon: Trash2, cls: 'text-destructive' },
  'push-add': { label: `Add to ${remote}`, icon: Upload, cls: 'text-success' },
  'push-update': { label: `Change in ${remote}`, icon: Upload, cls: 'text-blue-600 dark:text-blue-400' },
  'push-delete': { label: `Remove from ${remote}`, icon: Upload, cls: 'text-destructive' },
}) as const;

const ORDER: SyncReviewKind[] = ['add', 'update', 'delete', 'push-add', 'push-update', 'push-delete'];

const keyOf = (c: SyncReviewChange) => `${c.kind}:${c.externalId}`;

export function SyncReviewModal({
  title = 'Review changes',
  entityLabel = 'items',
  changes,
  counts,
  pushCounts,
  remoteName = 'the source',
  massDeleteGuardTripped,
  withheldDeletes = 0,
  pushDeleteGuardTripped,
  withheldPushDeletes = 0,
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

  const meta = KIND_META(remoteName);
  const grouped = useMemo(
    () => Object.fromEntries(ORDER.map((k) => [k, changes.filter((c) => c.kind === k)])) as Record<SyncReviewKind, SyncReviewChange[]>,
    [changes],
  );
  const toSend = pushCounts ? pushCounts.add + pushCounts.update + pushCounts.delete : 0;

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
              {counts.add} new · {counts.update} changed · {counts.delete} removed
              {toSend > 0 && <> · {toSend} to send to {remoteName}</>}. Adds and updates are
              pre-selected; removals are opt-in. Nothing is sent to {remoteName} unless it is ticked.
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
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
              <span>
                {withheldDeletes} {entityLabel} look deleted in the source — held back as a safety
                check so a source glitch can&apos;t wipe your data. Re-run the sync if that was
                intentional.
              </span>
            </div>
          )}

          {pushDeleteGuardTripped && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
              <span>
                {withheldPushDeletes} {entityLabel} look removed in Prism. Removing that many from{' '}
                {remoteName} at once is held back, so a slip in Prism can&apos;t empty it. Remove
                them in {remoteName} itself if that was meant.
              </span>
            </div>
          )}

          {!nothing && (
            <ScrollArea className="max-h-[50vh] pr-3">
              <div className="space-y-3">
                {ORDER.map(
                  (kind) =>
                    grouped[kind].length > 0 && (
                      <div key={kind} className="space-y-1" data-review-group={kind}>
                        <div
                          className={`flex items-center gap-1.5 text-xs font-medium ${meta[kind].cls}`}
                        >
                          {(() => {
                            const Icon = meta[kind].icon;
                            return <Icon className="h-3.5 w-3.5" />;
                          })()}
                          {meta[kind].label} ({grouped[kind].length})
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
