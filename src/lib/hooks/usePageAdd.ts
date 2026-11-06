'use client';

/**
 * A page's own Add, for the phone's round button (#1028). A subpage registers
 * what "add" means there (add a chore, an item, an event); on a phone the
 * round button at the bottom right shows "+" and runs it, and the page drops
 * its header "+". The dashboard registers nothing, so there the button stays
 * the dashboard's options.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';

export type PageAdd = { label: string; run: () => void };

let current: PageAdd | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const pageAddStore = {
  get: () => current,
  set: (next: PageAdd | null) => { current = next; emit(); },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

/** Register this page's Add while it is mounted. */
export function usePageAdd(label: string, run: () => void) {
  // The latest handler, without re-registering on every render.
  const ref = useLatestRef(run);
  useEffect(() => {
    const entry: PageAdd = { label, run: () => ref.current() };
    pageAddStore.set(entry);
    return () => { if (pageAddStore.get() === entry) pageAddStore.set(null); };
  }, [label, ref]);
}

/** The current page's Add, if it has one. */
export function useCurrentPageAdd(): PageAdd | null {
  return useSyncExternalStore(pageAddStore.subscribe, pageAddStore.get, () => null);
}
