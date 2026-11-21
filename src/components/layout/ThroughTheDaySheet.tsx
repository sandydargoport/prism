'use client';

/**
 * The editing panel's Through the day sheet (#1152), as plain rows (#1281).
 *
 * For a screen: the timeline it follows (#1266), the dashboard it shows, and
 * the dashboards it switches to at set times, each a row with its days and
 * hours. A timeline keeps each change as soon as it is made.
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
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, MoreHorizontal, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { formatTimeOfDay } from '@/components/calendar/cells/itemTime';
import { ScreensaverSettingsPanel } from '@/components/screensaver/ScreensaverQuickSettings';
import { useSkyLocation } from '@/components/screensaver/useIdleBackground';
import { DIM_LEVELS, useIdleDimSetting } from '@/components/screensaver/idleDim';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { SCREENSAVER_TIMEOUT_OPTIONS, useScreensaverTimeout } from '@/lib/hooks/useScreensaverTimeout';
import { createTimeline, deleteTimeline, patchTimeline } from '@/lib/hooks/useTimelines';
import { sameIdleBackground, tonight, type IdleBackground, type IdleSource, type IdleSwitch } from '@/lib/idleBackground';
import { asDayAndNight, DEFAULT_NIGHT, type ScreenState } from '@/lib/throughTheDay';
import {
  copyName, EVERY_DAY, firstTimeline, MAX_PLACEMENTS, TIMELINE_NAME_MAX_LENGTH,
  type Placement, type Timeline,
} from '@/lib/timeline';
import type { IdleHalf, EditTab } from '@/components/dashboard/useDashboardLayout';
import { OffsetInput } from './IdleBackgroundBar';
import type { IdleSwitchCheck } from './useIdleSwitchCheck';
import type { DashboardInfo } from './LayoutEditorTypes';
import { cn } from '@/lib/utils';

export { daysInWords } from '@/lib/timeline';

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
/** One of a timeline's own actions, in the menu beside its dropdown. */
const menuItem = 'flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-body transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent pointer-fine:min-h-8 pointer-fine:px-2.5';
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

/** Who follows a timeline, in words, so a change that reaches several screens is known before it is made. */
function usedByText(t: Timeline, isFirst: boolean): string {
  const n = t.screens ?? 0;
  const screens = n === 0 ? '' : `${n} screen${n === 1 ? '' : 's'}`;
  if (isFirst) return n === 0 ? 'Used by every device not given another timeline.' : `Used by ${screens}, and every device not given another.`;
  if (n === 0) return 'No screen uses it yet.';
  return n === 1 ? 'Used by 1 screen.' : `Used by ${screens}. A change here changes all of them.`;
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

/** Naming a timeline: a new one, a copy of this one, or this one renamed. */
type Naming = { mode: 'new' | 'duplicate' | 'rename'; value: string };

export function ThroughTheDaySheet({
  idleBackground, onIdleBackgroundChange, idleHalf, onIdleHalfChange, editTab, onEditTabChange, idleCheck,
  allDashboards = [], currentDashboardId, onSwitchDashboard,
  timelines = [], timelineId, onTimelineChange, screenId = null, forScreen = true,
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
  /** The household's timelines, and the one this sheet edits. */
  timelines?: Timeline[];
  timelineId?: string;
  onTimelineChange?: (id: string) => void;
  /** The named screen being edited, which follows the timeline picked here; null hides the timeline. */
  screenId?: string | null;
  /** The editor is for a screen (this one, or one edited from here), so its own settings show. */
  forScreen?: boolean;
}) {
  const { timeFormat } = useTimeFormat();
  const [moreOpen, setMoreOpen] = useState(false);
  const [motionOpen, setMotionOpen] = useState(false);
  const { timeout, setTimeout } = useScreensaverTimeout();
  const { level: dim, setLevel: setDim } = useIdleDimSetting();
  const { confirm, dialogProps } = useConfirmDialog();

  // Which dashboard shows when is the screen's, so only a screen's editor has it.
  const timeline = screenId ? timelines.find((t) => t.id === timelineId) ?? null : null;
  const first = firstTimeline(timelines);
  const placements = timeline?.placements ?? [];

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
  const restOfDayId = timeline?.dashboardId && exists(timeline.dashboardId) ? timeline.dashboardId : defaultId;
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

  // A timeline keeps its placements as they change.
  const savePlacements = (next: Placement[]) => { if (timeline) void patchTimeline(timeline.id, { placements: next }); };
  const editPlacement = (i: number, patch: Partial<Placement>) => savePlacements(placements.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  /** Moves a placement up the order that decides which wins an overlap. */
  const moveUp = (i: number) => {
    const next = [...placements];
    const [p] = next.splice(i, 1);
    next.splice(i - 1, 0, p!);
    savePlacements(next);
  };
  const addPlacement = () => {
    const now = new Date();
    const from = Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
    const target = allDashboards.find((d) => d.id !== restOfDayId) ?? allDashboards[0];
    if (!target || !timeline) return;
    savePlacements([...placements, { days: [...EVERY_DAY], from: hhmm(from), to: hhmm(from + 60), dashboardId: target.id }]);
  };

  // Timelines themselves: new, duplicate, rename, delete, from a menu beside
  // the dropdown, as rarer than anything else here. It closes on a choice,
  // on Escape (back to its button) and on a press anywhere else.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const doc = menuRef.current?.ownerDocument ?? document;
    const away = (e: Event) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      menuRef.current?.querySelector<HTMLElement>('[data-timeline-menu]')?.focus();
    };
    doc.addEventListener('pointerdown', away);
    doc.addEventListener('keydown', key);
    return () => { doc.removeEventListener('pointerdown', away); doc.removeEventListener('keydown', key); };
  }, [menuOpen]);
  const choose = (then: () => void) => () => { setMenuOpen(false); then(); };
  const [naming, setNaming] = useState<Naming | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const finishNaming = async () => {
    if (!naming || !timeline) return;
    const name = naming.value.trim();
    if (!name) return;
    setProblem(null);
    if (naming.mode === 'rename') {
      if (!(await patchTimeline(timeline.id, { name }))) { setProblem('That name was not kept. Try again.'); return; }
    } else {
      const created = await createTimeline(naming.mode === 'duplicate' ? { copyOf: timeline.id, name } : { name });
      if (!created) { setProblem('The timeline was not added. Try again.'); return; }
      onTimelineChange?.(created.id);
    }
    setNaming(null);
  };
  const removeTimeline = async () => {
    if (!timeline || timelines.length < 2) return;
    const goesTo = timeline.id === first?.id ? timelines.find((t) => t.id !== timeline.id) : first;
    const n = timeline.screens ?? 0;
    const ok = await confirm(
      `Delete ${timeline.name}?`,
      n > 0
        ? `${n === 1 ? 'The screen on it follows' : `The ${n} screens on it follow`} ${goesTo?.name ?? 'the first timeline'} instead.`
        : 'No screen uses it.',
      { confirmLabel: 'Delete' },
    );
    if (!ok) return;
    if (!(await deleteTimeline(timeline.id))) { setProblem('The timeline was not deleted. Try again.'); return; }
    if (goesTo) onTimelineChange?.(goesTo.id);
  };

  const placementRow = (p: Placement, i: number) => (
    <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 pointer-fine:gap-1.5 pointer-fine:p-2" data-placement-row={i}>
      <Row name="At set times">
        <select className={cn(field, 'min-w-0 max-w-full')} value={p.dashboardId} aria-label="Switches to" onChange={(e) => editPlacement(i, { dashboardId: e.target.value })}>
          {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Row>
      {/* The card's whole width, so from and to stay on one line in a narrow panel. */}
      <span className="flex flex-wrap items-center gap-2 text-body">
        From
        <input type="time" className={field} value={p.from} aria-label="Switch starts"
          onChange={(e) => e.target.value && editPlacement(i, { from: e.target.value })} />
        to
        <input type="time" className={field} value={p.to} aria-label="Switch ends"
          onChange={(e) => e.target.value && editPlacement(i, { to: e.target.value })} />
      </span>
      <div className="flex flex-wrap items-center gap-1 pointer-fine:flex-nowrap" role="group" aria-label="Switch days">
        {WEEK_ORDER.map((d) => {
          const on = p.days.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-label={DAY_FULL[d]}
              aria-pressed={on}
              // A switch keeps at least one day; Remove takes it away.
              disabled={on && p.days.length === 1}
              onClick={() => editPlacement(i, { days: on ? p.days.filter((x) => x !== d) : [...p.days, d].sort() })}
              className={dayChip(on)}
              data-day-chip={d}
            >
              {DAY_NAMES[d]}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {openButton(p.dashboardId)}
        {i > 0 && (
          <button type="button" className={iconButton} onClick={() => moveUp(i)} aria-label="Move up: wins an overlap" data-placement-up>
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        )}
        <button type="button" className={cn(chip(false), 'ml-auto')} data-placement-remove
          onClick={() => savePlacements(placements.filter((_, j) => j !== i))}>
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

      {timeline && (
        // Which timeline, with its own actions in a menu beside it, and who
        // follows it; then what it shows, as rows.
        <section className="flex flex-col gap-3 border-b border-border pb-5 pointer-fine:gap-2 pointer-fine:pb-4" aria-label="Which dashboard shows" data-timeline-bar>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex flex-wrap items-center gap-2 text-body">
              This screen follows
              <select className={field} value={timeline.id} aria-label="Timeline" data-timeline-select
                onChange={(e) => { setNaming(null); onTimelineChange?.(e.target.value); }}>
                {timelines.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label="Timeline actions"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className={cn(
                  'flex h-[44px] w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-fine:h-8 pointer-fine:w-8',
                  (menuOpen || naming) && 'bg-muted text-foreground',
                )}
                data-timeline-menu
              >
                <MoreHorizontal className="h-5 w-5 pointer-fine:h-4 pointer-fine:w-4" aria-hidden />
              </button>
              {menuOpen && (
                <div className="absolute left-0 top-full z-40 mt-1 flex min-w-[11rem] flex-col rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg" data-timeline-actions>
                  <button type="button" className={menuItem} data-timeline-rename
                    onClick={choose(() => setNaming({ mode: 'rename', value: timeline.name }))}>
                    Rename
                  </button>
                  <button type="button" className={menuItem} data-timeline-duplicate
                    onClick={choose(() => setNaming({ mode: 'duplicate', value: copyName(timeline.name, timelines.map((t) => t.name)) }))}>
                    Duplicate
                  </button>
                  <button type="button" className={menuItem} data-timeline-new
                    onClick={choose(() => setNaming({ mode: 'new', value: '' }))}>
                    New timeline
                  </button>
                  <div className="my-1 h-px bg-border" aria-hidden />
                  <button type="button" className={cn(menuItem, 'text-destructive')} data-timeline-delete
                    disabled={timelines.length < 2} title={timelines.length < 2 ? 'The last timeline cannot be deleted' : undefined}
                    onClick={choose(() => void removeTimeline())}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className={note} data-timeline-used>{usedByText(timeline, timeline.id === first?.id)}</p>
          {naming && (
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void finishNaming(); }} data-timeline-naming>
              <input className={cn(field, 'min-w-0 flex-1')} value={naming.value} maxLength={TIMELINE_NAME_MAX_LENGTH} autoFocus
                aria-label={naming.mode === 'rename' ? 'New name for this timeline' : 'Name for the new timeline'}
                placeholder={naming.mode === 'new' ? 'Weekends at Grandma’s' : undefined}
                onChange={(e) => setNaming({ ...naming, value: e.target.value })} />
              <button type="submit" className={chip(true)} disabled={!naming.value.trim()}>
                {naming.mode === 'rename' ? 'Rename' : naming.mode === 'duplicate' ? 'Duplicate' : 'Add'}
              </button>
              <button type="button" className={chip(false)} onClick={() => setNaming(null)}>Cancel</button>
            </form>
          )}
          {problem && <p role="alert" className="m-0 text-body text-destructive">{problem}</p>}

          <Row name="Shows">
            <select className={cn(field, 'min-w-0 max-w-full')} value={restOfDayId} aria-label="Dashboard this screen shows" data-rest-of-day
              onChange={(e) => void patchTimeline(timeline.id, { dashboardId: e.target.value })}>
              {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {openButton(restOfDayId)}
          </Row>
          {placements.map(placementRow)}
          {placements.length > 1 && <p className={note}>If two overlap, the higher one wins.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={chip(false)} onClick={addPlacement}
              disabled={placements.length >= MAX_PLACEMENTS || allDashboards.length === 0} data-placement-add>
              <Plus className="mr-1 h-4 w-4" aria-hidden />Switch at set times
            </button>
          </div>
          <p className={note}>Saved as you go. Screens on this timeline change within a minute. Times are in the household time zone.</p>
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
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
