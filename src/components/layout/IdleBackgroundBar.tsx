'use client';

import { useState } from 'react';
import { MAX_OFFSET_MINUTES, type IdleBackground } from '@/lib/idleBackground';
import type { IdleSwitchCheck } from './useIdleSwitchCheck';

/**
 * Pieces of the night rule's editor (#782), used by the Through the day
 * sheet (#1152): an edge's offset, and why Done is refused.
 */

const field = 'min-h-[44px] rounded-lg border border-border bg-background px-2 text-body';

/**
 * One edge's offset: a number of minutes or hours, before or after dusk or
 * dawn. Stored as signed minutes, positive being later.
 */
export function OffsetInput({ label, edge, minutes, order, onChange }: {
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
    <span className="flex flex-wrap items-center gap-2 text-body" data-offset={edge}>
      <span className="w-14 text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        max={unit === 'hr' ? 12 : MAX_OFFSET_MINUTES}
        step={unit === 'hr' ? 0.5 : 5}
        value={n}
        aria-label={`${label}: amount`}
        onChange={(e) => emit({ n: Number(e.target.value) || 0 })}
        className={`${field} w-20`}
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

/** Why Save is refused for this background, or null. */
export function idleSaveProblem(value: IdleBackground, check: IdleSwitchCheck): string | null {
  if (!('switch' in value)) return null;
  if (value.switch.by === 'clock' && value.switch.from === value.switch.to) {
    return 'Night must start and end at different times.';
  }
  if (check.crossed) return 'With these offsets night would end before it starts. Make them smaller to save.';
  return null;
}
