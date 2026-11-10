'use client';

/**
 * The editing bar's Through the day sheet (#1152): the three states a screen
 * is in, Active, Resting and Night, then the screen's Interludes, in one strip.
 * Tapping a state shows the screen in it at once, and a slider plays the day
 * so 9:30 pm can be seen now.
 *
 * Below the strip, what each state is: how long until it rests, what shows
 * while it rests, when night is, and what night looks like. The rarer
 * settings sit behind More.
 *
 * The backdrop and the night rule are the dashboard's and are saved with
 * Done. How long until it rests, how dark, and the Interludes are this
 * screen's own settings and are kept as soon as they change, as they are in
 * Settings.
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { formatTimeOfDay } from '@/components/calendar/cells/itemTime';
import { ScreensaverSettingsPanel } from '@/components/screensaver/ScreensaverQuickSettings';
import { useSkyLocation } from '@/components/screensaver/useIdleBackground';
import { DIM_LEVELS, useIdleDimSetting } from '@/components/screensaver/idleDim';
import { ScreenSchedulePanel } from '@/app/settings/sections/ScreenSchedulePanel';
import { SCREENSAVER_TIMEOUT_OPTIONS, useScreensaverTimeout } from '@/lib/hooks/useScreensaverTimeout';
import { useStoredString, writeStored } from '@/lib/hooks/useStoredValue';
import { loadBase } from '@/lib/displays/displaySettingsSync';
import { remoteEditHost } from '@/lib/displays/remoteEdit';
import { parseSchedule, scheduledDashboard, SCREEN_SCHEDULE_KEY, type ScheduleRule } from '@/lib/displays/screenSchedule';
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

const section = 'm-0 mb-2 text-caption font-medium uppercase tracking-[0.1em] text-muted-foreground';
const chip = (on: boolean) => cn(
  'flex min-h-[48px] items-center rounded-full border-[1.5px] px-4 text-body transition-colors',
  on ? 'border-foreground bg-foreground text-background' : 'border-foreground/30 hover:bg-muted',
);
const field = 'min-h-[44px] rounded-lg border border-border bg-background px-2 text-body';

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

  const state: ScreenState = editTab !== 'idle' ? 'active' : idleHalf === 'night' ? 'night' : 'resting';
  const show = (s: ScreenState) => {
    if (s === 'active') { onEditTabChange?.('dashboard'); return; }
    onEditTabChange?.('idle');
    onIdleHalfChange?.(s === 'night' ? 'night' : 'day');
  };
  const change = (patch: Partial<typeof pair>) => onIdleBackgroundChange?.(simplest({ ...pair, ...patch }));

  // The slider: a time of day, and what the screen is at that time while
  // nobody is using it.
  const [played, setPlayed] = useState<number | null>(null);
  const playedAt = (minute: number) => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(minute / 60), minute % 60);
  };
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

  const night = tonight(new Date(), rule, lat, lon);
  const homeId = named?.dashboardId ?? allDashboards.find((d) => d.isDefault)?.id ?? currentDashboardId ?? '';

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
          {interludes.map((r: ScheduleRule, i) => {
            const target = allDashboards.find((d) => d.id === r.dashboardId);
            return (
              <button
                key={i}
                type="button"
                onClick={() => target?.slug && onSwitchDashboard?.(target.slug)}
                disabled={!target?.slug || target.id === currentDashboardId}
                className={cn(chip(false), 'disabled:opacity-60')}
                title={target?.slug ? `Open ${target.name}` : undefined}
                data-day-interlude={i}
              >
                {dashboardName(r.dashboardId)}, {daysInWords(r.days).toLowerCase()} {formatTimeOfDay(r.from, timeFormat)} to {formatTimeOfDay(r.to, timeFormat)}
              </button>
            );
          })}
        </div>
        <label className="mt-4 flex flex-col gap-2">
          <span className="text-body text-muted-foreground" aria-live="polite" data-day-played>
            {played === null
              ? 'Slide to see the screen at another time of day.'
              : `At ${formatTimeOfDay(clockOf(playedAt(played)), timeFormat)}: ${state === 'night' ? 'night' : 'resting'}${playedInterlude ? `, ${dashboardName(playedInterlude.dashboardId)} shows (an Interlude)` : ''}.`}
          </span>
          <input
            type="range"
            min={0}
            max={24 * 60 - 15}
            step={15}
            value={played ?? new Date().getHours() * 60}
            onChange={(e) => play(Number(e.target.value))}
            aria-label="Time of day"
            className="w-full"
            data-day-slider
          />
        </label>
      </section>

      <section>
        <h3 className={section}>Resting</h3>
        <div className="flex flex-col gap-3">
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
      </section>

      <section>
        <h3 className={section}>Night</h3>
        <div className="flex flex-col gap-3">
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
          ) : night && (
            <p className="m-0 text-body text-muted-foreground" data-night-times>
              Tonight <span data-night-start>{time(night.start)}</span> to <span data-night-end>{time(night.end)}</span>
              {guessed && ', guessed from the time zone until a location is set in Settings > General'}.
            </p>
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
          {idleCheck.crossed && (
            <p role="alert" className="m-0 text-body text-destructive" data-idle-crossed>
              With these offsets night would end before it starts around{' '}
              {idleCheck.crossed.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}. Make them smaller to save.
            </p>
          )}
          {rule.by === 'clock' && rule.from === rule.to && (
            <p role="alert" className="m-0 text-body text-destructive" data-idle-crossed>Night must start and end at different times.</p>
          )}
        </div>
      </section>

      <section>
        <h3 className={section}>Interludes</h3>
        {named ? (
          <ScreenSchedulePanel
            name="This screen"
            stored={storedSchedule ?? undefined}
            dashboards={allDashboards.map((d) => ({ id: d.id, name: d.name }))}
            homeId={homeId}
            online
            savedText={remoteEditHost() ? 'Kept. The screen gets it when you press Done.' : 'Saved. This screen follows it from now on.'}
            save={async (raw) => { writeStored(SCREEN_SCHEDULE_KEY, raw); return true; }}
          />
        ) : (
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
            {rule.by === 'sun' && (
              <div className="flex flex-col gap-2">
                <span className="text-body">Move night&apos;s edges</span>
                <OffsetInput label="Starts" edge="dusk" minutes={rule.duskOffset} order={['after', 'before']}
                  onChange={(m) => change({ switch: { ...rule, duskOffset: m } })} />
                <OffsetInput label="Ends" edge="dawn" minutes={rule.dawnOffset} order={['before', 'after']}
                  onChange={(m) => change({ switch: { ...rule, dawnOffset: m } })} />
              </div>
            )}
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
