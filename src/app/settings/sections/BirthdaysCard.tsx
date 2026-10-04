'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { RemovedItemsManager, type RemovedItem } from '@/components/settings/RemovedItemsManager';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { toast } from '@/components/ui/use-toast';

type BirthdayRow = {
  id: string;
  name: string;
  birthDate: string;
  eventType: string;
};

type DismissedRow = {
  id: string;
  name: string;
  month: number;
  day: number;
  eventType: string;
};

const TYPE_LABELS: Record<string, string> = {
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  milestone: 'Milestone',
};

function monthDay(month: number, day: number): string {
  return new Date(2000, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Tombstones keep only the normalised (lowercased) name, so capitalise it back
// for display.
function titleCase(name: string): string {
  return name.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

async function fetchLists(): Promise<{ birthdays?: BirthdayRow[]; dismissed?: DismissedRow[] }> {
  try {
    const [listRes, dismissedRes] = await Promise.all([
      fetch('/api/birthdays'),
      fetch('/api/birthdays/dismissed'),
    ]);
    return {
      birthdays: listRes.ok ? (await listRes.json()).birthdays || [] : undefined,
      dismissed: dismissedRes.ok ? (await dismissedRes.json()).dismissed || [] : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Birthdays, anniversaries and milestones (#605). Most arrive from calendar or
 * contact sync, so removing one here also records a tombstone that stops the
 * next sync re-adding it; the Removed list undoes that.
 */
export function BirthdaysCard() {
  const [birthdays, setBirthdays] = useState<BirthdayRow[]>([]);
  const [dismissed, setDismissed] = useState<DismissedRow[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const load = useCallback(async () => {
    const lists = await fetchLists();
    if (lists.birthdays) setBirthdays(lists.birthdays);
    if (lists.dismissed) setDismissed(lists.dismissed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lists = await fetchLists();
      if (cancelled) return;
      if (lists.birthdays) setBirthdays(lists.birthdays);
      if (lists.dismissed) setDismissed(lists.dismissed);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRemove = useCallback(async (row: BirthdayRow) => {
    const ok = await confirm(
      `Remove ${row.name}?`,
      'It disappears from Prism, and calendar or contact sync will not add it back. You can restore it below.',
      { confirmLabel: 'Remove' },
    );
    if (!ok) return;
    setRemovingId(row.id);
    try {
      const res = await fetch(`/api/birthdays/${row.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast({ title: 'Failed to remove', variant: 'destructive' });
        return;
      }
      await load();
    } catch {
      toast({ title: 'Failed to remove', variant: 'destructive' });
    } finally {
      setRemovingId(null);
    }
  }, [confirm, load]);

  const handleRestore = useCallback(async (id: string) => {
    setRestoringId(id);
    try {
      const res = await fetch(`/api/birthdays/dismissed/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast({ title: 'Failed to restore', variant: 'destructive' });
        return;
      }
      await load();
    } catch {
      toast({ title: 'Failed to restore', variant: 'destructive' });
    } finally {
      setRestoringId(null);
    }
  }, [load]);

  const removedItems: RemovedItem[] = dismissed.map((d) => ({
    id: d.id,
    name: [titleCase(d.name), monthDay(d.month, d.day), TYPE_LABELS[d.eventType]].filter(Boolean).join(' · '),
  }));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Birthdays &amp; milestones</CardTitle>
          <CardDescription>
            Found in your calendars and contacts. Remove one to stop Prism showing it; the calendar or contact itself is not changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {birthdays.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-2 list-none m-0 p-0">
              {birthdays.map((b) => {
                const [, mo, dy] = b.birthDate.split('-');
                return (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2"
                  >
                    <span className="text-sm truncate min-w-0 flex-1">
                      {[b.name, monthDay(Number(mo), Number(dy)), TYPE_LABELS[b.eventType]].filter(Boolean).join(' · ')}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={removingId === b.id}
                      onClick={() => handleRemove(b)}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      {removingId === b.id ? 'Removing…' : 'Remove'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <RemovedItemsManager
        title="Removed birthdays"
        description="Removed in Prism. Restore one to let sync add it again; it comes back if it is still in a calendar or contact."
        items={removedItems}
        onRestore={handleRestore}
        restoringId={restoringId}
      />

      <ConfirmDialog {...dialogProps} />
    </>
  );
}
