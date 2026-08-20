'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export interface RemovedItem {
  id: string;
  name: string;
}

/**
 * Reusable "Removed items → Restore" card. Presentational only — the parent owns
 * fetching and the restore action — so any sub-page (calendars now; photos or
 * events later) can drop it in with its own { id, name }[] list and restore
 * handler. Renders nothing when there's nothing to show, so it can sit
 * unconditionally in a settings page and only appear when relevant.
 */
export function RemovedItemsManager({
  title,
  description,
  items,
  onRestore,
  restoringId,
}: {
  title: string;
  description?: string;
  items: RemovedItem[];
  onRestore: (id: string) => void;
  restoringId?: string | null;
}) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 list-none m-0 p-0">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2"
            >
              <span className="text-sm truncate">{item.name}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={restoringId === item.id}
                onClick={() => onRestore(item.id)}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                {restoringId === item.id ? 'Restoring…' : 'Restore'}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
