'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { RemovedItemsManager, type RemovedItem } from '@/components/settings/RemovedItemsManager';
import { useTimeFormat } from '@/components/providers';
import { eventStartDisplayDate } from '@/lib/utils/timeFormat';
import { toast } from '@/components/ui/use-toast';

type HiddenEvent = {
  id: string;
  title: string;
  startTime: string;
  allDay: boolean;
  calendarName: string | null;
};

/**
 * Events hidden in Prism (#592). A hidden event no longer appears anywhere it
 * could be clicked, so this list is the only way to show one again. Renders
 * nothing while the list is empty.
 */
export function HiddenEventsCard() {
  const { displayTimezone } = useTimeFormat();
  const [hidden, setHidden] = useState<HiddenEvent[]>([]);
  const [unhidingId, setUnhidingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/events/hidden');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setHidden(data.hidden || []);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleUnhide = useCallback(async (id: string) => {
    setUnhidingId(id);
    try {
      const res = await fetch(`/api/events/${id}/hidden`, { method: 'DELETE' });
      if (res.ok) {
        setHidden((prev) => prev.filter((e) => e.id !== id));
      } else {
        toast({ title: 'Failed to unhide event', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to unhide event', variant: 'destructive' });
    } finally {
      setUnhidingId(null);
    }
  }, []);

  const items: RemovedItem[] = hidden.map((e) => {
    const date = format(eventStartDisplayDate(new Date(e.startTime), e.allDay, displayTimezone), 'EEE, MMM d, yyyy');
    return { id: e.id, name: [e.title, date, e.calendarName].filter(Boolean).join(' · ') };
  });

  return (
    <RemovedItemsManager
      title="Hidden events"
      description="Events hidden in Prism. They are still in their source calendar; unhide one to show it again."
      items={items}
      onRestore={handleUnhide}
      restoringId={unhidingId}
      restoreLabel="Unhide"
      restoringLabel="Unhiding…"
    />
  );
}
