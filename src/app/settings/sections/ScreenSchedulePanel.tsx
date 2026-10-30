'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_SCHEDULE_RULES, parseSchedule, serializeSchedule, type ScheduleRule } from '@/lib/displays/screenSchedule';

/**
 * A screen's time-of-day rules (#692), edited from any device: in these hours
 * on these days, show this dashboard. Saved as a whole with the Save button,
 * so a time half typed in is never sent.
 */

const DAYS = [
  { n: 0, short: 'S', name: 'Sunday' },
  { n: 1, short: 'M', name: 'Monday' },
  { n: 2, short: 'T', name: 'Tuesday' },
  { n: 3, short: 'W', name: 'Wednesday' },
  { n: 4, short: 'T', name: 'Thursday' },
  { n: 5, short: 'F', name: 'Friday' },
  { n: 6, short: 'S', name: 'Saturday' },
];

type Dashboard = { id: string; name: string };

export function ScreenSchedulePanel({
  name,
  stored,
  dashboards,
  homeId,
  online,
  save,
}: {
  name: string;
  /** The stored value of the schedule setting. */
  stored: string | undefined;
  dashboards: Dashboard[];
  /** The screen's own dashboard, shown outside every rule. */
  homeId: string;
  online: boolean;
  /** Stores the new value (null for no rules); false when that failed (the caller shows why). */
  save: (raw: string | null) => Promise<boolean>;
}) {
  const [rules, setRules] = useState<ScheduleRule[]>(() => parseSchedule(stored));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const home = dashboards.find((d) => d.id === homeId)?.name ?? 'its dashboard';
  const others = dashboards.filter((d) => d.id !== homeId);

  const change = (next: ScheduleRule[]) => {
    setRules(next);
    setSaved(false);
  };
  const edit = (i: number, patch: Partial<ScheduleRule>) =>
    change(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, by: number) => {
    const next = [...rules];
    const [rule] = next.splice(i, 1);
    next.splice(i + by, 0, rule!);
    change(next);
  };
  const add = () => change([
    ...rules,
    { days: [1, 2, 3, 4, 5], from: '07:00', to: '08:00', dashboardId: (others[0] ?? dashboards[0])!.id },
  ]);

  const noDays = rules.some((r) => r.days.length === 0);
  const submit = async () => {
    setSaving(true);
    const ok = await save(serializeSchedule(rules));
    setSaving(false);
    setSaved(ok);
  };

  return (
    <div className="basis-full space-y-3 rounded-md border border-border p-3" data-testid="screen-schedule">
      <p className="text-sm text-muted-foreground">
        Outside these times {name} shows {home}. When two overlap, the higher one wins. A change
        waits until nobody has touched the screen for a minute.
      </p>
      <ol className="space-y-3">
        {rules.map((r, i) => (
          <li key={i} className="space-y-2 rounded-md bg-muted/40 p-2" data-testid="schedule-rule">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Show</span>
              <select
                aria-label={`Dashboard for time ${i + 1}`}
                className="rounded-md border border-input bg-background px-2 py-1"
                value={r.dashboardId}
                onChange={(e) => edit(i, { dashboardId: e.target.value })}
              >
                {dashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <span>from</span>
              <input
                type="time"
                aria-label={`Start of time ${i + 1}`}
                className="rounded-md border border-input bg-background px-2 py-1"
                value={r.from}
                onChange={(e) => e.target.value && edit(i, { from: e.target.value })}
              />
              <span>to</span>
              <input
                type="time"
                aria-label={`End of time ${i + 1}`}
                className="rounded-md border border-input bg-background px-2 py-1"
                value={r.to}
                onChange={(e) => e.target.value && edit(i, { to: e.target.value })}
              />
              <span className="ml-auto flex gap-1">
                <Button size="icon" variant="ghost" aria-label={`Move time ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Move time ${i + 1} down`} disabled={i === rules.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Remove time ${i + 1}`} onClick={() => change(rules.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </span>
            </div>
            <div className="flex gap-1" role="group" aria-label={`Days for time ${i + 1}`}>
              {DAYS.map((d) => {
                const on = r.days.includes(d.n);
                return (
                  <button
                    key={d.n}
                    type="button"
                    aria-label={d.name}
                    aria-pressed={on}
                    className={`h-8 w-8 rounded-full text-xs font-medium ${on ? 'bg-primary text-primary-foreground' : 'border border-input text-muted-foreground'}`}
                    onClick={() => edit(i, { days: on ? r.days.filter((x) => x !== d.n) : [...r.days, d.n].sort() })}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={add} disabled={rules.length >= MAX_SCHEDULE_RULES || dashboards.length === 0}>
          Add a time
        </Button>
        <Button size="sm" onClick={() => void submit()} disabled={saving || noDays}>
          Save schedule
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {noDays
            ? 'Pick at least one day for each time.'
            : saved
              ? online ? `Saved. ${name} follows it within a minute.` : `Saved. ${name} follows it when it is next switched on.`
              : 'Times are in the household time zone.'}
        </span>
      </div>
    </div>
  );
}
