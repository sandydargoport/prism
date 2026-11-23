'use client';

/**
 * The rows and controls the editor's Screen and Through the day sheets share
 * (#1281, #1294, #1326): a row's name in one column and its choices in the
 * next, so every row lines up, and rows that fold to one line.
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { busWindowOf, daysShort, type BusWindow } from '@/lib/screenSwitches';
import { Swatch } from './DaySlider';
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
/** The column of row names: wide enough for a fold's arrow and "At set times" at the desk's 14px. */
const NAME_COLUMN = 'grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 text-body';
/** Every row is a box of one inset, so the names of plain rows and folds line up. */
const ROW_BOX = 'rounded-xl border px-3 pointer-fine:px-2';
/** A small round button beside a row (move up, remove). */
export const iconButton = 'flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 pointer-fine:h-8 pointer-fine:w-8';
export const note = 'm-0 text-caption text-muted-foreground';

/** "HH:MM" for a minute of the day, wrapping past midnight. */
export const hhmm = (minute: number) => {
  const m = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * A row: its name in a column of its own, so the choices of every row start at
 * one edge, and wrap within their own column, never under the name.
 */
export function Row({ name, children, className, ...rest }: { name: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(NAME_COLUMN, ROW_BOX, 'border-transparent', className)} {...rest}>
      {/* An arrow's width in front, as a fold's name has. */}
      <span className="self-start pl-5 pt-2.5 font-medium pointer-fine:pt-2" data-row-name>{name}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5" data-row-choices>{children}</div>
    </div>
  );
}

/**
 * A row that folds to one line saying what it does, and opens on a tap to
 * the choices that make it.
 */
export function Fold({ name, summary, colorIndex, open, onToggle, children, ...rest }: {
  name: string;
  summary: string;
  /** Its colour on the day's line, as a dot in front of the summary: a switch's place, or -1 for night. */
  colorIndex: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(ROW_BOX, 'border-border', open ? 'bg-muted/40' : 'bg-muted/20')} data-open={open} {...rest}>
      <button type="button" aria-expanded={open} onClick={onToggle} title={open ? undefined : summary}
        className={cn(NAME_COLUMN, 'min-h-[48px] w-full text-left pointer-fine:min-h-9')} data-fold-toggle>
        <span className="flex items-center gap-1 font-medium" data-row-name>
          <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} aria-hidden />
          {name}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Swatch index={colorIndex} />
          <span className="truncate text-muted-foreground" data-fold-summary>{summary}</span>
        </span>
      </button>
      {open && <div className="flex flex-col gap-2 pb-3 pl-5 pointer-fine:gap-1.5 pointer-fine:pb-2" data-fold-body>{children}</div>}
    </div>
  );
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
