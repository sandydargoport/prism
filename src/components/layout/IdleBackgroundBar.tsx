'use client';

import { useState } from 'react';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { formatTimeOfDay } from '@/components/calendar/cells/itemTime';
import {
  MAX_OFFSET_MINUTES, type IdleBackground, type IdleSource, type IdleSwitch,
} from '@/lib/idleBackground';
import type { IdleHalf } from '@/components/dashboard/useDashboardLayout';
import type { IdleSwitchCheck } from './useIdleSwitchCheck';

const SOURCES: { value: IdleSource; label: string }[] = [
  { value: 'dashboard', label: 'This dashboard' },
  { value: 'photos', label: 'Photos' },
  { value: 'sky', label: 'Night sky' },
];

const AUTO: IdleSwitch = { by: 'sun', duskOffset: 0, dawnOffset: 0 };
const SET_TIMES: IdleSwitch = { by: 'clock', from: '21:00', to: '06:30' };

const pill = (on: boolean) =>
  `px-2 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
    on ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
  }`;
const field = 'border border-border rounded px-1.5 py-0.5 text-xs bg-background';

/** "HH:MM" on the display's own clock, which is the one it switches by. */
const clockOf = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * One edge's offset: a number of minutes or hours, before or after dusk or
 * dawn. Stored as signed minutes, positive being later.
 */
function OffsetInput({ label, edge, minutes, order, onChange }: {
  label: string;
  edge: 'dusk' | 'dawn';
  minutes: number;
  order: ['after', 'before'] | ['before', 'after'];
  onChange: (minutes: number) => void;
}) {
  const amount = Math.abs(minutes);
  // Kept here, so a 0 typed while in hours stays in hours.
  const [unit, setUnit] = useState<'min' | 'hr'>(amount > 0 && amount % 60 === 0 ? 'hr' : 'min');
  // At zero, the way the sentence reads first: after dusk, before dawn.
  const [dir, setDir] = useState<'after' | 'before'>(minutes < 0 ? 'before' : minutes > 0 ? 'after' : order[0]);
  const n = unit === 'hr' ? amount / 60 : amount;
  const emit = (next: { n?: number; unit?: 'min' | 'hr'; dir?: 'after' | 'before' }) => {
    const u = next.unit ?? unit;
    const d = next.dir ?? dir;
    const count = Math.max(0, next.n ?? n);
    const m = Math.min(MAX_OFFSET_MINUTES, Math.round(count * (u === 'hr' ? 60 : 1)));
    onChange(d === 'before' ? -m : m);
  };
  return (
    <span className="flex items-center gap-1 text-xs" data-offset={edge}>
      <span className="text-muted-foreground w-10">{label}</span>
      <input
        type="number"
        min={0}
        max={unit === 'hr' ? 12 : MAX_OFFSET_MINUTES}
        step={unit === 'hr' ? 0.5 : 5}
        value={n}
        aria-label={`${label}: amount`}
        onChange={(e) => emit({ n: Number(e.target.value) || 0 })}
        className={`${field} w-14`}
      />
      <select
        value={unit}
        aria-label={`${label}: unit`}
        onChange={(e) => { const u = e.target.value as 'min' | 'hr'; setUnit(u); emit({ unit: u }); }}
        className={field}
      >
        <option value="min">min</option>
        <option value="hr">hr</option>
      </select>
      <select
        value={dir}
        aria-label={`${label}: before or after`}
        onChange={(e) => { const d = e.target.value as 'after' | 'before'; setDir(d); emit({ dir: d }); }}
        className={field}
      >
        {order.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span>{edge}</span>
    </span>
  );
}

/**
 * The Idle screen tab's "Behind it" (#782): one background all the time, or
 * one by day and one after dark, switching at dusk and dawn (each edge moved
 * by an offset) or at set times. Nothing here is stored until Save.
 */
export function IdleBackgroundBar({ value, onChange, half, onHalfChange, check }: {
  value: IdleBackground;
  onChange: (bg: IdleBackground) => void;
  half: IdleHalf;
  onHalfChange: (half: IdleHalf) => void;
  check: IdleSwitchCheck;
}) {
  const { timeFormat } = useTimeFormat();
  const pair = 'switch' in value ? value : null;
  const single = 'source' in value ? value.source : null;
  const time = (d: Date) => formatTimeOfDay(clockOf(d), timeFormat);
  const dayWord = (d: Date) => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return 'tonight';
    if (d.toDateString() === tomorrow.toDateString()) return 'tomorrow';
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  };

  const choosePair = () => {
    if (pair) return;
    onChange({ day: single === 'sky' ? 'dashboard' : single ?? 'dashboard', night: 'sky', switch: AUTO });
  };
  const setSwitch = (sw: IdleSwitch) => pair && onChange({ ...pair, switch: sw });

  return (
    <div className="mt-2 flex flex-col gap-2 text-xs" data-idle-background-bar>
      <div className="flex items-center gap-1.5 flex-wrap" role="radiogroup" aria-label="Behind it">
        <span className="text-muted-foreground mr-1">Behind it:</span>
        {SOURCES.map((s) => (
          <button
            key={s.value}
            role="radio"
            aria-checked={single === s.value}
            onClick={() => onChange({ source: s.value })}
            className={pill(single === s.value)}
          >
            {s.label}
          </button>
        ))}
        <button role="radio" aria-checked={!!pair} onClick={choosePair} className={pill(!!pair)}>
          Changes with the time of day
        </button>
        {pair && (
          <span className="flex items-center gap-1 ml-3" role="group" aria-label="Preview">
            <span className="text-muted-foreground">Preview:</span>
            {(['day', 'night'] as const).map((h) => (
              <button key={h} aria-pressed={half === h} onClick={() => onHalfChange(h)} className={pill(half === h)}>
                {h === 'day' ? 'Day' : 'Night'}
              </button>
            ))}
          </span>
        )}
      </div>

      {pair && (
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            {(['day', 'night'] as const).map((h) => (
              <label key={h} className="flex items-center gap-1.5">
                <span className="text-muted-foreground w-16">{h === 'day' ? 'By day' : 'After dark'}</span>
                <select
                  value={pair[h]}
                  onChange={(e) => { onChange({ ...pair, [h]: e.target.value as IdleSource }); onHalfChange(h); }}
                  className={field}
                >
                  {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={pair.switch.by === 'sun'} onChange={() => setSwitch(AUTO)} />
              Automatically, from dusk to dawn
            </label>
            {pair.switch.by === 'sun' && (() => {
              const sw = pair.switch;
              return (
                <div className="flex flex-col gap-1 pl-5">
                  <span className="flex items-center gap-2">
                    <OffsetInput
                      label="Starts" edge="dusk" minutes={sw.duskOffset} order={['after', 'before']}
                      onChange={(m) => setSwitch({ ...sw, duskOffset: m })}
                    />
                    {check.night && <span className="text-muted-foreground" data-night-start>({dayWord(check.night.start)} {time(check.night.start)})</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <OffsetInput
                      label="Ends" edge="dawn" minutes={sw.dawnOffset} order={['before', 'after']}
                      onChange={(m) => setSwitch({ ...sw, dawnOffset: m })}
                    />
                    {check.night && <span className="text-muted-foreground" data-night-end>({dayWord(check.night.end)} {time(check.night.end)})</span>}
                  </span>
                  {check.guessedLocation && (
                    <span className="text-muted-foreground">
                      No location is set in Settings &gt; General, so dusk and dawn are guessed from the time zone.
                    </span>
                  )}
                </div>
              );
            })()}
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={pair.switch.by === 'clock'} onChange={() => setSwitch(SET_TIMES)} />
              At set times
            </label>
            {pair.switch.by === 'clock' && (() => {
              const sw = pair.switch;
              return (
                <span className="flex items-center gap-1.5 pl-5">
                  <input
                    type="time" value={sw.from} aria-label="Night starts"
                    onChange={(e) => e.target.value && setSwitch({ ...sw, from: e.target.value })}
                    className={field}
                  />
                  to
                  <input
                    type="time" value={sw.to} aria-label="Night ends"
                    onChange={(e) => e.target.value && setSwitch({ ...sw, to: e.target.value })}
                    className={field}
                  />
                </span>
              );
            })()}
          </div>
        </div>
      )}

      {check.crossed && (
        <p role="alert" className="text-destructive" data-idle-crossed>
          With these offsets night would end before it starts around{' '}
          {check.crossed.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}, when dusk and dawn are
          close together. Make the offsets smaller to save.
        </p>
      )}
      {pair?.switch.by === 'clock' && pair.switch.from === pair.switch.to && (
        <p role="alert" className="text-destructive" data-idle-crossed>
          Night must start and end at different times.
        </p>
      )}
    </div>
  );
}

/** Why Save is refused for this background, or null. */
export function idleSaveProblem(value: IdleBackground, check: IdleSwitchCheck): string | null {
  if (!('switch' in value)) return null;
  if (value.switch.by === 'clock' && value.switch.from === value.switch.to) {
    return 'Night must start and end at different times.';
  }
  if (check.crossed) return 'With these offsets night would end before it starts. Make them smaller to save.';
  return null;
}
