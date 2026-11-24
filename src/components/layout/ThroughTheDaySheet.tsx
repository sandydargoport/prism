'use client';

/**
 * The editing panel's Through the day sheet (#1152), as rows (#1281) that
 * fold (#1294).
 *
 * First a day slider: the day as a line with a dot wherever what the screen
 * shows changes (night's start and end, each switch's start and end today),
 * and ◀ ▶ to step from one to the next. The canvas shows the screen then: a
 * switch's dashboard during the switch, the night look at night, its own
 * dashboard otherwise. The slider only shows; tapping a dot opens its row:
 * night's here, a switch's on the Screen sheet, where the screen's switches
 * are set (#1326).
 *
 * Then the screen's own day (#1345): what it shows idle by day, with See it to
 * arrange what shows over the photos or the sky, and At night, a row shaped
 * like a switch: its look, when night is, tonight's times and the offsets. It
 * belongs to the screen, so a switch to another dashboard does not change how
 * it idles, and Done saves it to the screen. At night folds to one line
 * that says what it does, and opens on a tap. Every row has its name in one
 * column and its choices in the next, so they line up and wrap within their
 * own column.
 */
import * as React from 'react';
import { useState } from 'react';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { formatTimeOfDay } from '@/components/calendar/cells/itemTime';
import { ScreensaverSettingsPanel } from '@/components/screensaver/ScreensaverQuickSettings';
import { useSkyLocation } from '@/components/screensaver/useIdleBackground';
import { sameIdleBackground, tonight, type IdleBackground, type IdleSource, type IdleSwitch } from '@/lib/idleBackground';
import { asDayAndNight, DEFAULT_NIGHT, type ScreenState } from '@/lib/throughTheDay';
import { backgroundOf, DEFAULT_SCREEN_DAY } from '@/lib/screenDay';
import type { ScreenPlan } from '@/lib/screenSwitches';
import { dayStops, nightSpans, sceneAt, switchSpans, type Scene, type Stop } from '@/lib/dayWaypoints';
import { todayKey, weekdayOfKey } from '@/lib/utils/zonedDate';
import type { IdleHalf, EditTab } from '@/components/dashboard/useDashboardLayout';
import { OffsetInput } from './IdleBackgroundBar';
import { DaySlider } from './DaySlider';
import { chip, field, Fold, hhmm, note, Row, useBusRoutes } from './sheetRows';
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

/** "HH:MM" for a time on the display's own clock. */
const clockOf = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

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

/** Kept here too, where it was first. */
export { busWindowsInWords } from './sheetRows';

/** Whether At night is open. */
type OpenRow = 'night' | null;

export function ThroughTheDaySheet({
  idleBackground, onIdleBackgroundChange, idleHalf, onIdleHalfChange, editTab, onEditTabChange, idleCheck,
  allDashboards = [], currentDashboardId,
  screenPlan = null, screenId = null,
  previewDashboardId = null, onPreviewDashboardChange, onOpenLook, onOpenSwitch,
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
  /** In a screen's editor, the dashboard it shows and its switches, for the line; they are set on the Screen sheet. */
  screenPlan?: ScreenPlan | null;
  /** The named screen being edited, or null for a dashboard on its own. */
  screenId?: string | null;
  /** Another dashboard the canvas shows as it is saved, for a stop in its switch; null is this one. */
  previewDashboardId?: string | null;
  onPreviewDashboardChange?: (id: string | null) => void;
  /** Opens the editor's Look panel, where screen fit and performance are. */
  onOpenLook?: () => void;
  /** Opens the Screen sheet at a switch, by its place: its dot was tapped. */
  onOpenSwitch?: (index: number) => void;
}) {
  const { timeFormat, householdTimezone } = useTimeFormat();
  const [moreOpen, setMoreOpen] = useState(false);
  const [motionOpen, setMotionOpen] = useState(false);
  // Folded when the editor opens.
  const [openRow, setOpenRow] = useState<OpenRow>(null);
  const toggle = () => setOpenRow((o) => (o === 'night' ? null : 'night'));
  // The day the slider shows: today, as it was when the sheet opened, so its
  // stops stay put while they are stepped through.
  const [today] = useState(() => new Date());
  const [stopAt, setStopAt] = useState<number | null>(null);

  // Which dashboard shows when is the screen's, so only a screen's editor has it.
  const plan = screenId ? screenPlan : null;
  const switches = plan?.switches ?? [];

  const pair = asDayAndNight(idleBackground ?? backgroundOf(DEFAULT_SCREEN_DAY));
  const rule = pair.switch;
  const { lat, lon, guessed } = useSkyLocation(rule.by === 'sun');
  const time = (d: Date) => formatTimeOfDay(clockOf(d), timeFormat);
  const clock = (t: string) => formatTimeOfDay(t, timeFormat);
  const night = tonight(today, rule, lat, lon);

  const state: ScreenState = editTab !== 'idle' ? 'active' : idleHalf === 'night' ? 'night' : 'resting';
  const show = (s: ScreenState) => {
    if (s === 'active') { onEditTabChange?.('dashboard'); return; }
    onPreviewDashboardChange?.(null);
    onEditTabChange?.('idle');
    onIdleHalfChange?.(s === 'night' ? 'night' : 'day');
  };
  const backToInUse = () => { onPreviewDashboardChange?.(null); show('active'); };
  const change = (patch: Partial<typeof pair>) => onIdleBackgroundChange?.(simplest({ ...pair, ...patch }));

  const exists = (id: string) => allDashboards.some((d) => d.id === id);
  const dashboardName = (id: string | undefined) => allDashboards.find((d) => d.id === id)?.name ?? 'this dashboard';
  const defaultId = allDashboards.find((d) => d.isDefault)?.id ?? currentDashboardId ?? '';
  const shownId = plan?.dashboardId && exists(plan.dashboardId) ? plan.dashboardId : defaultId;
  const editedId = currentDashboardId ?? shownId;
  const busRoutes = useBusRoutes(switches.some((sw) => sw.when === 'bus'));

  // The day slider: its stops today, and what the screen shows at each.
  const minuteNow = today.getHours() * 60 + today.getMinutes();
  let weekday = today.getDay();
  try { weekday = weekdayOfKey(todayKey(householdTimezone, today)); } catch { /* the screen's own day */ }
  const nights = nightSpans(today, rule, lat, lon);
  const spans = switchSpans(switches, weekday, busRoutes ?? []);
  const stops = dayStops({ now: minuteNow, nights, switches: spans });
  const nowIndex = Math.max(0, stops.findIndex((s) => s.marks.some((m) => m.kind === 'now')));
  // A dashboard edited on its own is the one on show all day.
  const sceneOf = (i: number): Scene => sceneAt(stops[i]!.minute, { spans, switches, nights, shownId: plan ? shownId : editedId, editedId, exists });
  // The stop picked shows only while the canvas shows its moment: Back to in
  // use, or Resting's See it, show something else.
  const showing = (sc: Scene) => (sc.state === 'night'
    ? state === 'night' && !previewDashboardId
    : state === 'active' && (previewDashboardId ?? editedId) === sc.dashboardId);
  const shownStop = stopAt !== null && stopAt < stops.length && showing(sceneOf(stopAt)) ? stopAt : null;
  const goTo = (i: number, tapped: boolean) => {
    setStopAt(i);
    const sc = sceneOf(i);
    if (sc.state === 'night') show('night');
    else {
      onPreviewDashboardChange?.(sc.dashboardId === editedId ? null : sc.dashboardId);
      show('active');
    }
    // A tapped dot opens the row that makes it: a switch's is on the Screen sheet.
    const mark = stops[i]!.marks.find((m) => m.kind !== 'now');
    if (!tapped || !mark) return;
    if (typeof mark.switchIndex === 'number') onOpenSwitch?.(mark.switchIndex);
    else setOpenRow('night');
  };
  const stopInWords = (stop: Stop) => {
    const at = clock(hhmm(stop.minute));
    const what = stop.marks.flatMap((m) => {
      if (m.kind === 'now') return [];
      if (m.kind === 'night-start') return ['night starts'];
      if (m.kind === 'night-end') return ['night ends'];
      const name = dashboardName(switches[m.switchIndex!]?.dashboardId);
      return [`${name} ${m.kind === 'switch-start' ? 'starts' : 'ends'}`];
    });
    const isNow = stop.marks.some((m) => m.kind === 'now');
    return [isNow ? `Now, ${at}` : at, ...what].join(', ');
  };
  const sceneInWords = (sc: Scene) => {
    const name = dashboardName(sc.dashboardId);
    if (sc.state === 'night') return `Shows ${name} at night`;
    return sc.dashboardId === editedId ? `Shows ${name} in use` : `Shows ${name} as it is saved`;
  };

  const nightInShort = () => {
    const look = NIGHT_LOOKS.find((o) => o.value === pair.night)?.label ?? 'Dim this dashboard';
    if (rule.by === 'clock') return `${look} · ${clock(rule.from)}–${clock(rule.to)}`;
    return `${look} · dusk to dawn${night ? `, tonight ${time(night.start)}–${time(night.end)}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-5 pointer-fine:gap-4" data-day-sheet data-day-shows={state}
      data-day-at={shownStop === null ? undefined : stops[shownStop]!.minute}>
      {/* The day, first, so stepping through it is always in reach. */}
      <section className="border-b border-border pb-4 pointer-fine:pb-3" aria-label="Through the day">
        <DaySlider
          stops={stops}
          nights={nights}
          spans={spans}
          at={shownStop}
          nowIndex={nowIndex}
          onGo={goTo}
          labelOf={stopInWords}
          tick={(m) => clock(hhmm(m))}
          caption={shownStop === null ? undefined : sceneInWords(sceneOf(shownStop))}
          back={(state !== 'active' || previewDashboardId) && (
            <button type="button" className={cn(chip(false), 'shrink-0')} onClick={backToInUse} data-day-back>Back to in use</button>
          )}
        />
      </section>

      {/* The screen's own day: what it shows idle and at night, and when night is. */}
      <section className="flex flex-col gap-2 pointer-fine:gap-1.5" aria-label="Resting and night" data-day-look>
        <Row name="Resting">
          <select className={field} value={pair.day} aria-label="While resting" data-resting-look
            onChange={(e) => { change({ day: e.target.value as IdleSource }); show('resting'); }}>
            {RESTING.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* Resting is not a time of day, so it is seen here, not on the line. */}
          <button type="button" className={cn(chip(state === 'resting'), 'ml-auto')} aria-pressed={state === 'resting'}
            onClick={() => show('resting')} data-see="resting">
            See it
          </button>
        </Row>
        <Fold name="At night" summary={nightInShort()} colorIndex={-1} open={openRow === 'night'} onToggle={() => toggle()} data-night-row>
          <span className="flex flex-wrap items-center gap-2">
            <select className={field} value={pair.night} aria-label="Night look" data-night-look
              onChange={(e) => {
                const look = e.target.value as IdleSource;
                // Only the look: how much darker is the screen's own choice,
                // set beside it, and never changed from here (#1345).
                change({ night: look });
                show('night');
              }}>
              {NIGHT_LOOKS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={field} value={rule.by} aria-label="When night is" data-night-when
              onChange={(e) => { change({ switch: e.target.value === 'clock' ? SET_TIMES : DEFAULT_NIGHT }); show('night'); }}>
              <option value="sun">Dusk to dawn</option>
              <option value="clock">Set times</option>
            </select>
          </span>
          {rule.by === 'sun' && night && (
            <p className="m-0 text-body text-muted-foreground" data-night-times>
              Tonight <span data-night-start>{time(night.start)}</span> to <span data-night-end>{time(night.end)}</span>
              {guessed && ', guessed from the time zone until a location is set in Settings > General'}.
            </p>
          )}
          {/* When night starts and ends, each edge on one line in a narrow panel. */}
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
        </Fold>

        {/* Out of the fold, so why Done is refused shows with the row closed. */}
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
          This is the screen&apos;s own: it idles this way whichever dashboard is up. Done saves it to this screen.
        </p>
      </section>

      <section>
        <button type="button" className={chip(moreOpen)} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} data-day-more>
          More
        </button>
        {moreOpen && (
          <div className="mt-4 flex flex-col gap-4 pointer-fine:mt-3 pointer-fine:gap-3">
            <p className="m-0 text-body text-muted-foreground">
              Photos and the night sky have their own arrangement: See it on Resting, or step to night on the line, then Widgets.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(false)} onClick={() => setMotionOpen(true)}>Screensaver motion</button>
              {/* Screen fit and performance are the editor's Look > This screen (#1313). */}
              {onOpenLook && (
                <button type="button" className={chip(false)} onClick={onOpenLook} data-day-open-look>Screen fit and performance</button>
              )}
            </div>
          </div>
        )}
      </section>
      <ScreensaverSettingsPanel open={motionOpen} onClose={() => setMotionOpen(false)} />
    </div>
  );
}
