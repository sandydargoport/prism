'use client';

/**
 * The editing bar's Through the day sheet (#1152): the day as two lanes on
 * one time axis (#1233), with one time marker through both. In use runs the
 * whole day and shows the dashboard for the rest of the day, with the
 * dashboards placed on it above; Idle (nobody touching the screen) is resting
 * by day and night after dark, with a dot where night starts and ends (#1170). Tapping a lane
 * at a time shows the screen in that lane at that time and opens a card under
 * the line with only its settings. The slider moves the marker and keeps the
 * lane, so 9:30 pm can be seen now. The rarer settings sit behind More.
 *
 * It edits a timeline (#1266): the one the screen being edited follows, or
 * any other picked at the top, where timelines are added, renamed,
 * duplicated and deleted. Days come first: the chips pick a set of days, the
 * line shows that set, and a dashboard placed there covers every day in it,
 * as one block. A timeline keeps each change as soon as it is made. How long
 * until the screen rests and how dark it goes are this screen's own.
 */
import * as React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
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
import { DAY_MINUTES, dayLine, hhmm, placementSpans, placeBlocks, type Placed, type Stretch } from '@/lib/dayLine';
import { sameIdleBackground, tonight, type IdleBackground, type IdleSource, type IdleSwitch } from '@/lib/idleBackground';
import { asDayAndNight, DEFAULT_NIGHT, screenStateAt, type ScreenState } from '@/lib/throughTheDay';
import {
  copyName, daysInWords, daysShort, EVERY_DAY, firstTimeline, MAX_PLACEMENTS, placementCovers, TIMELINE_NAME_MAX_LENGTH, WEEKDAYS, WEEKEND,
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
  { value: 'off', label: 'Screen off' },
];
const SET_TIMES: IdleSwitch = { by: 'clock', from: '21:00', to: '06:30' };

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** The day chips, Monday first as a week is read. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_SETS: { label: string; days: number[] }[] = [
  { label: 'Every day', days: EVERY_DAY },
  { label: 'Weekdays', days: WEEKDAYS },
  { label: 'Weekend', days: WEEKEND },
];

// Each control is a 44px target for a finger on the wall, and 28px with a
// mouse (2rem at the desk's 14px), where editing is done (the laptop), so the
// panel stays light beside the canvas. With a mouse every control's words are
// one size, 12px, and sentences and fields 14px.
const chip = (on: boolean) => cn(
  'flex min-h-[48px] items-center rounded-full border-[1.5px] px-4 text-body transition-colors pointer-fine:min-h-8 pointer-fine:border pointer-fine:px-2.5 pointer-fine:text-caption pointer-fine:font-medium',
  on ? 'border-foreground bg-foreground text-background' : 'border-foreground/30 hover:bg-muted',
);
/** A day: a 44px circle by touch; with a mouse the seven share their row in equal widths, so Mon and Wed fit like the rest. */
const dayChip = (on: boolean) => cn(
  'flex h-[44px] w-[44px] items-center justify-center rounded-full text-caption font-medium disabled:opacity-100 pointer-fine:h-8 pointer-fine:w-auto pointer-fine:min-w-0 pointer-fine:flex-1',
  on ? 'bg-foreground text-background' : 'border border-foreground/30 text-muted-foreground',
);
/** A timeline's own actions, rarer than anything on the line: words, no outline. */
const quiet = (on: boolean) => cn(
  'flex min-h-[44px] items-center rounded-full px-3 text-body transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent pointer-fine:min-h-8 pointer-fine:px-2 pointer-fine:text-caption pointer-fine:font-medium',
  on ? 'bg-muted text-foreground' : 'text-muted-foreground',
);
const field = 'min-h-[44px] rounded-lg border border-border bg-background px-2 text-body pointer-fine:min-h-9';
const card = 'flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 pointer-fine:gap-2 pointer-fine:p-3';

/** What is open under the line. */
type Picked =
  | { kind: 'night'; edge?: 'start' | 'end' }
  | { kind: 'resting' }
  | { kind: 'rest-of-day' }
  | { kind: 'placement'; index: number };

/** The two lanes of the day: the screen in use, and idle (nobody touching it). */
type Lane = 'in-use' | 'nobody';

/**
 * Height of a lane and of a row of placement blocks, and the space between
 * rows: 44px for a finger, 34px with a mouse (two lines of a block's caption).
 */
const LANES = '[--lane:44px] pointer-fine:[--lane:34px]';
const LANE_GAP_PX = 4;

/** Left edge, as a share of the line, of a minute of the day. */
const at = (minute: number) => `${(minute / DAY_MINUTES) * 100}%`;

/** "HH:MM" for a time on the display's own clock. */
const clockOf = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const sameDays = (a: number[], b: number[]) => [...a].sort().join(',') === [...b].sort().join(',');

/**
 * Back to the plainest form that means the same: one background when it is
 * the same by day and night on the default rule, so a timeline nobody set a
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

/** Naming a timeline: a new one, a copy of this one, or this one renamed. */
type Naming = { mode: 'new' | 'duplicate' | 'rename'; value: string };

export function ThroughTheDaySheet({
  idleBackground, onIdleBackgroundChange, idleHalf, onIdleHalfChange, editTab, onEditTabChange, idleCheck,
  allDashboards = [], currentDashboardId, onSwitchDashboard,
  timelines = [], timelineId, onTimelineChange, screenId = null,
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
  /** The named screen being edited, which follows the timeline picked here. */
  screenId?: string | null;
}) {
  const { timeFormat } = useTimeFormat();
  const [moreOpen, setMoreOpen] = useState(false);
  const [motionOpen, setMotionOpen] = useState(false);
  const { timeout, setTimeout } = useScreensaverTimeout();
  const { level: dim, setLevel: setDim } = useIdleDimSetting();
  const { confirm, dialogProps } = useConfirmDialog();

  const timeline = timelines.find((t) => t.id === timelineId) ?? null;
  const first = firstTimeline(timelines);
  const placements = timeline?.placements ?? [];

  const pair = asDayAndNight(idleBackground ?? { source: 'photos' });
  const rule = pair.switch;
  const { lat, lon, guessed } = useSkyLocation(rule.by === 'sun');
  const time = (d: Date) => formatTimeOfDay(clockOf(d), timeFormat);
  const timeOfMinute = (m: number) => formatTimeOfDay(hhmm(m), timeFormat);

  const state: ScreenState = editTab !== 'idle' ? 'active' : idleHalf === 'night' ? 'night' : 'resting';
  const show = (s: ScreenState) => {
    if (s === 'active') { onEditTabChange?.('dashboard'); return; }
    onEditTabChange?.('idle');
    onIdleHalfChange?.(s === 'night' ? 'night' : 'day');
  };
  const change = (patch: Partial<typeof pair>) => onIdleBackgroundChange?.(simplest({ ...pair, ...patch }));

  // Days come first: the set the line shows, and that a new placement covers.
  // The line is drawn for the next of those days, today if it is one, so
  // dusk and dawn are that day's.
  const today = new Date();
  const [days, setDays] = useState<number[]>(EVERY_DAY);
  const ahead = Math.min(...days.map((d) => (d - today.getDay() + 7) % 7));
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead);
  const line = dayLine(day, rule, lat, lon);
  const spans = placementSpans(placements, days);
  const toggleDay = (d: number) => setDays((was) => (was.includes(d) ? was.filter((x) => x !== d) : [...was, d].sort()));

  // The time marker, shared by both lanes, and the lane the screen is shown
  // in. In use shows the dashboard at any time; Idle is resting or
  // night, whichever that time is. The marker moves only when the person
  // moves it: a tap on a lane puts it where the tap was, the slider slides it.
  const [played, setPlayed] = useState<number | null>(null);
  const playedAt = (minute: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minute / 60), minute % 60);
  const idleStateAt = (minute: number) => screenStateAt({ idle: true, now: playedAt(minute), rule, lat, lon });
  const lane: Lane = state === 'active' ? 'in-use' : 'nobody';
  /** Moves the marker and shows the screen then, in `inLane` (the chosen one by default). */
  const play = (minute: number, inLane: Lane = lane) => {
    setPlayed(minute);
    show(inLane === 'in-use' ? 'active' : idleStateAt(minute));
  };
  const exists = (id: string) => allDashboards.some((d) => d.id === id);
  // Read off the line itself, in its own wall-clock minutes, as the blocks are drawn.
  const playedPlacement = played === null ? null
    : placements.find((p) => placementCovers(p, day.getDay(), played) && exists(p.dashboardId)) ?? null;
  const dashboardName = (id: string) => allDashboards.find((d) => d.id === id)?.name ?? 'a dashboard';
  const defaultId = allDashboards.find((d) => d.isDefault)?.id ?? currentDashboardId ?? '';
  const restOfDayId = timeline?.dashboardId && exists(timeline.dashboardId) ? timeline.dashboardId : defaultId;

  const [picked, setPicked] = useState<Picked | null>(null);
  const isPicked = (p: Picked) => !!picked && picked.kind === p.kind
    && (p.kind !== 'placement' || (picked.kind === 'placement' && picked.index === p.index))
    && (p.kind !== 'night' || (picked.kind === 'night' && picked.edge === p.edge));

  const night = tonight(new Date(), rule, lat, lon);

  // A timeline keeps its placements as they change.
  const savePlacements = (next: Placement[]) => { if (timeline) void patchTimeline(timeline.id, { placements: next }); };
  const editPlacement = (i: number, patch: Partial<Placement>) => savePlacements(placements.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  /** Moves a placement up or down the order that decides which wins an overlap. */
  const movePlacement = (i: number, by: -1 | 1) => {
    const next = [...placements];
    const [p] = next.splice(i, 1);
    next.splice(i + by, 0, p!);
    savePlacements(next);
    setPicked({ kind: 'placement', index: i + by });
  };
  const addPlacement = () => {
    const from = Math.floor((played ?? (today.getHours() * 60 + today.getMinutes())) / 15) * 15;
    const target = allDashboards.find((d) => d.id !== restOfDayId) ?? allDashboards[0];
    if (!target || !timeline) return;
    savePlacements([...placements, { days: [...days], from: hhmm(from), to: hhmm(from + 60), dashboardId: target.id }]);
    setPicked({ kind: 'placement', index: placements.length });
    setPlayed(from);
  };

  // Timelines themselves: new, duplicate, rename, delete.
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
      setPicked(null);
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
        ? `${n === 1 ? 'The screen' : `The ${n} screens`} on it follow ${goesTo?.name ?? 'the first timeline'} instead.`
        : 'No screen uses it.',
      { confirmLabel: 'Delete' },
    );
    if (!ok) return;
    if (!(await deleteTimeline(timeline.id))) { setProblem('The timeline was not deleted. Try again.'); return; }
    setPicked(null);
    if (goesTo) onTimelineChange?.(goesTo.id);
  };

  // Fitted after layout, from real widths: a stretch's name shows whole or not
  // at all, and a placement block, as wide as its name, starts at its time
  // and drops a row rather than touch another.
  const lineRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const inUseRef = useRef<HTMLButtonElement>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [bare, setBare] = useState<string[]>([]);
  const fitKey = JSON.stringify([line.stretches, spans, placements, idleBackground, allDashboards.map((d) => d.name)]);
  useLayoutEffect(() => {
    const lineEl = lineRef.current;
    if (!lineEl) return;
    const fit = () => {
      const width = lineEl.clientWidth;
      const nextBare = Array.from(lineEl.querySelectorAll<HTMLElement>('[data-day-stretch]')).filter((el) => {
        const label = el.querySelector<HTMLElement>('[data-stretch-label]');
        const cs = getComputedStyle(el);
        const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        return !!label && label.getBoundingClientRect().width > room + 0.5;
      }).map((el) => el.dataset.key!);
      setBare((was) => (JSON.stringify(was) === JSON.stringify(nextBare) ? was : nextBare));
      const blocks = Array.from(rowRef.current?.querySelectorAll<HTMLElement>('[data-day-placement]') ?? []).map((el) => ({
        start: (Number(el.dataset.from) / DAY_MINUTES) * width,
        width: el.offsetWidth,
      }));
      const next = placeBlocks(blocks, width);
      setPlaced((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(fit);
    watch.observe(lineEl);
    return () => watch.disconnect();
  }, [fitKey]);
  const lanes = Math.max(1, ...placed.map((p) => p.lane + 1));

  const nightLabel = NIGHT_LOOKS.find((o) => o.value === pair.night)?.label ?? (pair.night === 'photos' ? 'Photos' : '');
  const restingLabel = RESTING.find((o) => o.value === pair.day)?.label ?? '';
  const keptNote = 'Saved as you go. Screens on this timeline change within a minute. Times are in the household time zone.';

  const nightCard = (edge?: 'start' | 'end') => (
    <div className={card} data-day-card="night">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="When night is">
        <button type="button" role="radio" aria-checked={rule.by === 'sun'} onClick={() => rule.by !== 'sun' && change({ switch: DEFAULT_NIGHT })} className={chip(rule.by === 'sun')}>
          Dusk to dawn
        </button>
        <button type="button" role="radio" aria-checked={rule.by === 'clock'} onClick={() => rule.by !== 'clock' && change({ switch: SET_TIMES })} className={chip(rule.by === 'clock')}>
          Set times
        </button>
      </div>
      {rule.by === 'clock' ? (
        <span className="flex flex-wrap items-center gap-2 text-body">
          From
          <input type="time" className={field} value={rule.from} aria-label="Night starts"
            onChange={(e) => e.target.value && change({ switch: { ...rule, from: e.target.value } })} />
          to
          <input type="time" className={field} value={rule.to} aria-label="Night ends"
            onChange={(e) => e.target.value && change({ switch: { ...rule, to: e.target.value } })} />
        </span>
      ) : (
        <>
          {night && (
            <p className="m-0 text-body text-muted-foreground" data-night-times>
              Tonight <span data-night-start>{time(night.start)}</span> to <span data-night-end>{time(night.end)}</span>
              {guessed && ', guessed from the time zone until a location is set in Settings > General'}.
            </p>
          )}
          {edge !== 'end' && (
            <OffsetInput label="Starts" edge="dusk" minutes={rule.duskOffset} order={['after', 'before']}
              onChange={(m) => change({ switch: { ...rule, duskOffset: m } })} />
          )}
          {edge !== 'start' && (
            <OffsetInput label="Ends" edge="dawn" minutes={rule.dawnOffset} order={['before', 'after']}
              onChange={(m) => change({ switch: { ...rule, dawnOffset: m } })} />
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Night look">
        {NIGHT_LOOKS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={pair.night === o.value}
            onClick={() => {
              change({ night: o.value });
              // Dimming a dashboard that is set not to dim would show no change.
              if (o.value === 'dashboard' && dim === '0') setDim('0.5');
              show('night');
            }}
            className={chip(pair.night === o.value)}
            data-night-look={o.value}
          >
            {o.label}
          </button>
        ))}
        {pair.night === 'photos' && <span className={chip(true)}>Photos</span>}
      </div>
      {pair.night !== 'off' && (
        <label className="flex flex-wrap items-center gap-3 text-body">
          How dark
          <select className={field} value={dim} onChange={(e) => setDim(e.target.value)} aria-label="How dark at night">
            {DIM_LEVELS.map((l) => <option key={l.raw} value={l.raw}>{l.raw === '0' ? 'Not dimmed' : l.label}</option>)}
          </select>
          <span className="text-caption text-muted-foreground">on this screen</span>
        </label>
      )}
    </div>
  );

  const restingCard = (
    <div className={card} data-day-card="resting">
      <label className="flex flex-wrap items-center gap-3 text-body">
        Rest after
        <select className={field} value={timeout} onChange={(e) => setTimeout(Number(e.target.value))} aria-label="Rest after">
          {SCREENSAVER_TIMEOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === 0 ? 'Never rest' : o.label}</option>)}
        </select>
        <span className="text-caption text-muted-foreground">of nobody touching this screen</span>
      </label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="While resting">
        {RESTING.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={pair.day === o.value}
            onClick={() => { change({ day: o.value }); show('resting'); }}
            className={chip(pair.day === o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  const restOfDayCard = (
    <div className={card} data-day-card="rest-of-day">
      <label className="flex flex-wrap items-center gap-2 text-body">
        The rest of the day, show
        <select className={field} value={restOfDayId} aria-label="Dashboard for the rest of the day" data-rest-of-day
          onChange={(e) => timeline && void patchTimeline(timeline.id, { dashboardId: e.target.value })}>
          {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <p className="m-0 text-caption text-muted-foreground">{keptNote}</p>
    </div>
  );

  const placementCard = (i: number) => {
    const p = placements[i];
    if (!p) return null;
    const target = allDashboards.find((d) => d.id === p.dashboardId);
    return (
      <div className={card} data-day-card="placement">
        {/* What, then when, then which days: one thing to a row. */}
        <span className="flex items-center gap-2 text-body">
          Show
          <select className={cn(field, 'min-w-0 flex-1')} value={p.dashboardId} aria-label="Placed dashboard" onChange={(e) => editPlacement(i, { dashboardId: e.target.value })}>
            {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-body">
          From
          <input type="time" className={field} value={p.from} aria-label="Placement starts"
            onChange={(e) => e.target.value && editPlacement(i, { from: e.target.value })} />
          to
          <input type="time" className={field} value={p.to} aria-label="Placement ends"
            onChange={(e) => e.target.value && editPlacement(i, { to: e.target.value })} />
        </span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Placement days">
          {WEEK_ORDER.map((d) => {
            const on = p.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-label={DAY_FULL[d]}
                aria-pressed={on}
                // A placement keeps at least one day; Remove takes it away.
                disabled={on && p.days.length === 1}
                onClick={() => editPlacement(i, { days: on ? p.days.filter((x) => x !== d) : [...p.days, d].sort() })}
                className={dayChip(on)}
              >
                {DAY_NAMES[d]}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {target?.slug && target.id !== currentDashboardId && (
            <button type="button" className={chip(false)} onClick={() => onSwitchDashboard?.(target.slug!)}>Open {target.name}</button>
          )}
          <button type="button" className={chip(false)} data-placement-remove
            onClick={() => { savePlacements(placements.filter((_, j) => j !== i)); setPicked(null); }}>
            <X className="mr-1 h-4 w-4" />Remove
          </button>
        </div>
        {placements.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 text-body" data-placement-order>
            <span>If two overlap, the higher wins. This is {i + 1} of {placements.length}.</span>
            <button type="button" className={cn(chip(false), 'disabled:opacity-40')} disabled={i === 0} onClick={() => movePlacement(i, -1)} aria-label="Move this one up">
              <ArrowUp className="mr-1 h-4 w-4" />Higher
            </button>
            <button type="button" className={cn(chip(false), 'disabled:opacity-40')} disabled={i === placements.length - 1} onClick={() => movePlacement(i, 1)} aria-label="Move this one down">
              <ArrowDown className="mr-1 h-4 w-4" />Lower
            </button>
          </div>
        )}
        <p className="m-0 text-caption text-muted-foreground">{keptNote}</p>
      </div>
    );
  };

  const playedMinute = played ?? (playedAt(0).toDateString() === today.toDateString() ? today.getHours() * 60 + today.getMinutes() : null);

  /** The minute under a tap on a lane. A key press has no point, so it keeps the marker where it is. */
  const minuteAt = (e: React.MouseEvent, laneEl: HTMLElement | null) => {
    const kept = playedMinute ?? today.getHours() * 60;
    if (e.detail === 0 || !laneEl) return kept;
    const r = laneEl.getBoundingClientRect();
    if (r.width <= 0) return kept;
    return Math.min(DAY_MINUTES - 1, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * DAY_MINUTES)));
  };
  const tapInUse = (e: React.MouseEvent) => {
    setPicked(timeline ? { kind: 'rest-of-day' } : null);
    play(minuteAt(e, inUseRef.current), 'in-use');
  };
  const tapNobody = (e: React.MouseEvent, st: Stretch) => {
    let minute = minuteAt(e, lineRef.current);
    // A key press on a stretch keeps the marker when it is in that stretch,
    // or takes it to the stretch's nearest edge, so its card is the one shown.
    if (e.detail === 0) minute = Math.min(st.to - 1, Math.max(st.from, minute));
    setPicked({ kind: idleStateAt(minute) === 'night' ? 'night' : 'resting' });
    play(minute, 'nobody');
  };
  const laneLabel = (on: boolean) => cn('whitespace-nowrap text-body', on ? 'font-semibold text-foreground' : 'text-muted-foreground');
  const chosenRing = 'ring-2 ring-primary ring-offset-2 ring-offset-background';

  return (
    <div className="flex flex-col gap-6 pointer-fine:gap-5" data-day-sheet data-day-shows={state}>
      {timeline && (
        // Which timeline, who follows it, and its own rarer actions, set off
        // from the timeline itself by a rule.
        <section className="flex flex-col gap-2 border-b border-border pb-4 pointer-fine:pb-3" aria-label="Which timeline" data-timeline-bar>
          <label className="flex flex-wrap items-center gap-2 text-body">
            {screenId ? 'This screen follows' : 'Timeline'}
            <select className={field} value={timeline.id} aria-label="Timeline" data-timeline-select
              onChange={(e) => { setPicked(null); setNaming(null); onTimelineChange?.(e.target.value); }}>
              {timelines.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <p className="m-0 text-caption text-muted-foreground" data-timeline-used>{usedByText(timeline, timeline.id === first?.id)}</p>
          {/* Pulled left by their own padding, so the words line up with the text above. */}
          <div className="-ml-3 flex flex-wrap pointer-fine:-ml-2">
            <button type="button" className={quiet(naming?.mode === 'new')} aria-label="New timeline" data-timeline-new
              onClick={() => setNaming({ mode: 'new', value: '' })}>
              New
            </button>
            <button type="button" className={quiet(naming?.mode === 'duplicate')} aria-label="Duplicate this timeline" data-timeline-duplicate
              onClick={() => setNaming({ mode: 'duplicate', value: copyName(timeline.name, timelines.map((t) => t.name)) })}>
              Duplicate
            </button>
            <button type="button" className={quiet(naming?.mode === 'rename')} aria-label="Rename this timeline" data-timeline-rename
              onClick={() => setNaming({ mode: 'rename', value: timeline.name })}>
              Rename
            </button>
            <button type="button" className={quiet(false)} aria-label="Delete this timeline" data-timeline-delete
              disabled={timelines.length < 2} onClick={() => void removeTimeline()}>
              Delete
            </button>
          </div>
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
        </section>
      )}

      <section className="flex flex-col gap-3">
        {/* The presets and + Dashboard share a row with a mouse (1280px and wider). */}
        <div className="flex flex-wrap items-center gap-2 pointer-fine:gap-1.5" role="group" aria-label="Days shown" data-day-set={days.join(',')}>
          {DAY_SETS.map((set) => (
            <button key={set.label} type="button" aria-pressed={sameDays(days, set.days)} className={chip(sameDays(days, set.days))}
              onClick={() => { setDays(set.days); setPlayed(null); }} data-day-preset={set.label}>
              {set.label}
            </button>
          ))}
          {timeline && (
            <button type="button" className={cn(chip(false), 'ml-auto')} onClick={addPlacement}
              disabled={placements.length >= MAX_PLACEMENTS || allDashboards.length === 0} data-placement-add>
              <Plus className="mr-1 h-4 w-4" />Dashboard
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Each day">
          {WEEK_ORDER.map((d) => {
            const on = days.includes(d);
            return (
              <button key={d} type="button" aria-label={DAY_FULL[d]} aria-pressed={on} className={dayChip(on)}
                // The line always shows at least one day.
                disabled={on && days.length === 1}
                onClick={() => { toggleDay(d); setPlayed(null); }} data-day-chip={d}>
                {DAY_NAMES[d]}
              </button>
            );
          })}
        </div>

        {/* Two lanes on one day axis: the second column is the same for both,
            so a time sits at the same place in each, under one marker. */}
        <div className={cn('grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2', LANES)} data-day-lanes>
          {spans.length > 0 && (
            // Placed dashboards change which dashboard shows, so they sit on
            // In use, in their own row: a short one is still a whole target.
            <div ref={rowRef} className="relative" style={{ gridColumn: 2, gridRow: 1, height: `calc(${lanes} * var(--lane) + ${(lanes - 1) * LANE_GAP_PX}px)` }} data-day-placements>
              {spans.map((sp, n) => {
                const width = ((sp.to - sp.from) / DAY_MINUTES) * 100;
                const place = placed[n];
                const p = placements[sp.index]!;
                // On only some of the days shown: its own days, under its name,
                // so the block is no wider for them. Written as days ("Mon–Fri"),
                // so they cannot be read as a second name.
                const some = sp.partial ? daysShort(p.days) : null;
                const label = sp.partial ? `${dashboardName(p.dashboardId)}, ${daysInWords(p.days)}` : dashboardName(p.dashboardId);
                return (
                  <button
                    key={`p-${sp.index}-${sp.from}`}
                    type="button"
                    onClick={() => {
                      setPicked({ kind: 'placement', index: sp.index });
                      // The marker stays when it is already in this block.
                      const inside = playedMinute !== null && playedMinute >= sp.from && playedMinute < sp.to;
                      play(inside ? playedMinute : sp.from, 'in-use');
                    }}
                    aria-label={`${label}, ${timeOfMinute(sp.from)} to ${timeOfMinute(sp.to)}`}
                    aria-pressed={isPicked({ kind: 'placement', index: sp.index })}
                    className={cn(
                      'absolute flex h-(--lane) w-max max-w-full flex-col items-start justify-center whitespace-nowrap rounded-lg px-2 text-left text-caption leading-tight',
                      // On some of the days only: a light fill with a dashed
                      // edge and dark words, not white on a pale fill.
                      sp.partial ? 'border border-dashed border-primary/70 bg-primary/10 text-foreground' : 'bg-primary text-primary-foreground',
                      isPicked({ kind: 'placement', index: sp.index }) && 'ring-2 ring-foreground ring-offset-1',
                    )}
                    style={{
                      minWidth: `max(var(--lane), ${width}%)`,
                      left: place ? place.left : at(sp.from),
                      top: place ? `calc(${place.lane} * (var(--lane) + ${LANE_GAP_PX}px))` : 0,
                    }}
                    data-day-placement={sp.index}
                    data-partial={sp.partial || undefined}
                    data-from={sp.from}
                    data-to={sp.to}
                  >
                    {/* The name set apart by weight: grey days on the light fill would be too faint to read. */}
                    <span className="font-medium" data-placement-name>{dashboardName(p.dashboardId)}</span>
                    {some && <span data-placement-days>{some}</span>}
                  </button>
                );
              })}
            </div>
          )}

          <span className={laneLabel(lane === 'in-use')} style={{ gridColumn: 1, gridRow: 2 }} data-lane-label="in-use">In use</span>
          <button
            ref={inUseRef}
            type="button"
            onClick={tapInUse}
            aria-label={`In use: ${timeline ? dashboardName(restOfDayId) : 'the dashboard'} shows. Tap a time to see it then.`}
            aria-pressed={lane === 'in-use'}
            className={cn('h-(--lane) w-full truncate rounded-full bg-primary/20 px-4 text-left text-caption text-foreground', lane === 'in-use' && chosenRing)}
            style={{ gridColumn: 2, gridRow: 2 }}
            data-day-lane="in-use"
          >
            {timeline ? dashboardName(restOfDayId) : 'Dashboard'}
          </button>

          <span className={laneLabel(lane === 'nobody')} style={{ gridColumn: 1, gridRow: 3 }} data-lane-label="nobody">Idle</span>
          <div
            ref={lineRef}
            role="group"
            aria-label="Idle"
            className={cn('relative h-(--lane) rounded-full', lane === 'nobody' && chosenRing)}
            style={{ gridColumn: 2, gridRow: 3 }}
            data-day-line
            data-day-lane="nobody"
          >
            {line.stretches.map((st, n) => (
              <button
                key={`${st.kind}-${st.from}`}
                type="button"
                onClick={(e) => tapNobody(e, st)}
                aria-label={`${st.kind === 'night' ? `Night: ${nightLabel}` : `Resting: ${restingLabel}`}, ${timeOfMinute(st.from)} to ${timeOfMinute(st.to)}`}
                aria-pressed={isPicked({ kind: st.kind })}
                className={cn(
                  // A name that does not fit is hidden whole (see the fitting
                  // above), so no ellipsis is drawn for it. No padding here: it
                  // would keep a short stretch wider than its hours, past the
                  // end of the line on a narrow panel (#1265).
                  'absolute inset-y-0 overflow-hidden whitespace-nowrap text-left text-caption',
                  n === 0 && 'rounded-l-full',
                  n === line.stretches.length - 1 && 'rounded-r-full',
                  st.kind === 'night' ? 'bg-foreground/85 text-background' : 'bg-muted text-foreground',
                  isPicked({ kind: st.kind }) && 'ring-2 ring-inset ring-primary',
                )}
                style={{ left: at(st.from), width: at(st.to - st.from) }}
                data-day-stretch={st.kind}
                data-key={`${st.kind}-${st.from}`}
              >
                {/* Clear of the dot on each edge. */}
                <span className={cn('px-6', bare.includes(`${st.kind}-${st.from}`) && 'invisible')} data-stretch-label>
                  {st.kind === 'night' ? nightLabel : restingLabel}
                </span>
              </button>
            ))}
            {line.milestones.map((m) => {
              const edge = m.kind === 'night-start' ? 'start' : 'end';
              return (
                <button
                  key={m.kind}
                  type="button"
                  onClick={() => { setPicked({ kind: 'night', edge }); play(edge === 'start' ? m.minute : Math.max(0, m.minute - 1), 'nobody'); }}
                  aria-label={`Night ${edge === 'start' ? 'starts' : 'ends'} ${timeOfMinute(m.minute)}`}
                  aria-pressed={isPicked({ kind: 'night', edge })}
                  className="absolute top-1/2 z-30 flex h-[44px] w-[44px] -translate-x-1/2 -translate-y-1/2 items-center justify-center pointer-fine:h-9 pointer-fine:w-9"
                  style={{ left: at(m.minute) }}
                  data-day-milestone={m.kind}
                >
                  <span className={cn('h-4 w-4 rounded-full border-2 border-background bg-primary shadow',
                    isPicked({ kind: 'night', edge }) && 'h-5 w-5 ring-2 ring-primary')} />
                </button>
              );
            })}
          </div>

          {playedMinute !== null && (
            // One marker through both lanes.
            <div aria-hidden className="pointer-events-none relative z-20 self-stretch" style={{ gridColumn: 2, gridRow: '2 / 4' }}>
              <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-primary" style={{ left: at(playedMinute) }} data-day-now data-minute={playedMinute} />
            </div>
          )}

          <div className="relative h-5 text-caption text-muted-foreground" style={{ gridColumn: 2, gridRow: 4 }} aria-hidden>
            {line.milestones.map((m) => (
              <span key={m.kind} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: at(m.minute) }}>
                {timeOfMinute(m.minute)}
              </span>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-body text-muted-foreground" aria-live="polite" data-day-played>
            {played === null
              ? 'Tap In use or Idle at a time to see the screen then, or slide to another time.'
              : `At ${formatTimeOfDay(clockOf(playedAt(played)), timeFormat)}: ${state === 'active' ? 'in use' : state}${playedPlacement ? `, ${dashboardName(playedPlacement.dashboardId)} shows` : ''}.`}
          </span>
          <input
            type="range"
            min={0}
            max={DAY_MINUTES - 15}
            step={15}
            value={played ?? today.getHours() * 60}
            onChange={(e) => play(Number(e.target.value))}
            aria-label="Time of day"
            className="w-full"
            data-day-slider
          />
        </label>

        {picked?.kind === 'night' && nightCard(picked.edge)}
        {picked?.kind === 'resting' && restingCard}
        {picked?.kind === 'rest-of-day' && restOfDayCard}
        {picked?.kind === 'placement' && placementCard(picked.index)}

        {idleCheck.crossed && (
          <p role="alert" className="m-0 text-body text-destructive" data-idle-crossed>
            With these offsets night would end before it starts around{' '}
            {idleCheck.crossed.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}. Make them smaller to keep them.
          </p>
        )}
        {rule.by === 'clock' && rule.from === rule.to && (
          <p role="alert" className="m-0 text-body text-destructive" data-idle-crossed>Night must start and end at different times.</p>
        )}
      </section>

      <section>
        <button type="button" className={chip(moreOpen)} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} data-day-more>
          More
        </button>
        {moreOpen && (
          <div className="mt-4 flex flex-col gap-4 pointer-fine:mt-3 pointer-fine:gap-3">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Night backdrop">
              <span className="self-center text-body">A different night backdrop:</span>
              <button type="button" role="radio" aria-checked={pair.night === 'photos'} onClick={() => { change({ night: 'photos' }); show('night'); }} className={chip(pair.night === 'photos')}>
                Photos
              </button>
            </div>
            <p className="m-0 text-body text-muted-foreground">
              Photos and the night sky have their own arrangement: tap Idle on the line, then Widgets.
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
