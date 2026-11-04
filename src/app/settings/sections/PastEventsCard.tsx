'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { usePastEventsMode } from '@/lib/hooks/usePastEventsMode';

export function PastEventsCard() {
  const { mode, loaded, setMode } = usePastEventsMode();

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Past Events</CardTitle>
        <CardDescription>
          Events that have ended are dimmed in every view. Hiding them clears them out of the
          agenda and list views, so a short agenda shows what is still to come. Day, week and
          month grids keep them dimmed, so a past day never looks empty.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <span id="hide-ended-events" className="text-sm font-medium">
            Hide ended events in the agenda and list
          </span>
          <Switch
            aria-labelledby="hide-ended-events"
            checked={mode === 'hide'}
            onCheckedChange={(on) => setMode(on ? 'hide' : 'dim')}
            className="data-[state=checked]:bg-blue-500"
          />
        </div>
      </CardContent>
    </Card>
  );
}
