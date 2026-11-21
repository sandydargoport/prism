'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { formatDistance } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useFetchOnMount } from '@/lib/hooks/useFetchOnMount';
import { useLayouts } from '@/lib/hooks/useLayouts';
import type { ScreenSettings } from '@/lib/displays/screenSettings';
import { screenSummary } from '@/lib/displays/screenSummary';
import { useUrlParam } from '@/lib/hooks/useUrlParam';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { formatTimeOfDay } from '@/components/calendar/cells/itemTime';
import { editLink } from '@/components/dashboard/useDashboardLayout';
import { pickTimeline, useTimelines } from '@/lib/hooks/useTimelines';
import { timelineDashboardAt, timelineFor } from '@/lib/timeline';

/**
 * Settings > Screens (#690, #1153, #1267): the list of screens, each with
 * whether it is on, the timeline it follows (#1266) and Edit, which opens its
 * editor: on the screen itself, or from any other device over a live picture
 * of it. Everything about a screen is set in its editor, naming the device in
 * use included (Through the day); here a screen is only renamed or removed.
 */

type DisplayEntry = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  online: boolean;
  /** The timeline it follows; null is the household's first. */
  timelineId: string | null;
  settings: ScreenSettings;
  editing?: boolean;
};

const NAME_MAX = 60;

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

  const { layouts } = useLayouts();
  const { timelines } = useTimelines();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editedId = useUrlParam('edited');
  const { timeFormat, householdTimezone } = useTimeFormat();
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

  useFetchOnMount(load);

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
    } finally {
      setBusy(false);
    }
  };

  /** Where Edit goes: what this screen shows now, in place, or the canvas editor for another. */
  const editHref = (d: DisplayEntry): string => {
    if (d.id !== currentId) return `/screens/${d.id}`;
    const timeline = timelineFor(timelines, d.timelineId);
    // As of when the list was read, as "last seen" is.
    const nowId = timeline ? timelineDashboardAt(timeline, fetchedAt, householdTimezone, (id) => layouts.some((l) => l.id === id)) : null;
    const home = layouts.find((l) => l.id === nowId);
    return editLink(home && !home.isDefault && home.slug ? `/d/${home.slug}` : '/');
  };

  /** A screen follows another timeline, from its row. */
  const chooseTimeline = async (d: DisplayEntry, timelineId: string) => {
    setBusy(true);
    setError(null);
    try {
      if (!(await pickTimeline(d.id, timelineId))) setError('That did not work. Try again.');
      await load();
    } finally {
      setBusy(false);
    }
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
          Every named screen in the house, whether it is on, and the timeline it follows. Edit
          opens a screen&apos;s editor over a live picture of it. A device nobody named follows
          the first timeline; to name one, open the editor on it and go to Through the day.
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
            A screen shows as online while it is switched on. Each follows a timeline: which
            dashboard shows when, how it rests and its night. Screens that should behave alike
            follow the same one. Edit changes it and the screen&apos;s notices; a screen that is
            on shows the change in a few seconds.
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
                      <div className="text-sm text-muted-foreground" data-screen-summary>
                        {screenSummary(d.settings ?? {}, timelineFor(timelines, d.timelineId), (t) => formatTimeOfDay(t, timeFormat))}.
                      </div>
                    </div>
                    {timelines.length > 0 && (
                      <select
                        aria-label={`Timeline for ${d.name}`}
                        className="min-h-9 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={timelineFor(timelines, d.timelineId)?.id ?? ''}
                        disabled={busy}
                        onChange={(e) => void chooseTimeline(d, e.target.value)}
                        data-screen-timeline
                      >
                        {timelines.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
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
    </div>
  );
}
