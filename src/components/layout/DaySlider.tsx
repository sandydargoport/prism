'use client';

/**
 * The Through the day slider (#1294): the day as a line, a dot wherever what
 * the screen shows changes, and ◀ ▶ to step from one to the next. Dragging
 * snaps to the nearest dot. It only shows: the stop picked is the moment the
 * canvas shows, and nothing is set on the line.
 */
import * as React from 'react';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DAY_MINUTES, nearestStop, type NightSpan, type Stop, type SwitchSpan } from '@/lib/dayWaypoints';
import { cn } from '@/lib/utils';

const pct = (minute: number) => `${(minute / DAY_MINUTES) * 100}%`;
/** What a stop's dot stands for: its change, or now when nothing changes then. */
const kindOf = (s: Stop) => s.marks.find((m) => m.kind !== 'now')?.kind ?? 'now';

/**
 * Each switch's colour, by its place in the list, so its stretch and dots on
 * the line match the dot on its row. They follow the theme: the first is the
 * theme's own hue, and each next one turns the golden angle further round the
 * wheel, so neighbours stay far apart. Saturation and lightness come from
 * globals.css, deeper in light mode and lighter in dark, as a theme's primary
 * can be near black or near white.
 */
const GOLDEN_ANGLE = 137.5;
export const switchColor = (index: number) =>
  `hsl(from hsl(var(--primary)) calc(h + ${(index * GOLDEN_ANGLE) % 360}) var(--day-switch-s, 65%) var(--day-switch-l, 50%))`;
/** The same, fixed, for a browser that cannot work a colour out from another. */
const FALLBACK = ['#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4'];
const fallbackOf = (index: number) => FALLBACK[index % FALLBACK.length]!;
/** Night's colour, on the line and on the At night row: the theme's quiet ink. */
export const NIGHT_COLOR = 'hsl(var(--muted-foreground))';

/** A switch's colour, or night's for -1, as a background with its fallback underneath. */
function paint(index: number): { className: string; style: React.CSSProperties; color: string } {
  if (index < 0) return { className: '', style: { backgroundColor: NIGHT_COLOR }, color: NIGHT_COLOR };
  const color = switchColor(index);
  // Inline beats the class, unless the browser drops it as a colour it cannot read.
  return { className: 'bg-[var(--fallback)]', style: { ['--fallback' as string]: fallbackOf(index), backgroundColor: color }, color };
}
/** A stop's switch, -1 for night, or null for now. */
const paintIndex = (s: Stop): number | null => {
  const mark = s.marks.find((m) => m.kind !== 'now');
  if (!mark) return null;
  return mark.switchIndex ?? -1;
};

/** A small round swatch in a switch's colour (or night's, for -1), as its dots on the line are. */
export function Swatch({ index, ...rest }: { index: number } & React.HTMLAttributes<HTMLSpanElement>) {
  const p = paint(index);
  return <span aria-hidden className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', p.className)} style={p.style} data-swatch={p.color} {...rest} />;
}
/** How far a press moves before it is a drag rather than a tap. */
const DRAG_PX = 4;
const step = 'flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent pointer-fine:h-8 pointer-fine:w-8';

export function DaySlider({ stops, nights, spans, at, nowIndex, onGo, labelOf, tick, caption, back }: {
  stops: Stop[];
  nights: NightSpan[];
  spans: SwitchSpan[];
  /** The stop the canvas shows, or null when it shows something else. */
  at: number | null;
  /** The stop that is now, where stepping starts from. */
  nowIndex: number;
  /** Go to a stop: by a step or a drag, or by a tap on its dot. */
  onGo: (index: number, tapped: boolean) => void;
  /** A stop in words: "4:54 PM, night starts". */
  labelOf: (stop: Stop) => string;
  /** A time under the line, by the household's clock: "6 AM". */
  tick: (minute: number) => string;
  /** What the canvas shows at the stop picked. */
  caption?: string;
  /** Back to in use, when the canvas shows something else. */
  back?: React.ReactNode;
}) {
  const lineRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ id: number; x: number; dragging: boolean } | null>(null);
  const from = at ?? nowIndex;

  const minuteAt = (clientX: number) => {
    const r = lineRef.current!.getBoundingClientRect();
    return Math.min(DAY_MINUTES, Math.max(0, ((clientX - r.left) / r.width) * DAY_MINUTES));
  };
  const goNear = (clientX: number) => {
    const i = nearestStop(stops, minuteAt(clientX));
    if (i !== at) onGo(i, false);
  };

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1" data-day-slider>
      <button type="button" className={step} aria-label="Earlier" disabled={from <= 0}
        onClick={() => onGo(Math.max(0, from - 1), false)} data-day-step="prev">
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <div
        ref={lineRef}
        role="group"
        aria-label="The day"
        // --hit: how far either side of a dot a tap reaches, 22px by touch and 12px with a mouse.
        className="relative h-[44px] touch-none select-none [--hit:22px] pointer-fine:h-8 pointer-fine:[--hit:12px]"
        data-day-line
        onPointerDown={(e) => { press.current = { id: e.pointerId, x: e.clientX, dragging: false }; }}
        onPointerMove={(e) => {
          const p = press.current;
          if (!p || p.id !== e.pointerId) return;
          if (!p.dragging) {
            if (Math.abs(e.clientX - p.x) < DRAG_PX) return;
            p.dragging = true;
            lineRef.current?.setPointerCapture?.(e.pointerId);
          }
          goNear(e.clientX);
        }}
        onPointerUp={() => { press.current = null; }}
        onPointerCancel={() => { press.current = null; }}
        // A tap on the line between dots goes to the nearest.
        onClick={(e) => goNear(e.clientX)}
      >
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted-foreground/20" />
        {nights.map((n) => (
          <span key={`n${n.from}`} aria-hidden className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-60"
            style={{ left: pct(n.from), width: pct(n.to - n.from), ...paint(-1).style }} data-day-night data-color={NIGHT_COLOR} />
        ))}
        {spans.map((s) => (
          <span key={`s${s.index}-${s.from}`} aria-hidden className={cn('absolute top-1/2 h-2 -translate-y-1/2 rounded-full', paint(s.index).className)}
            style={{ left: pct(s.from), width: pct(s.to - s.from), ...paint(s.index).style }} data-day-span={s.index} data-color={switchColor(s.index)} />
        ))}
        {stops.map((s, i) => {
          const kind = kindOf(s);
          const prev = stops[i - 1];
          const next = stops[i + 1];
          // Each dot takes a tap up to halfway to its neighbours, so a dot
          // 45 minutes from the next is not under the other's finger.
          const left = prev ? `max(${pct((prev.minute + s.minute) / 2)}, calc(${pct(s.minute)} - var(--hit)))` : `calc(${pct(s.minute)} - var(--hit))`;
          const right = next ? `min(${pct((s.minute + next.minute) / 2)}, calc(${pct(s.minute)} + var(--hit)))` : `calc(${pct(s.minute)} + var(--hit))`;
          return (
            <button
              key={s.minute}
              type="button"
              aria-label={labelOf(s)}
              aria-pressed={i === at}
              className="absolute inset-y-0 rounded-full focus-visible:outline-2 focus-visible:outline-foreground"
              style={{ left, width: `calc(${right} - ${left})` }}
              onClick={(e) => { e.stopPropagation(); onGo(i, true); }}
              data-waypoint={kind}
              data-waypoint-marks={s.marks.map((m) => `${m.kind}${m.switchIndex ?? ''}`).join(' ')}
              data-minute={s.minute}
            />
          );
        })}
        {stops.map((s, i) => {
          const index = paintIndex(s);
          const p = index === null ? null : paint(index);
          const on = i === at;
          return (
            <span
              key={`dot${s.minute}`}
              aria-hidden
              className={cn(
                'pointer-events-none absolute top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform',
                // The one picked is bigger, ringed in the ink colour, and keeps its own colour.
                on ? 'h-4 w-4 ring-2 ring-foreground ring-offset-1 ring-offset-background' : 'h-3 w-3 ring-1 ring-background pointer-fine:h-2.5 pointer-fine:w-2.5',
                p ? p.className : 'border-2 border-foreground bg-background',
              )}
              style={{ left: pct(s.minute), ...p?.style }}
              data-waypoint-dot={s.minute}
              data-color={p?.color}
            />
          );
        })}
      </div>
      <button type="button" className={step} aria-label="Later" disabled={from >= stops.length - 1}
        onClick={() => onGo(Math.min(stops.length - 1, from + 1), false)} data-day-step="next">
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
      {/* The hours under the line, its ends at its ends. */}
      <div className="relative col-start-2 h-4 text-caption text-muted-foreground" aria-hidden data-day-ticks>
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} className={cn('absolute top-0 whitespace-nowrap', h === 0 ? '' : h === 24 ? '-translate-x-full' : '-translate-x-1/2')}
            style={{ left: pct(h * 60) }}>
            {tick(h * 60)}
          </span>
        ))}
      </div>
      {/* Two lines of room, so stepping never moves what is below. */}
      <div className="col-span-3 mt-1.5 flex min-h-[48px] items-center gap-2 pl-1 pointer-fine:min-h-10">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="m-0 text-body font-medium" data-day-label>
            {at === null ? 'Step through the day to see the screen then.' : labelOf(stops[at]!)}
          </p>
          {at !== null && caption && <p className="m-0 text-caption text-muted-foreground" data-day-caption>{caption}</p>}
        </div>
        {back}
      </div>
    </div>
  );
}
