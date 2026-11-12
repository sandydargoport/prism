'use client';

/**
 * The editing bar's Through the day sheet (#1152): the three states a screen
 * is in, Active, Resting and Night, then the day as a line (#1170). The line
 * has a dot where night starts and ends, a stretch for resting and for night,
 * and a block for each Interlude. Tapping one shows the screen at that time
 * and opens a card under the line with only its settings. A slider plays the
 * day so 9:30 pm can be seen now. The rarer settings sit behind More.
 *
 * The backdrop and the night rule are the dashboard's and are saved with
 * Done. How long until it rests, how dark, and the Interludes are this
 * screen's own settings and are kept as soon as they change, as they are in
 * Settings.
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { formatTimeOfDay } from '@/components/calendar/cells/itemTime';
import { ScreensaverSettingsPanel } from '@/components/screensaver/ScreensaverQuickSettings';
import { useSkyLocation } from '@/components/screensaver/useIdleBackground';
import { DIM_LEVELS, useIdleDimSetting } from '@/components/screensaver/idleDim';
import { SCREENSAVER_TIMEOUT_OPTIONS, useScreensaverTimeout } from '@/lib/hooks/useScreensaverTimeout';
import { useStoredString, writeStored } from '@/lib/hooks/useStoredValue';
import { loadBase } from '@/lib/displays/displaySettingsSync';
import { remoteEditHost } from '@/lib/displays/remoteEdit';
import { MAX_SCHEDULE_RULES, parseSchedule, scheduledDashboard, serializeSchedule, SCREEN_SCHEDULE_KEY, type ScheduleRule } from '@/lib/displays/screenSchedule';
import { DAY_MINUTES, dayLine, hhmm, interludeSpans } from '@/lib/dayLine';
import { sameIdleBackground, tonight, type IdleBackground, type IdleSource, type IdleSwitch } from '@/lib/idleBackground';
import { asDayAndNight, DEFAULT_NIGHT, screenStateAt, type ScreenState } from '@/lib/throughTheDay';
import type { IdleHalf, EditTab } from '@/components/dashboard/useDashboardLayout';
import { OffsetInput } from './IdleBackgroundBar';
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
  { value: 'off', label: 'Screen off' },
];
const SET_TIMES: IdleSwitch = { by: 'clock', from: '21:00', to: '06:30' };

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const chip = (on: boolean) => cn(
  'flex min-h-[48px] items-center rounded-full border-[1.5px] px-4 text-body transition-colors',
  on ? 'border-foreground bg-foreground text-background' : 'border-foreground/30 hover:bg-muted',
);
const field = 'min-h-[44px] rounded-lg border border-border bg-background px-2 text-body';
const card = 'flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4';

/** What is open under the line. */
type Picked =
  | { kind: 'night'; edge?: 'start' | 'end' }
  | { kind: 'resting' }
  | { kind: 'interlude'; index: number };

/** Left edge, as a share of the line, of a minute of the day. */
const at = (minute: number) => `${(minute / DAY_MINUTES) * 100}%`;

/** "HH:MM" for a time on the display's own clock. */
const clockOf = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** The days of an Interlude in words: "Weekdays", "Every day", "Sat, Sun". */
export function daysInWords(days: number[]): string {
  const set = [...days].sort().join(',');
  if (set === '0,1,2,3,4,5,6') return 'Every day';
  if (set === '1,2,3,4,5') return 'Weekdays';
  if (set === '0,6') return 'Weekends';
  return days.map((d) => DAY_NAMES[d]).join(', ');
}

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

export function ThroughTheDaySheet({
  idleBackground, onIdleBackgroundChange, idleHalf, onIdleHalfChange, editTab, onEditTabChange, idleCheck,
  allDashboards = [], currentDashboardId, onSwitchDashboard,
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
}) {
  const { timeFormat, householdTimezone } = useTimeFormat();
  const [moreOpen, setMoreOpen] = useState(false);
  const [motionOpen, setMotionOpen] = useState(false);
  const { timeout, setTimeout } = useScreensaverTimeout();
  const { level: dim, setLevel: setDim } = useIdleDimSetting();
  const storedSchedule = useStoredString(SCREEN_SCHEDULE_KEY);
  const interludes = useMemo(() => parseSchedule(storedSchedule), [storedSchedule]);
  // Interludes belong to a named screen: its settings are kept on its row.
  const [named] = useState(() => (typeof window === 'undefined' ? null : loadBase()));

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

  // The day the line shows: today, or the next one of another weekday.
  const today = new Date();
  const [weekday, setWeekday] = useState(today.getDay());
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ((weekday - today.getDay() + 7) % 7));
  const line = dayLine(day, rule, lat, lon);
  const spans = interludeSpans(interludes, weekday);

  // The slider: a time of day, and what the screen is at that time while
  // nobody is using it.
  const [played, setPlayed] = useState<number | null>(null);
  const playedAt = (minute: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minute / 60), minute % 60);
  const play = (minute: number) => {
    setPlayed(minute);
    show(screenStateAt({ idle: true, now: playedAt(minute), rule, lat, lon }));
  };
  const playedInterlude = (() => {
    if (played === null) return null;
    const { rule: i } = scheduledDashboard(interludes, playedAt(played), householdTimezone, (id) => allDashboards.some((d) => d.id === id));
    return i === -1 ? null : interludes[i]!;
  })();
  const dashboardName = (id: string) => allDashboards.find((d) => d.id === id)?.name ?? 'a dashboard';

  const [picked, setPicked] = useState<Picked | null>(null);
  const isPicked = (p: Picked) => !!picked && picked.kind === p.kind
    && (p.kind !== 'interlude' || (picked.kind === 'interlude' && picked.index === p.index))
    && (p.kind !== 'night' || (picked.kind === 'night' && picked.edge === p.edge));

  const night = tonight(new Date(), rule, lat, lon);
  const homeId = named?.dashboardId ?? allDashboards.find((d) => d.isDefault)?.id ?? currentDashboardId ?? '';

  // Interludes are the screen's own and are kept as they change, as in Settings.
  const saveInterludes = (next: ScheduleRule[]) => writeStored(SCREEN_SCHEDULE_KEY, serializeSchedule(next));
  const editInterlude = (i: number, patch: Partial<ScheduleRule>) => saveInterludes(interludes.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  /** Moves an Interlude up or down the order that decides which wins an overlap. */
  const moveInterlude = (i: number, by: -1 | 1) => {
    const next = [...interludes];
    const [r] = next.splice(i, 1);
    next.splice(i + by, 0, r!);
    saveInterludes(next);
    setPicked({ kind: 'interlude', index: i + by });
  };
  const addInterlude = () => {
    const from = Math.floor((played ?? (today.getHours() * 60 + today.getMinutes())) / 15) * 15;
    const others = allDashboards.filter((d) => d.id !== homeId);
    const target = others[0] ?? allDashboards[0];
    if (!target) return;
    saveInterludes([...interludes, { days: [weekday], from: hhmm(from), to: hhmm(from + 60), dashboardId: target.id }]);
    setPicked({ kind: 'interlude', index: interludes.length });
    setPlayed(from);
  };

  const nightLabel = NIGHT_LOOKS.find((o) => o.value === pair.night)?.label ?? (pair.night === 'photos' ? 'Photos' : '');
  const restingLabel = RESTING.find((o) => o.value === pair.day)?.label ?? '';

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

  const interludeCard = (i: number) => {
    const r = interludes[i];
    if (!r) return null;
    const target = allDashboards.find((d) => d.id === r.dashboardId);
    return (
      <div className={card} data-day-card="interlude">
        <span className="flex flex-wrap items-center gap-2 text-body">
          Show
          <select className={field} value={r.dashboardId} aria-label="Interlude dashboard" onChange={(e) => editInterlude(i, { dashboardId: e.target.value })}>
            {allDashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          from
          <input type="time" className={field} value={r.from} aria-label="Interlude starts"
            onChange={(e) => e.target.value && editInterlude(i, { from: e.target.value })} />
          to
          <input type="time" className={field} value={r.to} aria-label="Interlude ends"
            onChange={(e) => e.target.value && editInterlude(i, { to: e.target.value })} />
        </span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Interlude days">
          {DAY_FULL.map((name, d) => {
            const on = r.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-label={name}
                aria-pressed={on}
                // An Interlude keeps at least one day; Remove takes it away.
                disabled={on && r.days.length === 1}
                onClick={() => editInterlude(i, { days: on ? r.days.filter((x) => x !== d) : [...r.days, d].sort() })}
                className={cn('flex h-11 w-11 items-center justify-center rounded-full text-caption font-medium disabled:opacity-100',
                  on ? 'bg-foreground text-background' : 'border border-foreground/30 text-muted-foreground')}
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
          <button type="button" className={chip(false)} data-interlude-remove
            onClick={() => { saveInterludes(interludes.filter((_, j) => j !== i)); setPicked(null); }}>
            <X className="mr-1 h-4 w-4" />Remove
          </button>
        </div>
        {interludes.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 text-body" data-interlude-order>
            <span>When Interludes overlap, the higher one wins. This one is {i + 1} of {interludes.length}.</span>
            <button type="button" className={cn(chip(false), 'disabled:opacity-40')} disabled={i === 0} onClick={() => moveInterlude(i, -1)} aria-label="Move this Interlude up">
              <ArrowUp className="mr-1 h-4 w-4" />Higher
            </button>
            <button type="button" className={cn(chip(false), 'disabled:opacity-40')} disabled={i === interludes.length - 1} onClick={() => moveInterlude(i, 1)} aria-label="Move this Interlude down">
              <ArrowDown className="mr-1 h-4 w-4" />Lower
            </button>
          </div>
        )}
        <p className="m-0 text-caption text-muted-foreground">
          {remoteEditHost() ? 'Kept. The screen gets it when you press Done.' : 'Kept. A change waits until nobody has touched the screen for a minute.'}
          {' '}Times are in the household time zone.
        </p>
      </div>
    );
  };

  const playedMinute = played ?? (playedAt(0).toDateString() === today.toDateString() ? today.getHours() * 60 + today.getMinutes() : null);

  return (
    <div className="flex flex-col gap-6" data-day-sheet>
      <section>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Show the screen">
          {(['active', 'resting', 'night'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={state === s}
              onClick={() => { setPlayed(null); show(s); }}
              className={chip(state === s)}
              data-day-state={s}
            >
              {s === 'active' ? 'Active' : s === 'resting' ? 'Resting' : 'Night'}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select className={field} value={weekday} onChange={(e) => { setWeekday(Number(e.target.value)); setPlayed(null); }} aria-label="Day shown" data-day-weekday>
            {DAY_FULL.map((name, d) => <option key={d} value={d}>{d === today.getDay() ? `Today (${name})` : name}</option>)}
          </select>
          {named && (
            <button type="button" className={cn(chip(false), 'ml-auto')} onClick={addInterlude}
              disabled={interludes.length >= MAX_SCHEDULE_RULES || allDashboards.length === 0} data-interlude-add>
              <Plus className="mr-1 h-4 w-4" />Interlude
            </button>
          )}
        </div>

        <div className="relative h-11" data-day-line>
          {line.stretches.map((st) => (
            <button
              key={`${st.kind}-${st.from}`}
              type="button"
              onClick={() => { setPicked({ kind: st.kind }); play(Math.floor((st.from + st.to) / 2)); }}
              aria-label={`${st.kind === 'night' ? `Night: ${nightLabel}` : `Resting: ${restingLabel}`}, ${timeOfMinute(st.from)} to ${timeOfMinute(st.to)}`}
              aria-pressed={isPicked({ kind: st.kind })}
              className={cn(
                'absolute inset-y-0 overflow-hidden whitespace-nowrap px-3 text-left text-caption first:rounded-l-full last:rounded-r-full',
                st.kind === 'night' ? 'bg-foreground/85 text-background' : 'bg-muted text-foreground',
                isPicked({ kind: st.kind }) && 'ring-2 ring-inset ring-primary',
              )}
              style={{ left: at(st.from), width: at(st.to - st.from) }}
              data-day-stretch={st.kind}
            >
              {st.kind === 'night' ? nightLabel : restingLabel}
            </button>
          ))}
          {spans.map((sp) => (
            <button
              key={`i-${sp.index}-${sp.from}`}
              type="button"
              onClick={() => { setPicked({ kind: 'interlude', index: sp.index }); play(sp.from); }}
              aria-label={`Interlude: ${dashboardName(interludes[sp.index]!.dashboardId)}, ${timeOfMinute(sp.from)} to ${timeOfMinute(sp.to)}`}
              aria-pressed={isPicked({ kind: 'interlude', index: sp.index })}
              className={cn(
                'absolute inset-y-1 z-10 overflow-hidden whitespace-nowrap rounded-md bg-primary px-1 text-caption text-primary-foreground',
                isPicked({ kind: 'interlude', index: sp.index }) && 'ring-2 ring-foreground',
              )}
              style={{ left: at(sp.from), width: at(sp.to - sp.from) }}
              data-day-interlude={sp.index}
            >
              {dashboardName(interludes[sp.index]!.dashboardId)}
            </button>
          ))}
          {playedMinute !== null && (
            <span aria-hidden className="pointer-events-none absolute -inset-y-1 z-20 w-0.5 -translate-x-1/2 rounded-full bg-primary" style={{ left: at(playedMinute) }} data-day-now />
          )}
          {line.milestones.map((m) => {
            const edge = m.kind === 'night-start' ? 'start' : 'end';
            return (
              <button
                key={m.kind}
                type="button"
                onClick={() => { setPicked({ kind: 'night', edge }); play(edge === 'start' ? m.minute : Math.max(0, m.minute - 1)); }}
                aria-label={`Night ${edge === 'start' ? 'starts' : 'ends'} ${timeOfMinute(m.minute)}`}
                aria-pressed={isPicked({ kind: 'night', edge })}
                className="absolute top-1/2 z-30 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: at(m.minute) }}
                data-day-milestone={m.kind}
              >
                <span className={cn('h-4 w-4 rounded-full border-2 border-background bg-primary shadow',
                  isPicked({ kind: 'night', edge }) && 'h-5 w-5 ring-2 ring-primary')} />
              </button>
            );
          })}
        </div>
        <div className="relative h-5 text-caption text-muted-foreground" aria-hidden>
          {line.milestones.map((m) => (
            <span key={m.kind} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: at(m.minute) }}>
              {timeOfMinute(m.minute)}
            </span>
          ))}
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-body text-muted-foreground" aria-live="polite" data-day-played>
            {played === null
              ? 'Tap the line to change that part of the day, or slide to see the screen at another time.'
              : `At ${formatTimeOfDay(clockOf(playedAt(played)), timeFormat)}: ${state === 'night' ? 'night' : 'resting'}${playedInterlude ? `, ${dashboardName(playedInterlude.dashboardId)} shows (an Interlude)` : ''}.`}
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
        {picked?.kind === 'interlude' && interludeCard(picked.index)}

        {idleCheck.crossed && (
          <p role="alert" className="m-0 text-body text-destructive" data-idle-crossed>
            With these offsets night would end before it starts around{' '}
            {idleCheck.crossed.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}. Make them smaller to save.
          </p>
        )}
        {rule.by === 'clock' && rule.from === rule.to && (
          <p role="alert" className="m-0 text-body text-destructive" data-idle-crossed>Night must start and end at different times.</p>
        )}
        {!named && (
          <p className="m-0 text-body text-muted-foreground" data-interludes-unnamed>
            An Interlude shows another dashboard for a while, like the bus each school morning. They belong to a
            named screen: <Link href="/settings?section=displays" className="underline">name this one in Settings &gt; Screens</Link>.
          </p>
        )}
      </section>

      <section>
        <button type="button" className={chip(moreOpen)} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} data-day-more>
          More
        </button>
        {moreOpen && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Night backdrop">
              <span className="self-center text-body">A different night backdrop:</span>
              <button type="button" role="radio" aria-checked={pair.night === 'photos'} onClick={() => { change({ night: 'photos' }); show('night'); }} className={chip(pair.night === 'photos')}>
                Photos
              </button>
            </div>
            <p className="m-0 text-body text-muted-foreground">
              Photos and the night sky have their own arrangement: choose Resting or Night above, then Widgets.
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
