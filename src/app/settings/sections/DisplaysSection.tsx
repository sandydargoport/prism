'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistance } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useFetchOnMount } from '@/lib/hooks/useFetchOnMount';
import { useLayouts } from '@/lib/hooks/useLayouts';
import type { ScreenSettings } from '@/lib/displays/screenSettings';
import { screenRowSentence } from '@/lib/displays/screenRowSentence';
import { useUrlParam } from '@/lib/hooks/useUrlParam';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { formatTimeOfDay } from '@/components/calendar/cells/itemTime';
import { screenEditLink } from '@/lib/displays/editPlace';
import type { ScreenSwitch } from '@/lib/screenSwitches';
import type { IdleSource } from '@/lib/idleBackground';
import {
  DEFAULT_SCREEN_DAY,
  HOUSEHOLD_DAY_SETTING,
  NIGHT_LEVELS,
  parseHouseholdDay,
  type NightLevel,
  type ScreenDay,
} from '@/lib/screenDay';
import { useBusRoutes } from '@/components/layout/sheetRows';

/**
 * Settings > Screens (#690, #1153, #1267, #1351): the list of screens, each
 * with whether it is on, its sentence (the one its editor's Screen tab shows,
 * from the same function) and Edit, which opens its editor: on the screen
 * itself, or from any other device over a live picture of it. Everything
 * about a screen is set in its editor, naming the device in use included
 * (Screen, #1326); here a screen is only renamed or removed.
 *
 * Below the list, the household's row: the dashboard new and unnamed screens
 * show, and their idle and night look (`screenStartingDay`, #1345). Settings
 * save at once, as everywhere in Settings; only the editor waits for Done.
 */

type DisplayEntry = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  online: boolean;
  /** The dashboard it shows, null is the default, and its switches (#1282). */
  dashboardId: string | null;
  switches: ScreenSwitch[];
  settings: ScreenSettings;
  /** Its reported width, null before it reports one. */
  width?: number | null;
  editing?: boolean;
};

const NAME_MAX = 60;

/** The idle looks, in the words the editor's When idle uses. */
const LOOKS: { value: IdleSource; label: string }[] = [
  { value: 'dashboard', label: 'The dashboard, quieter' },
  { value: 'photos', label: 'A photo frame' },
  { value: 'sky', label: 'The night sky' },
];
const SAME = 'same';
const SELECT = 'min-h-9 rounded-md border border-input bg-background px-2 py-1.5 text-sm';

function statusText(d: DisplayEntry, now: number): string {
  if (d.online) return 'Online';
  if (!d.lastSeenAt) return 'Not seen yet';
  return `Last seen ${formatDistance(new Date(d.lastSeenAt), now, { addSuffix: true })}`;
}

async function errorFrom(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) return 'Only a parent can change screens.';
  return data?.error ?? 'That did not work. Try again.';
}

export function DisplaysSection() {
  const [displays, setDisplays] = useState<DisplayEntry[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // "Last seen 3 hours ago" is measured from when the list was fetched.
  const [fetchedAt, setFetchedAt] = useState(0);

  const { layouts, refresh: refreshLayouts } = useLayouts();
  // The household's starting day: what a screen with no day of its own goes by.
  const [household, setHousehold] = useState<ScreenDay | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editedId = useUrlParam('edited');
  const { timeFormat } = useTimeFormat();
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetch('/api/displays');
      if (list.ok) {
        const data = await list.json();
        setDisplays(data.displays);
        setCurrentId(data.currentId);
        setFetchedAt(Date.now());
      }
    } finally {
      setLoaded(true);
    }
  }, []);
  const loadHousehold = useCallback(async () => {
    const res = await fetch('/api/settings').catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    setHousehold(parseHouseholdDay(data?.settings?.[HOUSEHOLD_DAY_SETTING]));
  }, []);

  useFetchOnMount(load);
  useFetchOnMount(loadHousehold);

  const run = async (action: () => Promise<Response>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await action();
      if (!res.ok) {
        setError(await errorFrom(res));
        return false;
      }
      await load();
      return true;
    } catch {
      setError('That did not work. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Where Edit goes: the screen's own editor, this screen's included (#1280). */
  const editHref = (d: DisplayEntry): string => screenEditLink(d.id);

  const defaultId = layouts.find((l) => l.isDefault)?.id ?? '';
  // Bus routes say which days bus time is; read only when a screen has a bus switch.
  const routes = useBusRoutes(displays.some((d) => (d.switches ?? []).some((sw) => sw.when === 'bus')));
  const clock = useCallback((t: string) => formatTimeOfDay(t, timeFormat), [timeFormat]);
  const dashboards = useMemo(() => layouts.map((l) => ({ id: l.id, name: l.name, isDefault: l.isDefault })), [layouts]);
  /** A screen's sentence, as its editor's Screen tab says it. */
  const sentence = (d: DisplayEntry): string => screenRowSentence(d, {
    dashboards, household: household ?? DEFAULT_SCREEN_DAY, routes, clock,
  });

  /** New and unnamed screens show another dashboard, at once. */
  const chooseDefault = async (id: string) => {
    if (await run(() => fetch(`/api/layouts/${id}/default`, { method: 'POST' }))) await refreshLayouts();
  };
  /** Their idle and night look, at once; put back when it did not save. */
  const changeHousehold = async (next: ScreenDay) => {
    const before = household;
    setHousehold(next);
    const ok = await run(() => fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: HOUSEHOLD_DAY_SETTING, value: next }),
    }));
    if (!ok) setHousehold(before);
  };

  const rename = async (id: string) => {
    const ok = await run(() => fetch(`/api/displays/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    }));
    if (ok) setEditingId(null);
  };

  const remove = async (d: DisplayEntry) => {
    const what = d.id === currentId ? 'this screen' : `"${d.name}"`;
    if (!window.confirm(`Forget ${what}? It goes back to being an unnamed browser.`)) return;
    await run(() => fetch(`/api/displays/${d.id}`, { method: 'DELETE' }));
  };

  const current = displays.find((d) => d.id === currentId) ?? null;
  const edited = editedId ? displays.find((d) => d.id === editedId) ?? null : null;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Screens</h2>
        <p className="text-muted-foreground">
          Every named screen in the house, whether it is on, and what it does through the day.
          Edit opens a screen&apos;s editor over a live picture of it. To name a device, open
          the editor on it and go to Screen.
        </p>
        {loaded && !current && (
          <p className="mt-2 text-sm text-muted-foreground" data-unnamed-here>
            The device you are using has no name.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}
      {edited && (
        <p role="status" className="text-sm" data-screen-saved>
          {edited.online
            ? `Saved. ${edited.name} shows the change in a few seconds.`
            : `Saved. ${edited.name} shows the change when it is next switched on.`}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All screens</CardTitle>
          <CardDescription>
            A screen shows as online while it is switched on. Each row says what the screen
            shows, when it switches, and how it idles by day and at night. Edit changes them and
            everything else about the screen; a screen that is on shows the change in a few seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loaded && displays.length === 0 && (
            <p className="text-sm text-muted-foreground">No screens are named yet.</p>
          )}
          <ul className="divide-y divide-border">
            {displays.map((d) => (
              <li key={d.id} data-testid="display-row" className="flex flex-wrap items-center gap-3 py-3">
                {editingId === d.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => { e.preventDefault(); void rename(d.id); }}
                  >
                    <Input
                      aria-label={`New name for ${d.name}`}
                      maxLength={NAME_MAX}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <Button type="submit" size="sm" disabled={busy || !editName.trim()}>Save</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 basis-full sm:basis-0 sm:flex-1 sm:min-w-[12rem]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{d.name}</span>
                        {d.id === currentId && <Badge variant="secondary">This screen</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span
                          className={d.online ? 'inline-block h-2 w-2 rounded-full bg-green-500 mr-1.5' : 'inline-block h-2 w-2 rounded-full bg-muted-foreground/40 mr-1.5'}
                          aria-hidden
                        />
                        {statusText(d, fetchedAt)}
                        {d.editing && ' · being edited'}
                      </div>
                      {household && layouts.length > 0 && (
                        <p className="m-0 mt-1 text-sm" data-screen-sentence>{sentence(d)}</p>
                      )}
                    </div>
                    <Button size="sm" asChild data-screen-edit>
                      <Link href={editHref(d)}>Edit</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => { setEditingId(d.id); setEditName(d.name); }}
                    >
                      Rename
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove(d)}>
                      Remove
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <NewScreensCard
        dashboards={dashboards}
        defaultId={defaultId}
        day={household}
        busy={busy}
        onDashboard={(id) => void chooseDefault(id)}
        onDay={(next) => void changeHousehold(next)}
        clock={clock}
      />
    </div>
  );
}

/**
 * New and unnamed screens (#1351): the dashboard a device nobody named shows,
 * and the idle and night look it goes by. A screen named later copies the
 * look once and then keeps its own, so a change here changes no named screen.
 */
function NewScreensCard({ dashboards, defaultId, day, busy, onDashboard, onDay, clock }: {
  dashboards: Array<{ id: string; name: string }>;
  defaultId: string;
  /** Null until read. */
  day: ScreenDay | null;
  busy: boolean;
  onDashboard: (id: string) => void;
  onDay: (day: ScreenDay) => void;
  clock: (hhmm: string) => string;
}) {
  const nightRange = day?.switch.by === 'clock' ? `${clock(day.switch.from)} to ${clock(day.switch.to)}` : 'dusk to dawn';
  return (
    <Card data-new-screens>
      <CardHeader>
        <CardTitle>New and unnamed screens</CardTitle>
        <CardDescription>
          What a device nobody named shows, and how it idles. A screen named later starts with
          this idle and night look, then keeps its own.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 items-center gap-x-3 gap-y-2 text-sm sm:grid-cols-[minmax(0,15rem)_minmax(0,16rem)]">
          <label htmlFor="new-screens-dashboard" className="font-medium">New and unnamed screens show</label>
          <select
            id="new-screens-dashboard"
            className={SELECT}
            value={defaultId}
            disabled={busy || dashboards.length === 0}
            onChange={(e) => onDashboard(e.target.value)}
            data-new-screens-dashboard
          >
            {!defaultId && <option value="">None yet</option>}
            {dashboards.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {day && (
            <>
              <label htmlFor="new-screens-day" className="font-medium">Idle, by day</label>
              <select id="new-screens-day" className={SELECT} value={day.day} disabled={busy} data-new-screens-idle="day"
                onChange={(e) => {
                  const look = e.target.value as IdleSource;
                  // At night the same as by day follows it, as in the editor.
                  onDay(day.night === day.day ? { ...day, day: look, night: look } : { ...day, day: look });
                }}>
                {LOOKS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <label htmlFor="new-screens-night" className="font-medium">At night ({nightRange})</label>
              <select id="new-screens-night" className={SELECT} value={day.night === day.day ? SAME : day.night} disabled={busy} data-new-screens-idle="night"
                onChange={(e) => onDay({ ...day, night: e.target.value === SAME ? day.day : e.target.value as IdleSource })}>
                <option value={SAME}>Same as by day</option>
                {[...LOOKS, { value: 'off' as const, label: 'Screen off' }].filter((o) => o.value !== day.day)
                  .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {day.night !== 'off' && (
                <>
                  <label htmlFor="new-screens-darker" className="font-medium">Darker at night</label>
                  <select id="new-screens-darker" className={SELECT} value={day.nightLevel} disabled={busy} data-new-screens-idle="darker"
                    onChange={(e) => onDay({ ...day, nightLevel: Number(e.target.value) as NightLevel })}>
                    {NIGHT_LEVELS.map((l) => <option key={l} value={l}>{l === 0 ? 'Not darker' : `${l}%`}</option>)}
                  </select>
                </>
              )}
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          A named screen sets its own in its editor: Screen &gt; Shows &gt; Normally, and Screen &gt; When idle.
        </p>
      </CardContent>
    </Card>
  );
}
