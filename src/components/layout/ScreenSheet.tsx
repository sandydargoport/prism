'use client';

/**
 * The editor's Screen sheet (#1326), first in the bar: the screen being
 * edited, as a device of its own.
 *
 * First a Screen drop-down of every named screen, set to the one edited:
 * picking another opens its editor, and a pencil beside it renames it in
 * place, saved on Enter or on leaving the field as Settings > Screens saves
 * it. Then the Base dashboard; its Switches to other dashboards for a while (#1282), at bus time or
 * at set times, a bus switch with its routes and minutes (#1291); and, When
 * nobody is using it, how long until it rests and how dark it goes at night.
 * Then Light or dark and the photos behind the dashboard (#1340).
 * They belong to the screen, not the dashboard: two screens can show one
 * dashboard, each on its own schedule. Done sends them with its settings.
 *
 * On a device nobody named, the drop-down says so and the sheet offers to
 * name it (#1267), or to become a screen named before. A dashboard edited
 * with no screen says so.
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ChevronDown, Pencil, Plus, X } from 'lucide-react';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { formatTimeOfDay } from '@/components/calendar/cells/itemTime';
import { DIM_LEVELS, useIdleDimSetting } from '@/components/screensaver/idleDim';
import { SCREENSAVER_TIMEOUT_OPTIONS, useScreensaverTimeout } from '@/lib/hooks/useScreensaverTimeout';
import { useStoredString, writeStored } from '@/lib/hooks/useStoredValue';
import type { IdleBackground } from '@/lib/idleBackground';
import { backgroundOf, DEFAULT_SCREEN_DAY } from '@/lib/screenDay';
import { asDayAndNight } from '@/lib/throughTheDay';
import {
  BUS_MINUTE_CHOICES, busWindowOf, daysShort, EVERY_DAY, MAX_SWITCHES, routesOf,
  type BusSwitch, type ScreenPlan, type ScreenSwitch,
} from '@/lib/screenSwitches';
import { screenEditLink } from '@/lib/displays/editPlace';
import { NameThisDevice } from './NameThisDevice';
import { keepPanelFor } from './canvasPanel';
import { busWindowsInWords, chip, dayChip, field, Fold, hhmm, iconButton, note, useBusRoutes } from './sheetRows';
import type { DashboardInfo } from './LayoutEditorTypes';
import { cn } from '@/lib/utils';

const THEME_KEY = 'prism-theme';
const WALLPAPER_KEY = 'prism-wallpaper-enabled';
const WALLPAPER_INTERVAL_KEY = 'prism-wallpaper-interval';
const DEFAULT_WALLPAPER_INTERVAL = 60;
/** How often the photo behind the dashboard changes, as Settings > Appearance offers it. */
const WALLPAPER_INTERVALS: [number, string][] = [
  [30, '30 seconds'], [60, '1 minute'], [120, '2 minutes'], [300, '5 minutes'], [600, '10 minutes'], [3600, '1 hour'],
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** The day chips, Monday first as a week is read. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const NAME_MAX = 60;
/**
 * Every field of this sheet, select or text, one height, one inset and one
 * font, so their words start at one x down the column.
 */
const INPUT = 'h-[44px] w-full min-w-0 rounded-lg border border-border bg-background px-3 text-body leading-normal text-foreground pointer-fine:h-9';

/** A select drawn as the text fields are: its own arrow, the browser's inset gone. */
function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative min-w-0 flex-1">
      <select className={cn(INPUT, 'appearance-none pr-8', className)} {...rest}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}

/** A section's heading, as the editor's other sheets have them. */
const HEADING = 'm-0 text-caption font-medium uppercase tracking-[0.1em] text-muted-foreground';

/**
 * A labelled control: the label in one column of one width, top-aligned, the
 * control filling the other; at a phone's width the label sits above it.
 */
function Field({ label, htmlFor, children, after }: { label: string; htmlFor?: string; children: React.ReactNode; after?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)]" data-field>
      <label htmlFor={htmlFor} className="pt-0 text-body font-medium sm:pt-2.5 pointer-fine:sm:pt-2" data-field-label>{label}</label>
      <div className="flex min-w-0 flex-col gap-1">
        {children}
        {after}
      </div>
    </div>
  );
}

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
  openSwitch = null, onPickScreen, onRenamed, onSettingChange,
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
  /** Rest after or How dark changed, so the tab's unsaved dot can show. */
  onSettingChange?: () => void;
}) {
  const { timeFormat } = useTimeFormat();
  const clock = (t: string) => formatTimeOfDay(t, timeFormat);
  const { timeout, setTimeout } = useScreensaverTimeout();
  const { level: dim, setLevel: setDim } = useIdleDimSetting();
  // Light or dark: what the screen keeps, or what it shows now until it keeps one.
  const storedMode = useStoredString(THEME_KEY);
  const mode = storedMode === 'light' || storedMode === 'dark' ? storedMode
    : typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  // As WallpaperBackground reads them: on unless turned off, 60 seconds unless set.
  const photosOn = useStoredString(WALLPAPER_KEY) !== 'false';
  const storedRotate = Number(useStoredString(WALLPAPER_INTERVAL_KEY));
  const rotate = String(WALLPAPER_INTERVALS.some(([s]) => s === storedRotate) ? storedRotate : DEFAULT_WALLPAPER_INTERVAL);
  // Every switch folded, unless one was asked for.
  const [openRow, setOpenRow] = useState<number | null>(openSwitch);
  const toggle = (row: number) => setOpenRow((o) => (o === row ? null : row));
  const [screens, setScreens] = useScreens();
  /** The name as typed while renaming; null shows the drop-down. */
  const [draft, setDraft] = useState<string | null>(null);
  // Whether a rename is still open to save: Esc, or a save under way, closes
  // it, so the blur as the field goes does not save again.
  const renameOpen = useRef(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const plan = screenId ? screenPlan : null;
  const switches = plan?.switches ?? [];
  const night = asDayAndNight(idleBackground ?? backgroundOf(DEFAULT_SCREEN_DAY)).night;

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
  // Read for every screen: a bus switch is offered only once a bus route is set up.
  const busRoutes = useBusRoutes(!!plan);
  const busSetUp = (busRoutes?.length ?? 0) > 0;
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
  const startRename = () => { renameOpen.current = true; setProblem(null); setDraft(name ?? ''); };
  const cancelRename = () => { renameOpen.current = false; setProblem(null); setDraft(null); };
  /** Saves the name typed, on Enter or on leaving the field; an unchanged or empty one goes back. */
  const rename = async () => {
    if (!screenId || draft === null || !renameOpen.current) return;
    renameOpen.current = false;
    const next = draft.trim();
    if (!next || next === name) { setDraft(null); return; }
    setBusy(true);
    setProblem(null);
    try {
      // At once, as Settings > Screens renames one: a name is not part of Done.
      const res = await fetch(`/api/displays/${encodeURIComponent(screenId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next }),
      }).catch(() => null);
      if (!res?.ok) {
        // The field stays, with why, to try again or Esc.
        renameOpen.current = true;
        setProblem(res ? await problemFrom(res) : 'That did not work. Try again.');
        return;
      }
      setScreens((list) => list?.map((s) => (s.id === screenId ? { ...s, name: next } : s)) ?? list);
      setDraft(null);
      onRenamed?.(next);
    } finally {
      setBusy(false);
    }
  };
  const fieldId = (key: string) => `screen-sheet-${key}`;

  return (
    <div className="flex flex-col gap-6 pointer-fine:gap-5" data-screen-sheet>
      <section className="flex flex-col gap-3" aria-label="This screen" data-screen-top>
        <Field label="Screen" htmlFor={fieldId(draft === null ? 'pick' : 'name')}
          after={problem && <p role="alert" className="m-0 text-body text-destructive">{problem}</p>}>
          {draft === null ? (
            <div className="flex min-w-0 items-center gap-2">
              <Select id={fieldId('pick')} value={screenId ?? ''} data-screen-pick
                onChange={(e) => { if (e.target.value && e.target.value !== screenId) onPickScreen?.(e.target.value); }}>
                {!screenId && <option value="">{deviceNamed ? 'No screen' : 'This device (not named)'}</option>}
                {screenId && !screens?.some((s) => s.id === screenId) && <option value={screenId}>{name ?? '…'}</option>}
                {(screens ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              {screenId && name !== null && (
                <button type="button" aria-label={`Rename ${name}`} onClick={startRename} data-screen-rename
                  className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-fine:h-9 pointer-fine:w-9">
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void rename(); }}>
              <input id={fieldId('name')} className={INPUT} maxLength={NAME_MAX} disabled={busy} autoFocus
                aria-label="Name of this screen" value={draft} data-screen-name
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelRename(); } }}
                onBlur={() => void rename()} />
            </form>
          )}
        </Field>
        {!screenId && (
          <p className="m-0 text-body text-muted-foreground" data-no-screen>
            No screen is being edited, so this edits {dashboardName(currentDashboardId)} on its own.
          </p>
        )}
        {plan && (
          <Field label="Base dashboard" htmlFor={fieldId('dashboard')}
            after={<span className={note}>Shown except while a switch is on.</span>}>
            <div className="flex min-w-0 items-center gap-2">
              <Select id={fieldId('dashboard')} value={shownId} data-screen-dashboard
                onChange={(e) => onScreenPlanChange?.({ ...plan, dashboardId: e.target.value })}>
                {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              {openButton(shownId)}
            </div>
          </Field>
        )}
      </section>

      {!screenId && !deviceNamed && onDeviceNamed && (
        <section aria-label="Name this device">
          <NameThisDevice shows={dashboardName(defaultId)} onNamed={onDeviceNamed} chip={chip} field={field} />
        </section>
      )}

      {plan && (
        // When the screen switches to another dashboard, as rows.
        <section className="flex flex-col gap-2 pointer-fine:gap-1.5" aria-labelledby={fieldId('switches')} data-screen-plan>
          <h3 id={fieldId('switches')} className={HEADING} data-screen-heading>Switches</h3>
          {switches.map(switchRow)}
          {switches.length > 1 && <p className={note}>If two overlap, the higher one wins.</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Only with bus tracking set up; a bus switch made before still shows above. */}
            {busSetUp && (
              <button type="button" className={chip(false)} onClick={addBus} disabled={full} data-switch-add="bus">
                <Plus className="mr-1 h-4 w-4" aria-hidden />Switch at bus time
              </button>
            )}
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
        <section className="flex flex-col gap-3" aria-labelledby={fieldId('idle')} data-screen-own>
          <h3 id={fieldId('idle')} className={HEADING} data-screen-heading>When nobody is using it</h3>
          <Field label="Rest after" htmlFor={fieldId('rest')} after={<span className={note}>of nobody touching it</span>}>
            <Select id={fieldId('rest')} value={timeout} onChange={(e) => { setTimeout(Number(e.target.value)); onSettingChange?.(); }}>
              {SCREENSAVER_TIMEOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === 0 ? 'Never rests' : o.label}</option>)}
            </Select>
          </Field>
          {night !== 'off' && (
            <Field label="How dark" htmlFor={fieldId('dark')} after={<span className={note}>at night</span>}>
              <Select id={fieldId('dark')} value={dim} onChange={(e) => { setDim(e.target.value); onSettingChange?.(); }} aria-label="How dark at night">
                {DIM_LEVELS.map((l) => <option key={l.raw} value={l.raw}>{l.raw === '0' ? 'Not dimmed' : l.label}</option>)}
              </Select>
            </Field>
          )}
        </section>
      )}

      {forScreen && (
        // Light or dark and the photos behind the dashboard are the screen's
        // own too (#1340): from a laptop they are the screen's, not the laptop's.
        <section className="flex flex-col gap-3" aria-labelledby={fieldId('look')} data-screen-look>
          <h3 id={fieldId('look')} className={HEADING} data-screen-heading>Light and photos</h3>
          <Field label="Light or dark" htmlFor={fieldId('mode')}>
            <Select id={fieldId('mode')} value={mode} data-screen-mode
              onChange={(e) => { writeStored(THEME_KEY, e.target.value); onSettingChange?.(); }}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </Field>
          <Field label="Photos behind the dashboard" htmlFor={fieldId('photos')}>
            <Select id={fieldId('photos')} value={photosOn ? 'true' : 'false'} data-screen-photos
              onChange={(e) => { writeStored(WALLPAPER_KEY, e.target.value); onSettingChange?.(); }}>
              <option value="true">Shown</option>
              <option value="false">Hidden</option>
            </Select>
          </Field>
          {photosOn && (
            <Field label="New photo every" htmlFor={fieldId('rotate')}>
              <Select id={fieldId('rotate')} value={rotate}
                onChange={(e) => { writeStored(WALLPAPER_INTERVAL_KEY, e.target.value); onSettingChange?.(); }}>
                {WALLPAPER_INTERVALS.map(([s, label]) => <option key={s} value={String(s)}>{label}</option>)}
              </Select>
            </Field>
          )}
        </section>
      )}
    </div>
  );
}
