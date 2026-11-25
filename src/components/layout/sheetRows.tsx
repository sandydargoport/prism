'use client';

/**
 * The controls the editor's Screen tab is made of (#1281, #1326, #1349): its
 * chips and fields, each switch's colour, and the bus routes.
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { busWindowOf, daysShort, type BusWindow } from '@/lib/screenSwitches';
import { cn } from '@/lib/utils';

const DAY_MINUTES = 24 * 60;

// Each control is a 44px target for a finger on the wall, and 32px with a
// mouse, where editing is done (the laptop), so the panel stays light beside
// the canvas. With a mouse every control's words are one size, 12px, and
// sentences and fields 14px.
export const chip = (on: boolean) => cn(
  'flex min-h-[48px] items-center rounded-full border-[1.5px] px-4 text-body transition-colors pointer-fine:min-h-8 pointer-fine:border pointer-fine:px-2.5 pointer-fine:text-caption pointer-fine:font-medium',
  on ? 'border-foreground bg-foreground text-background' : 'border-foreground/30 hover:bg-muted',
);
/** A day: a 44px circle by touch; with a mouse the seven share their row in equal widths, so Mon and Wed fit like the rest. */
export const dayChip = (on: boolean) => cn(
  'flex h-[44px] w-[44px] items-center justify-center rounded-full text-caption font-medium disabled:opacity-100 pointer-fine:h-8 pointer-fine:w-auto pointer-fine:min-w-0 pointer-fine:flex-1',
  // Both with a border, so on and off share a row in equal widths.
  on ? 'border border-foreground bg-foreground text-background' : 'border border-foreground/30 text-muted-foreground',
);
export const field = 'min-h-[44px] rounded-lg border border-border bg-background px-2 text-body pointer-fine:min-h-9';
/** A small round button beside a row (move up, remove). */
export const iconButton = 'flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 pointer-fine:h-8 pointer-fine:w-8';
export const note = 'm-0 text-caption text-muted-foreground';

/** "HH:MM" for a minute of the day, wrapping past midnight. */
export const hhmm = (minute: number) => {
  const m = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * Each switch's colour, by its place in the list, so its band on the strip
 * matches the swatch on its row. They follow the theme: the first is the
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

/** A switch's colour as a background, with its fallback underneath. */
export function paint(index: number): { className: string; style: React.CSSProperties; color: string } {
  const color = switchColor(index);
  // Inline beats the class, unless the browser drops it as a colour it cannot read.
  return { className: 'bg-[var(--fallback)]', style: { ['--fallback' as string]: FALLBACK[index % FALLBACK.length]!, backgroundColor: color }, color };
}

/**
 * A row's swatch: a switch's colour, as its band on the strip is, or for
 * Normally (-1) the strip's own ground, which is what shows outside every band.
 */
export function Swatch({ index, className, ...rest }: { index: number } & React.HTMLAttributes<HTMLSpanElement>) {
  if (index < 0) {
    return <span aria-hidden className={cn('inline-block h-3 w-3 shrink-0 rounded-[3px] border border-border bg-muted', className)} data-swatch="normally" {...rest} />;
  }
  const p = paint(index);
  return <span aria-hidden className={cn('inline-block h-3 w-3 shrink-0 rounded-[3px]', p.className, className)} style={p.style} data-swatch={p.color} {...rest} />;
}

/** A bus route as a bus switch's row shows it. */
export type BusRoute = { id: string; label: string; scheduledTime: string; activeDays: number[] };

/** The bus routes, once read, for a screen with a bus switch; null before. */
export function useBusRoutes(wanted: boolean): BusRoute[] | null {
  const [routes, setRoutes] = useState<BusRoute[] | null>(null);
  useEffect(() => {
    if (!wanted || routes) return;
    let live = true;
    void (async () => {
      let data: { routes?: unknown } | null = null;
      try {
        const res = await fetch('/api/bus-tracking/status');
        data = res.ok ? await res.json() : null;
      } catch { /* no answer: no routes */ }
      if (!live) return;
      setRoutes(((data?.routes ?? []) as Array<Partial<BusRoute>>)
        .flatMap((r) => (typeof r.id === 'string' && typeof r.scheduledTime === 'string' && Array.isArray(r.activeDays)
          ? [{ id: r.id, label: r.label || 'Bus', scheduledTime: r.scheduledTime, activeDays: r.activeDays }] : [])));
    })();
    return () => { live = false; };
  }, [wanted, routes]);
  return routes;
}

/**
 * The windows bus routes switch a screen for, grouped by their days and in
 * time order: "Mon–Fri 7:15 am to 8:00 am, 3:00 pm to 3:45 pm". From 30
 * minutes before each route's time to 15 after, unless `window` says otherwise.
 */
export function busWindowsInWords(
  routes: Array<{ scheduledTime: string; activeDays: number[] }>,
  clock: (hhmm: string) => string,
  window: BusWindow = busWindowOf({}),
): string {
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
      .map((due) => `${clock(hhmm(due - window.before))} to ${clock(hhmm(due + window.after))}`).join(', ')}`)
    .join('; ');
}
