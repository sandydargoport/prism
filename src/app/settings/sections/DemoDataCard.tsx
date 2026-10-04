'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eraser, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { toast } from '@/components/ui/use-toast';

type Summary = {
  present: boolean;
  members: string[];
  counts: Record<string, number>;
  connected: { calendars: number; events: number };
};

const TABLE_LABELS: Record<string, string> = {
  users: 'family members',
  tasks: 'tasks',
  family_messages: 'messages',
  events: 'events',
  chores: 'chores',
  shopping_lists: 'shopping lists',
  shopping_items: 'shopping items',
  meals: 'meals',
  maintenance_reminders: 'maintenance reminders',
  birthdays: 'birthdays',
  goals: 'goals',
  settings: 'settings',
};

function describeCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([table, n]) => {
      const label = TABLE_LABELS[table] ?? table;
      return `${n} ${n === 1 ? label.replace(/s$/, '') : label}`;
    })
    .join(', ');
}

/**
 * Purge the sample family that the database init seed added to new Docker
 * installs before #605. Renders nothing unless seeded rows are still present.
 */
export function DemoDataCard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [purging, setPurging] = useState(false);
  const { confirm, dialogProps } = useConfirmDialog();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/demo-data');
        if (!res.ok) return;
        const data = (await res.json()) as Summary;
        if (!cancelled) setSummary(data);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePurge = useCallback(async () => {
    if (!summary) return;
    const members = summary.members.length > 0 ? `Members removed: ${summary.members.join(', ')}. ` : '';
    const { calendars, events } = summary.connected;
    const connected = calendars > 0
      ? ` That includes ${calendars} calendar${calendars === 1 ? '' : 's'} connected under those members, with ${events} event${events === 1 ? '' : 's'}.`
      : '';
    const ok = await confirm(
      'Purge all demo data?',
      `${members}Deletes ${describeCounts(summary.counts)}, and everything attached to them.${connected} Everything else is kept. This cannot be undone.`,
      { confirmLabel: 'Purge' },
    );
    if (!ok) return;
    setPurging(true);
    try {
      const res = await fetch('/api/admin/demo-data', { method: 'DELETE' });
      if (!res.ok) {
        toast({ title: 'Failed to purge demo data', variant: 'destructive' });
        return;
      }
      // A purged member may be the one signed in, and every view holds
      // demo rows, so start over from a fresh load.
      window.location.reload();
    } catch {
      toast({ title: 'Failed to purge demo data', variant: 'destructive' });
    } finally {
      setPurging(false);
    }
  }, [summary, confirm]);

  if (!summary?.present) return null;

  return (
    <div className="border border-warning/40 rounded-lg p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h4 className="font-semibold flex items-center gap-2">
            <Eraser className="h-4 w-4 text-warning" />
            Demo data
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            This install still has the sample family it was created with
            {summary.members.length > 0 ? ` (${summary.members.join(', ')})` : ''}: {describeCounts(summary.counts)}.
            Purging deletes all of it and keeps everything else.
            {summary.connected.calendars > 0 && (
              <> It also removes the {summary.connected.calendars} calendar{summary.connected.calendars === 1 ? '' : 's'} connected under those members.</>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={handlePurge} disabled={purging}>
          {purging ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Purging...</> : 'Purge demo data'}
        </Button>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
