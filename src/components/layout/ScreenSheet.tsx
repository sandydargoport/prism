'use client';

/**
 * The editor's Screen sheet (#1326), first in the bar: the screen being
 * edited, as a device of its own.
 *
 * Its name, renamed here; the dashboard it shows, and the dashboards it
 * switches to for a while (#1282), at bus time or at set times, a bus switch
 * with its routes and minutes (#1291); how long until it rests and how dark it
 * goes at night. They belong to the screen, not the dashboard: two screens can
 * show one dashboard, each on its own schedule. Done sends them to it with its
 * settings; the name is saved at once, as Settings > Screens saves it.
 *
 * Then the other named screens, to edit one of them instead. On a device
 * nobody named, it offers to name it (#1267), or to become a screen named
 * before. A dashboard edited with no screen says so.
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { ArrowUp, Plus, X } from 'lucide-react';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { formatTimeOfDay } from '@/components/calendar/cells/itemTime';
import { DIM_LEVELS, useIdleDimSetting } from '@/components/screensaver/idleDim';
import { SCREENSAVER_TIMEOUT_OPTIONS, useScreensaverTimeout } from '@/lib/hooks/useScreensaverTimeout';
import type { IdleBackground } from '@/lib/idleBackground';
import { asDayAndNight } from '@/lib/throughTheDay';
import {
  BUS_MINUTE_CHOICES, busWindowOf, daysShort, EVERY_DAY, MAX_SWITCHES, routesOf,
  type BusSwitch, type ScreenPlan, type ScreenSwitch,
} from '@/lib/screenSwitches';
import { screenEditLink } from '@/lib/displays/editPlace';
import { NameThisDevice } from './NameThisDevice';
import { keepPanelFor } from './canvasPanel';
import { busWindowsInWords, chip, dayChip, field, Fold, hhmm, iconButton, note, Row, useBusRoutes } from './sheetRows';
import type { DashboardInfo } from './LayoutEditorTypes';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** The day chips, Monday first as a week is read. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const NAME_MAX = 60;

/** A switch without the keys an edit cleared, so it is stored as plainly as it reads. */
function withoutUnset(sw: ScreenSwitch): ScreenSwitch {
  return Object.fromEntries(Object.entries(sw).filter(([, v]) => v !== undefined)) as ScreenSwitch;
}

type Named = { id: string; name: string };

/** The named screens, once read; null before. */
function useScreens(): [Named[] | null, React.Dispatch<React.SetStateAction<Named[] | null>>] {
  const [screens, setScreens] = useState<Named[] | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      let data: { displays?: unknown } | null = null;
      try {
        const res = await fetch('/api/displays');
        data = res.ok ? await res.json() : null;
      } catch { /* no list: no picker */ }
      if (!live) return;
      setScreens(((data?.displays ?? []) as Array<Partial<Named>>)
        .flatMap((d) => (typeof d.id === 'string' && typeof d.name === 'string' ? [{ id: d.id, name: d.name }] : [])));
    })();
    return () => { live = false; };
  }, []);
  return [screens, setScreens];
}

async function problemFrom(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) return 'Only a parent can rename a screen.';
  return data?.error ?? 'That did not work. Try again.';
}

/**
 * Opens another screen's editor, as Settings > Screens > Edit does. With
 * changes not saved, it asks first: they would be lost, as on Cancel.
 */
export async function openOtherScreen(id: string, { unsaved, confirm, go }: {
  unsaved: boolean;
  confirm: (title: string, description?: string, options?: { confirmLabel?: string; variant?: 'default' | 'destructive' }) => Promise<boolean>;
  go?: (href: string) => void;
}): Promise<boolean> {
  if (unsaved) {
    const ok = await confirm(
      'Leave without saving?',
      'The changes made here are not saved. To keep them, stay and press Done first.',
      { confirmLabel: 'Leave', variant: 'destructive' },
    );
    if (!ok) return false;
  }
  // The editor's page, not the canvas's frame this panel is drawn from.
  (go ?? ((href: string) => (window.top ?? window).location.assign(href)))(screenEditLink(id));
  return true;
}

export function ScreenSheet({
  idleBackground, allDashboards = [], currentDashboardId, onSwitchDashboard,
  screenPlan = null, onScreenPlanChange, screenId = null, forScreen = true, deviceNamed = true, onDeviceNamed,
  openSwitch = null, onPickScreen, onRenamed,
}: {
  idleBackground?: IdleBackground;
  allDashboards?: DashboardInfo[];
  currentDashboardId?: string;
  onSwitchDashboard?: (slug: string) => void;
  /** In a screen's editor, the dashboard it shows and its switches; null hides them. */
  screenPlan?: ScreenPlan | null;
  onScreenPlanChange?: (plan: ScreenPlan) => void;
  /** The named screen being edited, or null for a dashboard on its own. */
  screenId?: string | null;
  /** The editor is for a screen, so its own settings show. */
  forScreen?: boolean;
  /** The device in use has a name; one that has none is offered one here. */
  deviceNamed?: boolean;
  /** The device in use was just named, as this screen. */
  onDeviceNamed?: (displayId: string) => void;
  /** A switch to open, by its place: a dot tapped on Through the day's line. */
  openSwitch?: number | null;
  /** Edit another named screen instead. */
  onPickScreen?: (id: string) => void;
  /** The screen was renamed, to this. */
  onRenamed?: (name: string) => void;
}) {
  const { timeFormat } = useTimeFormat();
  const clock = (t: string) => formatTimeOfDay(t, timeFormat);
  const { timeout, setTimeout } = useScreensaverTimeout();
  const { level: dim, setLevel: setDim } = useIdleDimSetting();
  // Every switch folded, unless one was asked for.
  const [openRow, setOpenRow] = useState<number | null>(openSwitch);
  const toggle = (row: number) => setOpenRow((o) => (o === row ? null : row));
  const [screens, setScreens] = useScreens();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const plan = screenId ? screenPlan : null;
  const switches = plan?.switches ?? [];
  const night = asDayAndNight(idleBackground ?? { source: 'photos' }).night;

  const exists = (id: string) => allDashboards.some((d) => d.id === id);
  const dashboardName = (id: string | undefined) => allDashboards.find((d) => d.id === id)?.name ?? 'this dashboard';
  const defaultId = allDashboards.find((d) => d.isDefault)?.id ?? currentDashboardId ?? '';
  const shownId = plan?.dashboardId && exists(plan.dashboardId) ? plan.dashboardId : defaultId;
  /** Open another dashboard in the editor, when it is not the one open; it opens on this sheet. */
  const openButton = (id: string) => {
    const target = allDashboards.find((d) => d.id === id);
    if (!target?.slug || target.id === currentDashboardId) return null;
    return (
      <button type="button" className={chip(false)} data-dashboard-open={target.id}
        onClick={() => { keepPanelFor(target.id, 'screen'); onSwitchDashboard?.(target.slug!); }}>
        Open
      </button>
    );
  };

  // The screen's switches, kept on the editor page until Done.
  const saveSwitches = (next: ScreenSwitch[]) => { if (plan) onScreenPlanChange?.({ ...plan, switches: next }); };
  const editSwitch = (i: number, patch: Partial<ScreenSwitch>) =>
    saveSwitches(switches.map((sw, j) => (j === i ? withoutUnset({ ...sw, ...patch } as ScreenSwitch) : sw)));
  /** Moves a switch up the order that decides which wins an overlap; an open one stays open. */
  const moveUp = (i: number) => {
    const next = [...switches];
    const [sw] = next.splice(i, 1);
    next.splice(i - 1, 0, sw!);
    saveSwitches(next);
    setOpenRow((o) => (o === i ? i - 1 : o === i - 1 ? i : o));
  };
  const remove = (i: number) => {
    saveSwitches(switches.filter((_, j) => j !== i));
    setOpenRow(null);
  };
  /** A dashboard to switch to: the first that is not the one the screen shows. */
  const another = allDashboards.find((d) => d.id !== shownId) ?? allDashboards[0];
  const full = switches.length >= MAX_SWITCHES || !another;
  const hasBus = switches.some((sw) => sw.when === 'bus');
  /** Adds a switch, open, so its choices are in front of the person who added it. */
  const add = (sw: ScreenSwitch) => {
    saveSwitches([...switches, sw]);
    setOpenRow(switches.length);
  };
  const addTimes = () => {
    const from = Math.floor((new Date().getHours() * 60 + new Date().getMinutes()) / 15) * 15;
    if (another) add({ when: 'times', days: [...EVERY_DAY], from: hhmm(from), to: hhmm(from + 60), dashboardId: another.id });
  };
  const addBus = () => { if (another) add({ when: 'bus', dashboardId: another.id }); };
  const busRoutes = useBusRoutes(hasBus);
  /** Turns a route on or off for a bus switch; with every route on, it follows every route, ones added later too. */
  const toggleRoute = (i: number, sw: BusSwitch, id: string) => {
    const all = (busRoutes ?? []).map((r) => r.id);
    const on = routesOf(sw, busRoutes ?? []).map((r) => r.id);
    const next = on.includes(id) ? on.filter((x) => x !== id) : all.filter((x) => x === id || on.includes(x));
    editSwitch(i, { routeIds: next.length === all.length ? undefined : next });
  };

  /** A bus switch's windows today, short, for its folded line. */
  const busInShort = (sw: BusSwitch) => {
    if (!busRoutes) return 'Bus routes';
    if (busRoutes.length === 0) return 'No bus route set up yet';
    const followed = routesOf(sw, busRoutes);
    if (followed.length === 0) return 'None of its routes is set up';
    const window = busWindowOf(sw);
    const due = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    return followed.map((r) => `${r.label} ${clock(hhmm(due(r.scheduledTime) - window.before))}–${clock(hhmm(due(r.scheduledTime) + window.after))}`).join(', ');
  };
  /** When first, as that is what tells two switches apart, then the dashboard. */
  const switchInShort = (sw: ScreenSwitch) => `${sw.when === 'bus' ? busInShort(sw)
    : `${sw.days.length === 7 ? '' : `${daysShort(sw.days)} `}${clock(sw.from)}–${clock(sw.to)}`} · ${dashboardName(sw.dashboardId)}`;

  /** A bus switch's routes and minutes, and the windows they make. */
  const busDetails = (sw: BusSwitch, i: number) => {
    const window = busWindowOf(sw);
    const followed = routesOf(sw, busRoutes ?? []);
    const minutes = (edge: 'before' | 'after', label: string) => (
      <select className={field} value={window[edge]} aria-label={label} data-bus-minutes={edge}
        onChange={(e) => editSwitch(i, { [edge]: Number(e.target.value) })}>
        {/* A window stored by hand with other minutes keeps them as a choice. */}
        {[...new Set([...BUS_MINUTE_CHOICES, window[edge]])].sort((a, b) => a - b)
          .map((m) => <option key={m} value={m}>{m} min</option>)}
      </select>
    );
    return (
      <>
        {/* With one route there is nothing to choose, unless the switch follows none of those there are. */}
        {busRoutes && busRoutes.length > 0 && (busRoutes.length > 1 || followed.length === 0) && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Bus routes" data-bus-routes>
            {busRoutes.map((r) => {
              const on = followed.some((f) => f.id === r.id);
              return (
                // One always stays on; Remove takes the switch away.
                <button key={r.id} type="button" aria-pressed={on} disabled={on && followed.length === 1}
                  className={cn(chip(on), 'disabled:opacity-100')} onClick={() => toggleRoute(i, sw, r.id)} data-bus-route={r.id}>
                  {r.label} {clock(r.scheduledTime)}
                </button>
              );
            })}
          </div>
        )}
        {/* The card's whole width, so before and after stay on one line in a narrow panel. */}
        <span className="flex flex-wrap items-center gap-2 text-body" data-bus-window>
          From {minutes('before', 'Minutes before the bus')} before to {minutes('after', 'Minutes after the bus')} after
        </span>
        <p className={note} data-bus-windows>
          {!busRoutes ? `From ${window.before} minutes before each bus route's time at the stop to ${window.after} minutes after, on its days.`
            : busRoutes.length === 0 ? 'No bus route is set up yet, so this never switches. Add one in Settings > Bus.'
              : followed.length === 0 ? 'None of its routes is set up any more, so this never switches. Pick one above.'
                : busWindowsInWords(followed, clock, window)}
        </p>
      </>
    );
  };

  const switchRow = (sw: ScreenSwitch, i: number) => (
    <Fold key={i} name={sw.when === 'bus' ? 'At bus time' : 'At set times'} summary={switchInShort(sw)} colorIndex={i}
      open={openRow === i} onToggle={() => toggle(i)} data-switch-row={i} data-switch={sw.when}>
      <span className="flex flex-wrap items-center gap-2 text-body">
        Shows
        <select className={cn(field, 'min-w-0 max-w-full')} value={sw.dashboardId} aria-label="Switches to" onChange={(e) => editSwitch(i, { dashboardId: e.target.value })}>
          {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </span>
      {sw.when === 'bus' ? busDetails(sw, i) : (
        <>
          {/* The card's whole width, so from and to stay on one line in a narrow panel. */}
          <span className="flex flex-wrap items-center gap-2 text-body">
            From
            <input type="time" className={field} value={sw.from} aria-label="Switch starts"
              onChange={(e) => e.target.value && editSwitch(i, { from: e.target.value })} />
            to
            <input type="time" className={field} value={sw.to} aria-label="Switch ends"
              onChange={(e) => e.target.value && editSwitch(i, { to: e.target.value })} />
          </span>
          <div className="flex flex-wrap items-center gap-1 pointer-fine:flex-nowrap" role="group" aria-label="Switch days">
            {WEEK_ORDER.map((d) => {
              const on = sw.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-label={DAY_FULL[d]}
                  aria-pressed={on}
                  // A switch keeps at least one day; Remove takes it away.
                  disabled={on && sw.days.length === 1}
                  onClick={() => editSwitch(i, { days: on ? sw.days.filter((x) => x !== d) : [...sw.days, d].sort() })}
                  className={dayChip(on)}
                  data-day-chip={d}
                >
                  {DAY_NAMES[d]}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {openButton(sw.dashboardId)}
        {i > 0 && (
          <button type="button" className={iconButton} onClick={() => moveUp(i)} aria-label="Move up: wins an overlap" data-switch-up>
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        )}
        <button type="button" className={cn(chip(false), 'ml-auto')} data-switch-remove onClick={() => remove(i)}>
          <X className="mr-1 h-4 w-4" aria-hidden />Remove
        </button>
      </div>
    </Fold>
  );

  const name = screenId ? screens?.find((s) => s.id === screenId)?.name ?? null : null;
  const rename = async () => {
    const next = renaming?.trim();
    if (!screenId || !next) return;
    setBusy(true);
    setProblem(null);
    try {
      // At once, as Settings > Screens renames one: a name is not part of Done.
      const res = await fetch(`/api/displays/${encodeURIComponent(screenId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next }),
      }).catch(() => null);
      if (!res?.ok) { setProblem(res ? await problemFrom(res) : 'That did not work. Try again.'); return; }
      setScreens((list) => list?.map((s) => (s.id === screenId ? { ...s, name: next } : s)) ?? list);
      setRenaming(null);
      onRenamed?.(next);
    } finally {
      setBusy(false);
    }
  };
  const others = (screens ?? []).filter((s) => s.id !== screenId);

  return (
    <div className="flex flex-col gap-5 pointer-fine:gap-4" data-screen-sheet>
      {screenId ? (
        <section className="flex flex-col gap-2 pointer-fine:gap-1.5" aria-label="This screen" data-screen-name>
          {renaming === null ? (
            <Row name="Name">
              <span className="min-w-0 truncate text-body font-medium" data-screen-name-text>{name ?? '…'}</span>
              <button type="button" className={cn(chip(false), 'ml-auto')} disabled={name === null}
                onClick={() => { setRenaming(name ?? ''); setProblem(null); }} data-screen-rename>
                Rename
              </button>
            </Row>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void rename(); }}>
              <Row name="Name">
                <input className={cn(field, 'min-w-0 flex-1')} aria-label="New name for this screen" maxLength={NAME_MAX}
                  value={renaming} onChange={(e) => setRenaming(e.target.value)} autoFocus />
                <button type="submit" className={chip(true)} disabled={busy || !renaming.trim()}>Save</button>
                <button type="button" className={chip(false)} onClick={() => setRenaming(null)}>Cancel</button>
              </Row>
            </form>
          )}
          {problem && <p role="alert" className="m-0 text-body text-destructive">{problem}</p>}
        </section>
      ) : (
        <p className="m-0 text-body text-muted-foreground" data-no-screen>
          No screen is being edited, so this edits {dashboardName(currentDashboardId)} on its own.
        </p>
      )}

      {plan && (
        // What the screen shows, and when it switches to another, as rows.
        <section className="flex flex-col gap-2 pointer-fine:gap-1.5" aria-label="What this screen shows" data-screen-plan>
          <Row name="Shows">
            <select className={cn(field, 'min-w-0 max-w-full')} value={shownId} aria-label="Dashboard this screen shows" data-screen-dashboard
              onChange={(e) => onScreenPlanChange?.({ ...plan, dashboardId: e.target.value })}>
              {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {openButton(shownId)}
          </Row>
          {switches.map(switchRow)}
          {switches.length > 1 && <p className={note}>If two overlap, the higher one wins.</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" className={chip(false)} onClick={addBus} disabled={full} data-switch-add="bus">
              <Plus className="mr-1 h-4 w-4" aria-hidden />Switch at bus time
            </button>
            <button type="button" className={chip(false)} onClick={addTimes} disabled={full} data-switch-add="times">
              <Plus className="mr-1 h-4 w-4" aria-hidden />Switch at set times
            </button>
          </div>
          <p className={note}>Done saves these to this screen. Times are in the household time zone.</p>
        </section>
      )}

      {forScreen && (
        // How soon it rests and how dark it goes are the screen's own, kept
        // with its other settings.
        <section className="flex flex-col gap-2 border-t border-border pt-4 pointer-fine:gap-1.5 pointer-fine:pt-3" aria-label="On this screen" data-screen-own>
          <Row name="Rest after">
            <select className={field} value={timeout} onChange={(e) => setTimeout(Number(e.target.value))} aria-label="Rest after">
              {SCREENSAVER_TIMEOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === 0 ? 'Never rests' : o.label}</option>)}
            </select>
            <span className={note}>of nobody touching it</span>
          </Row>
          {night !== 'off' && (
            <Row name="How dark">
              <select className={field} value={dim} onChange={(e) => setDim(e.target.value)} aria-label="How dark at night">
                {DIM_LEVELS.map((l) => <option key={l.raw} value={l.raw}>{l.raw === '0' ? 'Not dimmed' : l.label}</option>)}
              </select>
              <span className={note}>at night</span>
            </Row>
          )}
        </section>
      )}

      {!screenId && !deviceNamed && onDeviceNamed && (
        <section className="border-t border-border pt-4 pointer-fine:pt-3" aria-label="Name this device">
          <NameThisDevice shows={dashboardName(defaultId)} onNamed={onDeviceNamed} chip={chip} field={field} />
        </section>
      )}

      {others.length > 0 && (
        <section className="border-t border-border pt-4 pointer-fine:pt-3" aria-label="Other screens" data-screen-picker>
          <Row name={screenId ? 'Other screens' : 'Screens'}>
            <select className={cn(field, 'min-w-0 max-w-full')} aria-label="Edit another screen" value=""
              onChange={(e) => { if (e.target.value) onPickScreen?.(e.target.value); }} data-screen-pick>
              <option value="">{screenId ? 'Edit another…' : 'Edit a screen…'}</option>
              {others.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Row>
        </section>
      )}
    </div>
  );
}
