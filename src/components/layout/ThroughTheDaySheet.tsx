'use client';

/**
 * The editing panel's Through the day sheet (#1152), as plain rows (#1281).
 *
 * In a screen's editor: the dashboard the screen shows, and the dashboards it
 * switches to for a while (#1282), at bus time or at set times, each a row.
 * They belong to the screen, and Done sends them to it with its settings. On
 * a device nobody named, the sheet offers to name it instead (#1267).
 *
 * Then the dashboard's own day: what it shows while resting, when night is
 * and what it shows then. It belongs to the dashboard, so every screen
 * showing it rests and sleeps the same way, and Done saves it with the
 * dashboard. How long until the screen rests and how dark it goes are the
 * screen's own, shown only when the editor is for a screen.
 *
 * See it, first, shows the canvas in use, resting or at night; with Resting
 * or Night chosen, Widgets arranges what shows over the photos or the sky.
 * Every row has its name in one column and its choices in the next, so they
 * line up and wrap within their own column.
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { ArrowUp, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { formatTimeOfDay } from '@/components/calendar/cells/itemTime';
import { ScreensaverSettingsPanel } from '@/components/screensaver/ScreensaverQuickSettings';
import { useSkyLocation } from '@/components/screensaver/useIdleBackground';
import { DIM_LEVELS, useIdleDimSetting } from '@/components/screensaver/idleDim';
import { SCREENSAVER_TIMEOUT_OPTIONS, useScreensaverTimeout } from '@/lib/hooks/useScreensaverTimeout';
import { sameIdleBackground, tonight, type IdleBackground, type IdleSource, type IdleSwitch } from '@/lib/idleBackground';
import { asDayAndNight, DEFAULT_NIGHT, type ScreenState } from '@/lib/throughTheDay';
import {
  BUS_AFTER_MINUTES, BUS_BEFORE_MINUTES, daysShort, EVERY_DAY, MAX_SWITCHES,
  type ScreenPlan, type ScreenSwitch,
} from '@/lib/screenSwitches';
import type { IdleHalf, EditTab } from '@/components/dashboard/useDashboardLayout';
import { OffsetInput } from './IdleBackgroundBar';
import { NameThisDevice } from './NameThisDevice';
import type { IdleSwitchCheck } from './useIdleSwitchCheck';
import type { DashboardInfo } from './LayoutEditorTypes';
import { cn } from '@/lib/utils';

const RESTING: { value: IdleSource; label: string }[] = [
  { value: 'dashboard', label: 'This dashboard' },
  { value: 'photos', label: 'Photos' },
  { value: 'sky', label: 'Night sky' },
];
const NIGHT_LOOKS: { value: IdleSource; label: string }[] = [
  { value: 'dashboard', label: 'Dim this dashboard' },
  { value: 'sky', label: 'Night sky' },
  { value: 'photos', label: 'Photos' },
  { value: 'off', label: 'Screen off' },
];
const SET_TIMES: IdleSwitch = { by: 'clock', from: '21:00', to: '06:30' };
const SEE_IT: { state: ScreenState; label: string }[] = [
  { state: 'active', label: 'In use' },
  { state: 'resting', label: 'Resting' },
  { state: 'night', label: 'Night' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** The day chips, Monday first as a week is read. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_MINUTES = 24 * 60;

// Each control is a 44px target for a finger on the wall, and 32px with a
// mouse, where editing is done (the laptop), so the panel stays light beside
// the canvas. With a mouse every control's words are one size, 12px, and
// sentences and fields 14px.
const chip = (on: boolean) => cn(
  'flex min-h-[48px] items-center rounded-full border-[1.5px] px-4 text-body transition-colors pointer-fine:min-h-8 pointer-fine:border pointer-fine:px-2.5 pointer-fine:text-caption pointer-fine:font-medium',
  on ? 'border-foreground bg-foreground text-background' : 'border-foreground/30 hover:bg-muted',
);
/** A day: a 44px circle by touch; with a mouse the seven share their row in equal widths, so Mon and Wed fit like the rest. */
const dayChip = (on: boolean) => cn(
  'flex h-[44px] w-[44px] items-center justify-center rounded-full text-caption font-medium disabled:opacity-100 pointer-fine:h-8 pointer-fine:w-auto pointer-fine:min-w-0 pointer-fine:flex-1',
  // Both with a border, so on and off share a row in equal widths.
  on ? 'border border-foreground bg-foreground text-background' : 'border border-foreground/30 text-muted-foreground',
);
const field = 'min-h-[44px] rounded-lg border border-border bg-background px-2 text-body pointer-fine:min-h-9';
/** The column of row names: wide enough for "At set times" at the desk's 14px. */
const NAME_COLUMN = 'grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 text-body';
/** A small round button beside a row (move up, remove). */
const iconButton = 'flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 pointer-fine:h-8 pointer-fine:w-8';
const note = 'm-0 text-caption text-muted-foreground';

/** "HH:MM" for a time on the display's own clock. */
const clockOf = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
/** "HH:MM" for a minute of the day, wrapping past midnight. */
const hhmm = (minute: number) => {
  const m = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * Back to the plainest form that means the same: one background when it is
 * the same by day and night on the default rule, so a dashboard nobody set a
 * night for is stored as before.
 */
export function simplest(pair: { day: IdleSource; night: IdleSource; switch: IdleSwitch }): IdleBackground {
  const single: IdleBackground = { source: pair.day };
  if (pair.day === pair.night && sameIdleBackground({ ...pair }, { day: pair.day, night: pair.day, switch: DEFAULT_NIGHT })) return single;
  return pair;
}

/**
 * A row: its name in a column of its own, so the choices of every row start at
 * one edge, and wrap within their own column, never under the name.
 */
function Row({ name, children, ...rest }: { name: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={NAME_COLUMN} {...rest}>
      <span className="self-start pt-2.5 font-medium pointer-fine:pt-2" data-row-name>{name}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5" data-row-choices>{children}</div>
    </div>
  );
}

/** The bus routes' windows in words, "Mon–Fri 7:15 am to 8:00 am", once read; null before. */
function useBusWindows(wanted: boolean, clock: (hhmm: string) => string): string | null {
  const [routes, setRoutes] = useState<Array<{ scheduledTime: string; activeDays: number[] }> | null>(null);
  useEffect(() => {
    if (!wanted || routes) return;
    let live = true;
    void (async () => {
      const res = await fetch('/api/bus-tracking/status').catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (!live) return;
      setRoutes(((data?.routes ?? []) as Array<{ scheduledTime?: string; activeDays?: number[] }>)
        .flatMap((r) => (typeof r.scheduledTime === 'string' && Array.isArray(r.activeDays) ? [{ scheduledTime: r.scheduledTime, activeDays: r.activeDays }] : [])));
    })();
    return () => { live = false; };
  }, [wanted, routes]);
  if (!routes) return null;
  if (routes.length === 0) return 'No bus route is set up yet, so this never switches. Add one in Settings > Bus.';
  return busWindowsInWords(routes, clock);
}

/**
 * The windows bus routes switch a screen for, grouped by their days and in
 * time order: "Mon–Fri 7:15 am to 8:00 am, 3:00 pm to 3:45 pm".
 */
export function busWindowsInWords(routes: Array<{ scheduledTime: string; activeDays: number[] }>, clock: (hhmm: string) => string): string {
  const minute = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const byDays = new Map<string, number[]>();
  for (const r of routes) {
    const days = daysShort(r.activeDays);
    const due = minute(r.scheduledTime);
    const at = byDays.get(days) ?? [];
    if (!at.includes(due)) at.push(due);
    byDays.set(days, at);
  }
  return [...byDays.entries()]
    .map(([days, dues]) => `${days} ${dues.sort((a, b) => a - b)
      .map((due) => `${clock(hhmm(due - BUS_BEFORE_MINUTES))} to ${clock(hhmm(due + BUS_AFTER_MINUTES))}`).join(', ')}`)
    .join('; ');
}

export function ThroughTheDaySheet({
  idleBackground, onIdleBackgroundChange, idleHalf, onIdleHalfChange, editTab, onEditTabChange, idleCheck,
  allDashboards = [], currentDashboardId, onSwitchDashboard,
  screenPlan = null, onScreenPlanChange, screenId = null, forScreen = true, deviceNamed = true, onDeviceNamed,
}: {
  idleBackground?: IdleBackground;
  onIdleBackgroundChange?: (bg: IdleBackground) => void;
  idleHalf: IdleHalf;
  onIdleHalfChange?: (h: IdleHalf) => void;
  editTab: EditTab;
  onEditTabChange?: (tab: EditTab) => void;
  idleCheck: IdleSwitchCheck;
  allDashboards?: DashboardInfo[];
  currentDashboardId?: string;
  onSwitchDashboard?: (slug: string) => void;
  /** In a screen's editor, the dashboard it shows and its switches; null hides them. */
  screenPlan?: ScreenPlan | null;
  onScreenPlanChange?: (plan: ScreenPlan) => void;
  /** The named screen being edited, or null for a dashboard on its own. */
  screenId?: string | null;
  /** The editor is for a screen (this one, or one edited from here), so its own settings show. */
  forScreen?: boolean;
  /** The device in use has a name; one that has none is offered one here. */
  deviceNamed?: boolean;
  /** The device in use was just named, as this screen. */
  onDeviceNamed?: (displayId: string) => void;
}) {
  const { timeFormat } = useTimeFormat();
  const [moreOpen, setMoreOpen] = useState(false);
  const [motionOpen, setMotionOpen] = useState(false);
  const { timeout, setTimeout } = useScreensaverTimeout();
  const { level: dim, setLevel: setDim } = useIdleDimSetting();

  // Which dashboard shows when is the screen's, so only a screen's editor has it.
  const plan = screenId ? screenPlan : null;
  const switches = plan?.switches ?? [];

  const pair = asDayAndNight(idleBackground ?? { source: 'photos' });
  const rule = pair.switch;
  const { lat, lon, guessed } = useSkyLocation(rule.by === 'sun');
  const time = (d: Date) => formatTimeOfDay(clockOf(d), timeFormat);
  const night = tonight(new Date(), rule, lat, lon);

  const state: ScreenState = editTab !== 'idle' ? 'active' : idleHalf === 'night' ? 'night' : 'resting';
  const show = (s: ScreenState) => {
    if (s === 'active') { onEditTabChange?.('dashboard'); return; }
    onEditTabChange?.('idle');
    onIdleHalfChange?.(s === 'night' ? 'night' : 'day');
  };
  const change = (patch: Partial<typeof pair>) => onIdleBackgroundChange?.(simplest({ ...pair, ...patch }));

  const exists = (id: string) => allDashboards.some((d) => d.id === id);
  const dashboardName = (id: string | undefined) => allDashboards.find((d) => d.id === id)?.name ?? 'this dashboard';
  const defaultId = allDashboards.find((d) => d.isDefault)?.id ?? currentDashboardId ?? '';
  const shownId = plan?.dashboardId && exists(plan.dashboardId) ? plan.dashboardId : defaultId;
  /** Open another dashboard in the editor, when it is not the one open. */
  const openButton = (id: string) => {
    const target = allDashboards.find((d) => d.id === id);
    if (!target?.slug || target.id === currentDashboardId) return null;
    return (
      <button type="button" className={chip(false)} onClick={() => onSwitchDashboard?.(target.slug!)} data-dashboard-open={target.id}>
        Open
      </button>
    );
  };

  // The screen's switches, kept on the editor page until Done.
  const saveSwitches = (next: ScreenSwitch[]) => { if (plan) onScreenPlanChange?.({ ...plan, switches: next }); };
  const editSwitch = (i: number, patch: Partial<ScreenSwitch>) =>
    saveSwitches(switches.map((sw, j) => (j === i ? { ...sw, ...patch } as ScreenSwitch : sw)));
  /** Moves a switch up the order that decides which wins an overlap. */
  const moveUp = (i: number) => {
    const next = [...switches];
    const [sw] = next.splice(i, 1);
    next.splice(i - 1, 0, sw!);
    saveSwitches(next);
  };
  /** A dashboard to switch to: the first that is not the one the screen shows. */
  const another = allDashboards.find((d) => d.id !== shownId) ?? allDashboards[0];
  const full = switches.length >= MAX_SWITCHES || !another;
  const hasBus = switches.some((sw) => sw.when === 'bus');
  const addTimes = () => {
    const now = new Date();
    const from = Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
    if (another) saveSwitches([...switches, { when: 'times', days: [...EVERY_DAY], from: hhmm(from), to: hhmm(from + 60), dashboardId: another.id }]);
  };
  const addBus = () => { if (another) saveSwitches([...switches, { when: 'bus', dashboardId: another.id }]); };
  const busWindows = useBusWindows(hasBus, (t) => formatTimeOfDay(t, timeFormat));

  const switchRow = (sw: ScreenSwitch, i: number) => (
    <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 pointer-fine:gap-1.5 pointer-fine:p-2" data-switch-row={i} data-switch={sw.when}>
      <Row name={sw.when === 'bus' ? 'At bus time' : 'At set times'}>
        <select className={cn(field, 'min-w-0 max-w-full')} value={sw.dashboardId} aria-label="Switches to" onChange={(e) => editSwitch(i, { dashboardId: e.target.value })}>
          {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Row>
      {sw.when === 'bus' ? (
        <p className={note} data-bus-windows>
          {busWindows ?? `From ${BUS_BEFORE_MINUTES} minutes before each bus route's time at the stop to ${BUS_AFTER_MINUTES} minutes after, on its days.`}
        </p>
      ) : (
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
        <button type="button" className={cn(chip(false), 'ml-auto')} data-switch-remove
          onClick={() => saveSwitches(switches.filter((_, j) => j !== i))}>
          <X className="mr-1 h-4 w-4" aria-hidden />Remove
        </button>
      </div>
    </div>
  );

  const lookName = dashboardName(currentDashboardId);

  return (
    <div className="flex flex-col gap-5 pointer-fine:gap-4" data-day-sheet data-day-shows={state}>
      {/* See it: the canvas in use, resting or at night, first so it is always in reach. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4 pointer-fine:gap-1.5 pointer-fine:pb-3" role="radiogroup" aria-label="See it" data-see-it>
        <span className="pr-1 font-medium text-body">See it</span>
        {SEE_IT.map((s) => (
          <button key={s.state} type="button" role="radio" aria-checked={state === s.state} className={chip(state === s.state)}
            onClick={() => show(s.state)} data-see={s.state}>
            {s.label}
          </button>
        ))}
      </div>

      {plan && (
        // What the screen shows, and when it switches to another, as rows.
        <section className="flex flex-col gap-3 border-b border-border pb-5 pointer-fine:gap-2 pointer-fine:pb-4" aria-label="What this screen shows" data-screen-plan>
          <Row name="Shows">
            <select className={cn(field, 'min-w-0 max-w-full')} value={shownId} aria-label="Dashboard this screen shows" data-screen-dashboard
              onChange={(e) => onScreenPlanChange?.({ ...plan, dashboardId: e.target.value })}>
              {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {openButton(shownId)}
          </Row>
          {switches.map(switchRow)}
          {switches.length > 1 && <p className={note}>If two overlap, the higher one wins.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={chip(false)} onClick={addBus} disabled={full || hasBus} data-switch-add="bus">
              <Plus className="mr-1 h-4 w-4" aria-hidden />Switch at bus time
            </button>
            <button type="button" className={chip(false)} onClick={addTimes} disabled={full} data-switch-add="times">
              <Plus className="mr-1 h-4 w-4" aria-hidden />Switch at set times
            </button>
          </div>
          <p className={note}>Done saves these to this screen. Times are in the household time zone.</p>
        </section>
      )}
      {!screenId && !deviceNamed && onDeviceNamed && (
        <section className="border-b border-border pb-5 pointer-fine:pb-4" aria-label="Name this device">
          <NameThisDevice shows={dashboardName(defaultId)} onNamed={onDeviceNamed} chip={chip} field={field} />
        </section>
      )}

      {/* The dashboard's own day: what it shows resting and at night, and when night is. */}
      <section className="flex flex-col gap-3 pointer-fine:gap-2" aria-label="Resting and night" data-day-look>
        <Row name="Resting">
          <select className={field} value={pair.day} aria-label="While resting" data-resting-look
            onChange={(e) => { change({ day: e.target.value as IdleSource }); show('resting'); }}>
            {RESTING.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
        <Row name="At night">
          <select className={field} value={pair.night} aria-label="Night look" data-night-look
            onChange={(e) => {
              const look = e.target.value as IdleSource;
              change({ night: look });
              // Dimming a screen that is set not to dim would show no change.
              if (forScreen && look === 'dashboard' && dim === '0') setDim('0.5');
              show('night');
            }}>
            {NIGHT_LOOKS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
        <Row name="Night is">
          <select className={field} value={rule.by} aria-label="When night is" data-night-when
            onChange={(e) => { change({ switch: e.target.value === 'clock' ? SET_TIMES : DEFAULT_NIGHT }); show('night'); }}>
            <option value="sun">Dusk to dawn</option>
            <option value="clock">Set times</option>
          </select>
          {rule.by === 'sun' && night && (
            <p className="m-0 basis-full text-body text-muted-foreground" data-night-times>
              Tonight <span data-night-start>{time(night.start)}</span> to <span data-night-end>{time(night.end)}</span>
              {guessed && ', guessed from the time zone until a location is set in Settings > General'}.
            </p>
          )}
        </Row>
        {/* When night starts and ends, under its row at the panel's whole
            width, so each edge stays on one line in a narrow panel. */}
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
            <OffsetInput label="Starts" edge="dusk" minutes={rule.duskOffset} order={['after', 'before']}
              onChange={(m) => change({ switch: { ...rule, duskOffset: m } })} />
            <OffsetInput label="Ends" edge="dawn" minutes={rule.dawnOffset} order={['before', 'after']}
              onChange={(m) => change({ switch: { ...rule, dawnOffset: m } })} />
          </div>
        )}

        {idleCheck.crossed && (
          <p role="alert" className="m-0 text-body text-destructive" data-idle-crossed>
            With these offsets night would end before it starts around{' '}
            {idleCheck.crossed.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}. Make them smaller to keep them.
          </p>
        )}
        {rule.by === 'clock' && rule.from === rule.to && (
          <p role="alert" className="m-0 text-body text-destructive" data-idle-crossed>Night must start and end at different times.</p>
        )}
        <p className={note} data-day-shared>
          Every screen showing {lookName} rests and sleeps this way. Done saves it with the dashboard.
        </p>
      </section>

      {forScreen && (
        // How soon it rests and how dark it goes are the screen's own, kept
        // with its other settings.
        <section className="flex flex-col gap-3 border-t border-border pt-4 pointer-fine:gap-2 pointer-fine:pt-3" aria-label="On this screen" data-day-screen>
          <p className={cn(note, 'font-medium')}>On this screen</p>
          <Row name="Rest after">
            <select className={field} value={timeout} onChange={(e) => setTimeout(Number(e.target.value))} aria-label="Rest after">
              {SCREENSAVER_TIMEOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === 0 ? 'Never rests' : o.label}</option>)}
            </select>
            <span className={note}>of nobody touching it</span>
          </Row>
          {pair.night !== 'off' && (
            <Row name="How dark">
              <select className={field} value={dim} onChange={(e) => setDim(e.target.value)} aria-label="How dark at night">
                {DIM_LEVELS.map((l) => <option key={l.raw} value={l.raw}>{l.raw === '0' ? 'Not dimmed' : l.label}</option>)}
              </select>
              <span className={note}>at night</span>
            </Row>
          )}
        </section>
      )}

      <section>
        <button type="button" className={chip(moreOpen)} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} data-day-more>
          More
        </button>
        {moreOpen && (
          <div className="mt-4 flex flex-col gap-4 pointer-fine:mt-3 pointer-fine:gap-3">
            <p className="m-0 text-body text-muted-foreground">
              Photos and the night sky have their own arrangement: choose Resting or Night under See it, then Widgets.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(false)} onClick={() => setMotionOpen(true)}>Screensaver motion</button>
              <Link href="/settings?section=display" className={chip(false)}>Screen fit and performance</Link>
            </div>
          </div>
        )}
      </section>
      <ScreensaverSettingsPanel open={motionOpen} onClose={() => setMotionOpen(false)} />
    </div>
  );
}
