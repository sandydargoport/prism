'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';

/** How long each page of a busy day stays up (#801). */
export const DAY_PAGE_MS = 8000;

/**
 * Whether day cells page through a busy day instead of folding it into
 * "+N more". The dashboard calendar widget turns it on for wall and tablet
 * screens, where nobody taps, so "+N more" would hide those events for good.
 * The Calendar page and phones leave it off: tapping is quicker there.
 */
export const DayPagingContext = createContext(false);

export function useDayPagingEnabled(): boolean {
  return useContext(DayPagingContext);
}

// One clock for every cell, so all busy days turn their page at the same
// moment instead of each on its own timer.
let tick = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!timer) {
    timer = setInterval(() => {
      tick += 1;
      listeners.forEach((l) => l());
    }, DAY_PAGE_MS);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const noopSubscribe = () => () => {};

/** The shared page counter: goes up by one every {@link DAY_PAGE_MS}; 0 when off. */
export function useDayPageTick(enabled: boolean): number {
  return useSyncExternalStore(enabled ? subscribe : noopSubscribe, () => (enabled ? tick : 0), () => 0);
}

export interface DayPage<T> {
  /** Events drawn in the cell. */
  shown: T[];
  /** Events not drawn, listed by the label's popover. */
  rest: T[];
  /** Zero-based page shown, and how many pages; null when the day is not paged. */
  page: { index: number; count: number } | null;
}

/**
 * Split a day's events for its cell.
 *
 * `fitAll` is how many fit with no label, `fitWithLabel` how many fit beside
 * the label. Everything fits: all shown. Otherwise, paging on and room for at
 * least one event: pages of `fitWithLabel`, the page picked by `tick`.
 * Otherwise the "+N more" fold: the first `fitWithLabel`, the rest folded.
 */
export function splitDay<T>(events: T[], fitAll: number, fitWithLabel: number, paging: boolean, tick: number): DayPage<T> {
  if (events.length <= fitAll) return { shown: events, rest: [], page: null };
  const per = Math.max(0, fitWithLabel);
  if (!paging || per < 1) {
    return { shown: events.slice(0, per), rest: events.slice(per), page: null };
  }
  const count = Math.ceil(events.length / per);
  const index = ((tick % count) + count) % count;
  const start = index * per;
  const shown = events.slice(start, start + per);
  return {
    shown,
    rest: [...events.slice(0, start), ...events.slice(start + per)],
    page: { index, count },
  };
}
