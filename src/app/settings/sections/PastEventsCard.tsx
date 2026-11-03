'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { usePastEventsMode } from '@/lib/hooks/usePastEventsMode';
import { isPastEventsMode } from '@/lib/utils/pastEvents';

export function PastEventsCard() {
  const { mode, loaded, setMode } = usePastEventsMode();

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Past Events</CardTitle>
        <CardDescription>
          What the calendar does with events that have already ended. Dimmed fades them in the
          agenda as the other views already do. Hidden removes them from the agenda and list views,
          so they show only what is still to come. Day, week and month grids always dim them, so a
          past day never looks empty.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="text-sm text-muted-foreground">Ended events</span>
          <select
            value={mode}
            onChange={(e) => {
              if (isPastEventsMode(e.target.value)) setMode(e.target.value);
            }}
            className="min-h-11 border border-border rounded px-2 py-1 text-sm bg-background"
          >
            <option value="show">Shown</option>
            <option value="dim">Dimmed</option>
            <option value="hide">Hidden in agenda and list</option>
          </select>
        </label>
      </CardContent>
    </Card>
  );
}
