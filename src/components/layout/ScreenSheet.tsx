'use client';

/**
 * The editor's Screen tab (#1326, #1349): the screen's whole day, in plain
 * rows, with one picture of today above them.
 *
 *  - The scope line and the sentence the screen says about itself
 *    (`screenSentence`, from the same scene function the wall runs).
 *  - The strip: today as one bar, night shaded by the screen's own rule, each
 *    switch a band in its row's swatch colour, a line at now.
 *  - Shows: Normally, then the switches in priority order (bus time, set
 *    times), each with its swatch and Edit. Higher rows win an overlap, and a
 *    row a higher one covers says so.
 *  - When idle: Idle after, then what it shows By day and At night, and how
 *    much darker at night. When night is and the photo frame's motion are
 *    under Advanced.
 *  - This screen: light or dark, the photos behind the dashboard, and which
 *    screen is edited. Advanced: orientation, performance, keyboard,
 *    auto-hide, sign out, notices.
 *
 * Everything here belongs to the screen, not the dashboard: two screens can
 * show one dashboard, each on its own day. Every control waits for Done
 * (#1341): the dashboard and switches are held on the editor page, the
 * screen's settings in its in-memory layer, the idle looks with the editor.
 *
 * A device nobody named keeps its idle rows; Normally and Add a time ask for
 * a name first, in place. A dashboard edited with no screen says so.
 */
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ChevronDown, ChevronRight, Pencil, Plus, X } from 'lucide-react';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { formatTimeOfDay } from '@/components/calendar/cells/itemTime';
import { useIdleDimSetting } from '@/components/screensaver/idleDim';
import { useSkyLocation } from '@/components/screensaver/useIdleBackground';
import { SCREENSAVER_TIMEOUT_OPTIONS, useScreensaverTimeout } from '@/lib/hooks/useScreensaverTimeout';
import { useStoredString, writeStored } from '@/lib/hooks/useStoredValue';
import { sameIdleBackground, tonight, type IdleBackground, type IdleSource, type IdleSwitch } from '@/lib/idleBackground';
import { backgroundOf, DEFAULT_SCREEN_DAY, NIGHT_LEVELS } from '@/lib/screenDay';
import { asDayAndNight, DEFAULT_NIGHT } from '@/lib/throughTheDay';
import { nightSpans, switchSpans } from '@/lib/dayWaypoints';
import { switchCoverage } from '@/lib/dayStrip';
import { daysInWords, screenSentence } from '@/lib/screenSentence';
import { todayKey, weekdayOfKey } from '@/lib/utils/zonedDate';
import {
  BUS_MINUTE_CHOICES, busWindowOf, EVERY_DAY, MAX_SWITCHES, routesOf, staysAwake,
  type BusSwitch, type ScreenPlan, type ScreenSwitch,
} from '@/lib/screenSwitches';
import { screenEditLink } from '@/lib/displays/editPlace';
import { NameThisDevice } from './NameThisDevice';
import type { SwitchChoice } from './SwitchPrompt';
import { keepPanelFor } from './canvasPanel';
import { busWindowsInWords, chip, dayChip, field, hhmm, iconButton, note, Swatch, useBusRoutes, type BusRoute } from './sheetRows';
import { DayStrip, useMinuteNow } from './DayStrip';
import { OffsetInput } from './IdleBackgroundBar';
import { PhotoFrameMotion } from './PhotoFrameMotion';
import { ScreenOptions } from './ScreenOptions';
import type { IdleSwitchCheck } from './useIdleSwitchCheck';
import type { DashboardInfo } from './LayoutEditorTypes';
import { Switch } from '@/components/ui/switch';
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
/** The picker's choice that makes a dashboard to switch to. */
const NEW_DASHBOARD = '__new';
const SET_TIMES: IdleSwitch = { by: 'clock', from: '21:00', to: '06:30' };

/** Idle after, short, as the row reads: "Idle after 2 min". */
const IDLE_AFTER_SHORT: Record<number, string> = { 30: '30 sec', 60: '1 min', 120: '2 min', 600: '10 min', 3600: '1 hour', 0: 'Never' };
const LOOKS: { value: IdleSource; label: string }[] = [
  { value: 'dashboard', label: 'The dashboard, quieter' },
  { value: 'photos', label: 'A photo frame' },
  { value: 'sky', label: 'The night sky' },
];
const NIGHT_ONLY: { value: IdleSource; label: string }[] = [{ value: 'off', label: 'Screen off' }];
const SAME = 'same';

/** A section's heading, as the editor's other tabs have them. */
const HEADING = 'm-0 text-caption font-medium uppercase tracking-[0.1em] text-muted-foreground';
/** Every field of this tab: one height, one inset, one font. */
const INPUT = 'h-[44px] w-full min-w-0 rounded-lg border border-border bg-background px-3 text-body leading-normal text-foreground pointer-fine:h-9';
/** A plain-text action beside a row, as a link reads. */
const LINK = 'flex min-h-[44px] items-center rounded-md px-1.5 text-body font-medium text-primary hover:underline pointer-fine:min-h-8 pointer-fine:text-caption';

/** A select drawn as the text fields are: its own arrow, the browser's inset gone. */
function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative min-w-0 flex-1">
      <select className={cn(INPUT, 'appearance-none pr-8 disabled:opacity-50', className)} {...rest}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}

/** A fold under a line: its name, and what it holds once opened. */
function Disclosure({ label, defaultOpen = false, children, ...rest }: {
  label: string; defaultOpen?: boolean; children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-border pt-2" data-open={open} {...rest}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-disclosure-toggle
        className="flex min-h-[44px] w-full items-center gap-1.5 text-left text-body font-medium pointer-fine:min-h-8 pointer-fine:text-caption">
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} aria-hidden />
        {label}
      </button>
      {open && <div className="flex flex-col gap-3 pb-1 pt-2" data-disclosure-body>{children}</div>}
    </section>
  );
}

/**
 * One row of Shows: its swatch (its colour on the strip), its name, what it
 * does in words, and Edit, which opens its choices under it.
 */
function ShowsRow({ swatch, name, summary, covered, open, onToggle, children, ...rest }: {
  swatch: number;
  name: string;
  summary: string;
  /** A higher row takes some or all of its time, in words. */
  covered?: string | null;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="border-b border-border py-1.5" data-open={open} {...rest}>
      <div className="grid grid-cols-[0.75rem_5.5rem_minmax(0,1fr)_auto] items-start gap-x-2.5">
        <Swatch index={swatch} className="mt-[0.9rem] pointer-fine:mt-[0.65rem]" />
        <span className="pt-2.5 font-medium pointer-fine:pt-1.5" data-row-name>{name}</span>
        <span className="min-w-0 pt-2.5 text-body pointer-fine:pt-1.5">
          <span data-row-summary>{summary}</span>
          {covered && <span className="block text-caption text-muted-foreground" data-row-covered>{covered}</span>}
        </span>
        <button type="button" className={LINK} aria-expanded={open} aria-label={`${open ? 'Close' : 'Edit'} ${name}`} onClick={onToggle} data-row-edit>
          {open ? 'Close' : 'Edit'}
        </button>
      </div>
      {open && <div className="flex flex-col gap-2 pb-2 pl-[calc(0.75rem+0.625rem)] pt-1.5" data-row-body>{children}</div>}
    </div>
  );
}

/** A switch without the keys an edit cleared, so it is stored as plainly as it reads. */
function withoutUnset(sw: ScreenSwitch): ScreenSwitch {
  return Object.fromEntries(Object.entries(sw).filter(([, v]) => v !== undefined)) as ScreenSwitch;
}

/**
 * Back to the plainest form that means the same: one background when it is
 * the same by day and night on the default rule, as a screen nobody set a
 * night for is stored.
 */
export function simplest(pair: { day: IdleSource; night: IdleSource; switch: IdleSwitch }): IdleBackground {
  const single: IdleBackground = { source: pair.day };
  if (pair.day === pair.night && sameIdleBackground({ ...pair }, { day: pair.day, night: pair.day, switch: DEFAULT_NIGHT })) return single;
  return pair;
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
 * changes not saved, it asks first (#1341): Save and switch saves them as
 * Done does and then opens it, Discard opens it without them, Stay stays.
 */
export async function openOtherScreen(id: string, { unsaved, ask, save, go }: {
  unsaved: boolean;
  ask: () => Promise<SwitchChoice>;
  /** Done, then on to `href`. */
  save: (href: string) => Promise<void>;
  go?: (href: string) => void;
}): Promise<boolean> {
  const href = screenEditLink(id);
  if (unsaved) {
    const choice = await ask();
    if (choice === 'stay') return false;
    if (choice === 'save') {
      await save(href);
      return true;
    }
  }
  // The editor's page, not the canvas's frame this panel is drawn from.
  (go ?? ((to: string) => (window.top ?? window).location.assign(to)))(href);
  return true;
}

/** The kind of switch a row is, as its name. */
const kindName = (sw: ScreenSwitch) => (sw.when === 'bus' ? 'Bus time' : 'Set times');

export function ScreenSheet({
  idleBackground, onIdleBackgroundChange, idleCheck = {}, onShowIdle, onArrangePhotoFrame, canIdle = true,
  allDashboards = [], currentDashboardId, onSwitchDashboard, onNewDashboard,
  screenPlan = null, onScreenPlanChange, screenId = null, deviceNamed = true, onDeviceNamed,
  onPickScreen, onRenamed,
}: {
  /** The screen's idle looks and night rule, as being edited; Done saves them. */
  idleBackground?: IdleBackground;
  onIdleBackgroundChange?: (bg: IdleBackground) => void;
  idleCheck?: IdleSwitchCheck;
  /** Show the screen idle on the canvas, by day or at night (#1348). */
  onShowIdle?: (night: boolean) => void;
  /** Open the photo frame's arrangement on the canvas, by day or at night. */
  onArrangePhotoFrame?: (night: boolean) => void;
  /** False for a screen too narrow to idle. */
  canIdle?: boolean;
  allDashboards?: DashboardInfo[];
  currentDashboardId?: string;
  onSwitchDashboard?: (slug: string) => void;
  /** Make a new dashboard, by name, to switch to; its id, or null when that did not work. */
  onNewDashboard?: (name: string) => Promise<string | null>;
  /** In a screen's editor, the dashboard it shows and its switches; null hides them. */
  screenPlan?: ScreenPlan | null;
  onScreenPlanChange?: (plan: ScreenPlan) => void;
  /** The named screen being edited, or null for a dashboard on its own. */
  screenId?: string | null;
  /** The device in use has a name; one that has none is offered one here. */
  deviceNamed?: boolean;
  /** The device in use was just named, as this screen. */
  onDeviceNamed?: (displayId: string) => void;
  /** Edit another named screen instead. */
  onPickScreen?: (id: string) => void;
  /** The screen was renamed, to this. */
  onRenamed?: (name: string) => void;
}) {
  const { timeFormat, householdTimezone } = useTimeFormat();
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
  // Every row folded when the tab opens.
  const [openRow, setOpenRow] = useState<number | 'normally' | null>(null);
  const toggle = (row: number | 'normally') => setOpenRow((o) => (o === row ? null : row));
  /** On a device with no name: where a name was asked for, before what needs one. */
  const [askName, setAskName] = useState<'normally' | 'add' | null>(null);
  /** A switch row making a new dashboard to switch to, and its name so far. */
  const [making, setMaking] = useState<{ row: number; name: string; busy: boolean } | null>(null);
  const [screens, setScreens] = useScreens();
  /** The name as typed while renaming; null shows the drop-down. */
  const [draft, setDraft] = useState<string | null>(null);
  // Whether a rename is still open to save: Esc, or a save under way, closes
  // it, so the blur as the field goes does not save again.
  const renameOpen = useRef(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const plan = screenId ? screenPlan : null;
  const switches = useMemo(() => plan?.switches ?? [], [plan]);
  const unnamed = !screenId && !deviceNamed;
  /** The screen's own day is set here: a named screen's, or this device's while it has no name. */
  const ownsDay = !!screenId || unnamed;

  const exists = (id: string) => allDashboards.some((d) => d.id === id);
  const dashboardName = (id: string | undefined) => allDashboards.find((d) => d.id === id)?.name ?? 'this dashboard';
  const defaultDashboard = allDashboards.find((d) => d.isDefault);
  const defaultId = defaultDashboard?.id ?? currentDashboardId ?? '';
  const shownId = plan?.dashboardId && exists(plan.dashboardId) ? plan.dashboardId : defaultId;
  const sameAsNew = `Same as new screens (${dashboardName(defaultId)})`;
  const normallyName = plan?.dashboardId && exists(plan.dashboardId) ? dashboardName(plan.dashboardId) : dashboardName(defaultId);
  /** Open another dashboard in the editor, when it is not the one open; it opens on this tab. */
  const openButton = (id: string) => {
    const target = allDashboards.find((d) => d.id === id);
    if (!target?.slug || target.id === currentDashboardId) return null;
    return (
      <button type="button" className={chip(false)} data-dashboard-open={target.id}
        onClick={() => { keepPanelFor(target.id, 'screen'); onSwitchDashboard?.(target.slug!); }}>
        Open {target.name}
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
    if (unnamed) { setAskName('add'); return; }
    const from = Math.floor((new Date().getHours() * 60 + new Date().getMinutes()) / 15) * 15;
    if (another) add({ when: 'times', days: [...EVERY_DAY], from: hhmm(from), to: hhmm(from + 60), dashboardId: another.id });
  };
  const addBus = () => {
    if (unnamed) { setAskName('add'); return; }
    if (another) add({ when: 'bus', dashboardId: another.id });
  };
  // Read for every screen: bus time is offered only once a bus route is set up.
  const busRoutes = useBusRoutes(ownsDay);
  const busSetUp = (busRoutes?.length ?? 0) > 0;
  /** Turns a route on or off for a bus switch; with every route on, it follows every route, ones added later too. */
  const toggleRoute = (i: number, sw: BusSwitch, id: string) => {
    const all = (busRoutes ?? []).map((r) => r.id);
    const on = routesOf(sw, busRoutes ?? []).map((r) => r.id);
    const next = on.includes(id) ? on.filter((x) => x !== id) : all.filter((x) => x === id || on.includes(x));
    editSwitch(i, { routeIds: next.length === all.length ? undefined : next });
  };

  /** A bus switch's routes and days, short: "Morning 7:45 AM and Afternoon 3:30 PM, school days". */
  const routesInShort = (followed: BusRoute[]) => {
    const daysOf = (days: number[]) => (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d)) ? 'school days' : daysInWords(days));
    const route = (r: BusRoute) => `${r.label} ${clock(r.scheduledTime.slice(0, 5))}`;
    const first = daysOf(followed[0]!.activeDays);
    // Their days once when they share them, else each route with its own.
    if (followed.every((r) => daysOf(r.activeDays) === first)) return `${followed.map(route).join(' and ')}, ${first}`;
    return followed.map((r) => `${route(r)} ${daysOf(r.activeDays)}`).join(', ');
  };
  /** What a switch does, in one line: its dashboard, when, and whether it stays awake. */
  const switchInShort = (sw: ScreenSwitch) => {
    const parts = [dashboardName(sw.dashboardId)];
    if (sw.when === 'bus') {
      const window = busWindowOf(sw);
      const followed = routesOf(sw, busRoutes ?? []);
      if (!busRoutes) parts.push('at bus time');
      else if (busRoutes.length === 0) parts.push('no bus route set up yet');
      else if (followed.length === 0) parts.push('none of its routes is set up');
      else parts.push(routesInShort(followed));
      parts.push(`${window.before} min before to ${window.after} after each run`);
    } else {
      parts.push(`${sw.days.length === 7 ? 'Every day' : daysInWords(sw.days)}, ${sw.from === sw.to ? 'all day' : `${clock(sw.from)} to ${clock(sw.to)}`}`);
    }
    if (staysAwake(sw)) parts.push('stays awake');
    return parts.join(' · ');
  };
  // Which rows a higher one covers, through the week.
  const coverage = useMemo(() => switchCoverage(switches, busRoutes ?? [], (id) => allDashboards.some((d) => d.id === id)),
    [switches, busRoutes, allDashboards]);
  const rowLabel = (j: number) => `${kindName(switches[j]!)} (${dashboardName(switches[j]!.dashboardId)})`;
  const coveredInWords = (i: number) => {
    const c = coverage[i];
    if (!c || c.by.length === 0) return null;
    if (c.shows === 'never') return `Covered by ${rowLabel(c.by[0]!)} above, so it never shows.`;
    if (c.shows === 'partly') return `${rowLabel(c.by[0]!)} above wins where they overlap.`;
    return null;
  };

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

  /** Makes the dashboard named in a row's New dashboard... and switches the row to it. */
  const makeDashboard = async () => {
    if (!making || !making.name.trim() || !onNewDashboard) return;
    setMaking({ ...making, busy: true });
    const id = await onNewDashboard(making.name.trim());
    if (id) editSwitch(making.row, { dashboardId: id });
    setMaking(id ? null : { ...making, busy: false });
  };

  const switchRow = (sw: ScreenSwitch, i: number) => (
    <ShowsRow key={i} swatch={i} name={kindName(sw)} summary={switchInShort(sw)} covered={coveredInWords(i)}
      open={openRow === i} onToggle={() => toggle(i)} data-switch-row={i} data-switch={sw.when}>
      <span className="flex flex-wrap items-center gap-2 text-body">
        Shows
        <select className={cn(field, 'min-w-0 max-w-full')} value={making?.row === i ? NEW_DASHBOARD : sw.dashboardId} aria-label="Switches to"
          onChange={(e) => {
            if (e.target.value === NEW_DASHBOARD) setMaking({ row: i, name: '', busy: false });
            else { setMaking(null); editSwitch(i, { dashboardId: e.target.value }); }
          }}>
          {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          {onNewDashboard && <option value={NEW_DASHBOARD}>New dashboard...</option>}
        </select>
      </span>
      {making?.row === i && (
        <form className="flex flex-wrap items-center gap-2" data-new-dashboard
          onSubmit={(e) => { e.preventDefault(); void makeDashboard(); }}>
          <input className={cn(field, 'min-w-0 flex-1')} aria-label="Name of the new dashboard" placeholder="Bus board" maxLength={NAME_MAX} autoFocus
            value={making.name} disabled={making.busy} onChange={(e) => setMaking({ ...making, name: e.target.value })} />
          <button type="submit" className={chip(true)} disabled={making.busy || !making.name.trim()}>Make it</button>
          <button type="button" className={chip(false)} onClick={() => setMaking(null)}>Cancel</button>
        </form>
      )}
      {sw.when === 'bus' ? busDetails(sw, i) : (
        <>
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
                <button key={d} type="button" aria-label={DAY_FULL[d]} aria-pressed={on}
                  // A switch keeps at least one day; Remove takes it away.
                  disabled={on && sw.days.length === 1}
                  onClick={() => editSwitch(i, { days: on ? sw.days.filter((x) => x !== d) : [...sw.days, d].sort() })}
                  className={dayChip(on)} data-day-chip={d}>
                  {DAY_NAMES[d]}
                </button>
              );
            })}
          </div>
        </>
      )}
      {/* While it is in force the screen does not go idle, and wakes if it was (#1347). */}
      <label className="flex items-center gap-2 text-body" data-switch-awake>
        <Switch checked={staysAwake(sw)} onCheckedChange={(on) => editSwitch(i, { staysAwake: on })} />
        Stays awake
      </label>
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
    </ShowsRow>
  );

  // The screen's day: its looks and night rule as being edited.
  const pair = asDayAndNight(idleBackground ?? backgroundOf(DEFAULT_SCREEN_DAY));
  const rule = pair.switch;
  const change = (patch: Partial<typeof pair>) => onIdleBackgroundChange?.(simplest({ ...pair, ...patch }));
  const { lat, lon, guessed } = useSkyLocation(rule.by === 'sun');
  // Today, as it was when the tab opened, so the strip stays put.
  const [today] = useState(() => new Date());
  const minuteNow = useMinuteNow();
  let weekday = today.getDay();
  try { weekday = weekdayOfKey(todayKey(householdTimezone, today)); } catch { /* the screen's own day */ }
  const nights = nightSpans(today, rule, lat, lon);
  const spans = switchSpans(switches, weekday, busRoutes ?? []);
  const night = tonight(today, rule, lat, lon);
  const time = (d: Date) => clock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  const nightRange = rule.by === 'clock' ? `${clock(rule.from)} to ${clock(rule.to)}` : 'dusk to dawn';
  const neverIdles = timeout <= 0 || !canIdle;
  const nightLevel = Math.round(Number(dim) * 100);

  const name = screenId ? screens?.find((s) => s.id === screenId)?.name ?? null : null;
  const sentence = screenSentence({
    name,
    normally: normallyName,
    switches,
    dashboardName: (id) => (exists(id) ? dashboardName(id) : null),
    routes: busRoutes,
    background: simplest(pair),
    nightLevel,
    idleAfter: timeout,
    canIdle,
    clock,
  });

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
  const nameFirst = onDeviceNamed && (
    <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3" data-name-first>
      <p className="m-0 text-body">Name this screen first. What it shows and its times are kept with its name.</p>
      <NameThisDevice shows={dashboardName(defaultId)} onNamed={onDeviceNamed} chip={chip} field={field} autoOpen />
    </div>
  );
  const scope = screenId ? (name ? `${name} · This screen` : 'This screen') : unnamed ? 'Not named yet · This screen' : 'No screen';

  return (
    <div className="flex flex-col gap-5 pointer-fine:gap-4" data-screen-sheet>
      <p className={HEADING} data-screen-scope>{scope}</p>
      {ownsDay && (
        <>
          <p className="m-0 rounded-xl bg-muted/60 px-3.5 py-3 text-body leading-relaxed" aria-live="polite" data-screen-sentence>{sentence}</p>
          <DayStrip nights={nights} spans={spans} now={minuteNow} tick={(m) => clock(hhmm(m))}
            caption={`Today. Shaded: night (${nightRange}). Line: now.`} />
        </>
      )}
      {!ownsDay && (
        <p className="m-0 text-body text-muted-foreground" data-no-screen>
          No screen is being edited, so this edits {dashboardName(currentDashboardId)} on its own. A screen&apos;s day is set in that screen&apos;s editor.
        </p>
      )}

      {ownsDay && (
        <section className="flex flex-col" aria-labelledby={fieldId('shows')} data-screen-plan>
          <h3 id={fieldId('shows')} className={cn(HEADING, 'mb-1')} data-screen-heading>Shows</h3>
          <ShowsRow swatch={-1} name="Normally" summary={plan?.dashboardId && exists(plan.dashboardId) ? normallyName : sameAsNew}
            open={openRow === 'normally'} onToggle={() => { toggle('normally'); if (unnamed) setAskName('normally'); }} data-normally-row>
            {plan ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Select id={fieldId('dashboard')} aria-label="Normally" value={plan.dashboardId && exists(plan.dashboardId) ? plan.dashboardId : ''} data-screen-dashboard
                  onChange={(e) => onScreenPlanChange?.({ ...plan, dashboardId: e.target.value || null })}>
                  <option value="">{sameAsNew}</option>
                  {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                {openButton(shownId)}
              </div>
            ) : unnamed && askName === 'normally' ? nameFirst : null}
            {plan && <p className={note}>Same as new screens follows what Settings &gt; Screens sets for new and unnamed screens.</p>}
          </ShowsRow>
          {switches.map(switchRow)}
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <button type="button" className={cn(chip(false), 'border-dashed')} onClick={addTimes} disabled={!unnamed && full} data-switch-add="times">
              <Plus className="mr-1 h-4 w-4" aria-hidden />Add a time
            </button>
            {/* Only with bus tracking set up; a bus switch made before still shows above. */}
            {busSetUp && (
              <button type="button" className={cn(chip(false), 'border-dashed')} onClick={addBus} disabled={!unnamed && full} data-switch-add="bus">
                <Plus className="mr-1 h-4 w-4" aria-hidden />Add bus time
              </button>
            )}
          </div>
          {unnamed && askName === 'add' && <div className="pt-2">{nameFirst}</div>}
          <p className={cn(note, 'pt-2')} data-shows-note>Higher rows win where times overlap. Times are in the household time zone.</p>
        </section>
      )}

      {ownsDay && (
        <section className="flex flex-col gap-3" aria-labelledby={fieldId('idle')} data-screen-own>
          <h3 id={fieldId('idle')} className={HEADING} data-screen-heading>When idle</h3>
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-2.5">
            <label htmlFor={fieldId('after')} className="text-body font-medium">Idle after</label>
            <div className="max-w-[12rem]">
              <Select id={fieldId('after')} value={timeout} data-idle-after onChange={(e) => setTimeout(Number(e.target.value))}>
                {SCREENSAVER_TIMEOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{IDLE_AFTER_SHORT[o.value] ?? o.label}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2" data-idle-grid>
            <span />
            <span className="text-caption font-medium text-muted-foreground" data-idle-head="day">By day</span>
            <span className={cn('text-caption font-medium', neverIdles ? 'text-muted-foreground/50' : 'text-muted-foreground')} data-idle-head="night">
              At night ({nightRange})
            </span>
            <span className="text-body font-medium">It shows</span>
            <Select aria-label="By day it shows" value={pair.day} disabled={neverIdles} data-idle-day
              onChange={(e) => {
                const look = e.target.value as IdleSource;
                // At night the same as by day follows it.
                change(pair.night === pair.day ? { day: look, night: look } : { day: look });
                onShowIdle?.(false);
              }}>
              {LOOKS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <Select aria-label="At night it shows" value={pair.night === pair.day ? SAME : pair.night} disabled={neverIdles} data-idle-night
              onChange={(e) => { change({ night: e.target.value === SAME ? pair.day : e.target.value as IdleSource }); onShowIdle?.(true); }}>
              <option value={SAME}>Same as by day</option>
              {[...LOOKS, ...NIGHT_ONLY].filter((o) => o.value !== pair.day).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <span className="text-body font-medium">Darker</span>
            <span className="pl-3 text-muted-foreground" aria-hidden>·</span>
            {!neverIdles && pair.night !== 'off' ? (
              // Only how much darker: the look is the screen's own choice beside it (#1345).
              <Select aria-label="Darker at night" value={dim} data-idle-darker
                onChange={(e) => { setDim(e.target.value); onShowIdle?.(true); }}>
                {NIGHT_LEVELS.map((l) => <option key={l} value={String(l / 100)}>{l === 0 ? 'Not darker' : `${l}%`}</option>)}
              </Select>
            ) : <span className="pl-3 text-muted-foreground" aria-hidden>·</span>}
          </div>
          {neverIdles && (
            <p className="m-0 rounded-lg bg-muted/60 px-3 py-2 text-body text-muted-foreground" data-never-idles>
              {canIdle ? 'This screen never idles, so it has no night look.' : 'This screen is too narrow to idle, so it has no idle or night look.'}
            </p>
          )}
          {!neverIdles && (pair.day === 'photos' || pair.night === 'photos') && onArrangePhotoFrame && (
            <button type="button" className={cn(chip(false), 'self-start')} data-arrange-photo-frame
              onClick={() => onArrangePhotoFrame(pair.day !== 'photos')}>
              Arrange the photo frame
            </button>
          )}
          <p className={note} data-night-note>Night changes how the screen idles. To show a different dashboard in the evening, add a time above.</p>
          {/* Out of the fold, so why Done is refused shows with it closed. */}
          {idleCheck.crossed && (
            <p role="alert" className="m-0 text-body text-destructive" data-idle-crossed>
              With these offsets night would end before it starts around{' '}
              {idleCheck.crossed.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}. Make them smaller to keep them.
            </p>
          )}
          {rule.by === 'clock' && rule.from === rule.to && (
            <p role="alert" className="m-0 text-body text-destructive" data-idle-crossed>Night must start and end at different times.</p>
          )}
          <Disclosure label="Advanced: when night is, photo frame motion and timing" data-idle-advanced>
            <div className="grid grid-cols-1 items-center gap-x-3 gap-y-1 text-body sm:grid-cols-[10rem_minmax(0,1fr)]">
              <label htmlFor={fieldId('night-rule')}>Night is</label>
              <Select id={fieldId('night-rule')} value={rule.by} data-night-when
                onChange={(e) => change({ switch: e.target.value === 'clock' ? SET_TIMES : DEFAULT_NIGHT })}>
                <option value="sun">Dusk to dawn</option>
                <option value="clock">Set times</option>
              </Select>
            </div>
            {rule.by === 'clock' ? (
              <span className="flex flex-wrap items-center gap-2 text-body" data-night-edges>
                From
                <input type="time" className={field} value={rule.from} aria-label="Night starts"
                  onChange={(e) => e.target.value && change({ switch: { ...rule, from: e.target.value } })} />
                to
                <input type="time" className={field} value={rule.to} aria-label="Night ends"
                  onChange={(e) => e.target.value && change({ switch: { ...rule, to: e.target.value } })} />
              </span>
            ) : (
              <div className="flex flex-col gap-2 pointer-fine:gap-1.5" data-night-edges>
                {night && (
                  <p className="m-0 text-body text-muted-foreground" data-night-times>
                    Tonight <span data-night-start>{time(night.start)}</span> to <span data-night-end>{time(night.end)}</span>
                    {guessed && ', guessed from the time zone until a location is set in Settings > General'}.
                  </p>
                )}
                <OffsetInput label="Starts" edge="dusk" minutes={rule.duskOffset} order={['after', 'before']}
                  onChange={(m) => change({ switch: { ...rule, duskOffset: m } })} />
                <OffsetInput label="Ends" edge="dawn" minutes={rule.dawnOffset} order={['before', 'after']}
                  onChange={(m) => change({ switch: { ...rule, dawnOffset: m } })} />
              </div>
            )}
            <PhotoFrameMotion />
          </Disclosure>
        </section>
      )}

      <Disclosure label="This screen: light or dark, photos behind the dashboard" defaultOpen data-screen-look>
        <div className="grid grid-cols-1 items-center gap-x-3 gap-y-1 text-body sm:grid-cols-[10rem_minmax(0,1fr)]">
          <label htmlFor={fieldId(draft === null ? 'pick' : 'name')}>Screen</label>
          {draft === null ? (
            <div className="flex min-w-0 items-center gap-2">
              <Select id={fieldId('pick')} value={screenId ?? ''} data-screen-pick
                onChange={(e) => { if (e.target.value && e.target.value !== screenId) onPickScreen?.(e.target.value); }}>
                {!screenId && <option value="">{deviceNamed ? 'No screen' : 'Not named yet'}</option>}
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
        </div>
        {problem && <p role="alert" className="m-0 text-body text-destructive">{problem}</p>}
        {ownsDay && (
          <>
            <div className="grid grid-cols-1 items-center gap-x-3 gap-y-1 text-body sm:grid-cols-[10rem_minmax(0,1fr)]">
              <span id={fieldId('mode')}>Light or dark</span>
              <div role="radiogroup" aria-labelledby={fieldId('mode')} className="flex w-fit rounded-lg bg-muted p-0.5" data-screen-mode>
                {(['light', 'dark'] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} data-mode={m}
                    onClick={() => writeStored(THEME_KEY, m)}
                    className={cn('min-h-[40px] rounded-md px-4 text-body pointer-fine:min-h-8 pointer-fine:px-3',
                      mode === m ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground')}>
                    {m === 'light' ? 'Light' : 'Dark'}
                  </button>
                ))}
              </div>
            </div>
            <label className="grid grid-cols-1 items-center gap-x-3 gap-y-1 text-body sm:grid-cols-[10rem_minmax(0,1fr)]">
              <span>Photos behind the dashboard</span>
              <Switch aria-label="Photos behind the dashboard" checked={photosOn} data-screen-photos
                onCheckedChange={(on) => writeStored(WALLPAPER_KEY, on ? 'true' : 'false')} />
            </label>
            {photosOn && (
              <div className="grid grid-cols-1 items-center gap-x-3 gap-y-1 text-body sm:grid-cols-[10rem_minmax(0,1fr)]">
                <label htmlFor={fieldId('rotate')}>New photo every</label>
                <Select id={fieldId('rotate')} value={rotate} onChange={(e) => writeStored(WALLPAPER_INTERVAL_KEY, e.target.value)}>
                  {WALLPAPER_INTERVALS.map(([s, label]) => <option key={s} value={String(s)}>{label}</option>)}
                </Select>
              </div>
            )}
          </>
        )}
      </Disclosure>

      {ownsDay && (
        <Disclosure label="Advanced: orientation, performance, keyboard, auto-hide, sign out, notices" data-screen-advanced>
          <ScreenOptions />
        </Disclosure>
      )}
    </div>
  );
}
