'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { ALWAYS_VISIBLE_HREFS } from '@/lib/constants/navItems';
import type { NavItem } from '@/lib/constants/navItems';
import { useFetchOnMount } from './useFetchOnMount';
import { sharedGet } from '@/lib/utils/sharedGet';

const CACHE_KEY = 'prism:hidden-pages';

function readCachedHiddenPages(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch { return []; }
}

const DOCK_CACHE_KEY = 'prism-dock-pages';

function readCachedDockPages(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(DOCK_CACHE_KEY);
    const v = cached ? JSON.parse(cached) : null;
    return Array.isArray(v) ? v : null;
  } catch { return null; }
}

/**
 * Every useHiddenPages() keeps its own copy, so a change in Settings tells the
 * others (the dock on the same screen) through this event (#1172).
 */
const CHANGE_EVENT = 'prism:nav-pages-change';
type NavPagesChange = { hiddenPages?: string[]; dockPages?: string[] };

function announce(detail: NavPagesChange) {
  window.dispatchEvent(new CustomEvent<NavPagesChange>(CHANGE_EVENT, { detail }));
}

export function useHiddenPages() {
  const [hiddenPages, setHiddenPagesState] = useState<string[]>(readCachedHiddenPages);
  // The pages on the dock, in order (#925); null is the default six.
  const [dockPages, setDockPagesState] = useState<string[] | null>(readCachedDockPages);
  const [loaded, setLoaded] = useState(false);

  const fetchHiddenPages = useCallback(async () => {
    try {
      const res = await sharedGet('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const val = data.settings?.hiddenPages;
        if (Array.isArray(val)) {
          setHiddenPagesState(val);
          localStorage.setItem(CACHE_KEY, JSON.stringify(val));
        }
        const dock = data.settings?.dockPages;
        if (Array.isArray(dock)) {
          setDockPagesState(dock);
          localStorage.setItem(DOCK_CACHE_KEY, JSON.stringify(dock));
        }
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useFetchOnMount(fetchHiddenPages);

  useEffect(() => {
    const onChange = (e: Event) => {
      const { hiddenPages: hidden, dockPages: dock } = (e as CustomEvent<NavPagesChange>).detail ?? {};
      if (hidden) setHiddenPagesState(hidden);
      if (dock) setDockPagesState(dock);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const setHiddenPages = useCallback(async (pages: string[]) => {
    setHiddenPagesState(pages);
    localStorage.setItem(CACHE_KEY, JSON.stringify(pages));
    announce({ hiddenPages: pages });
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hiddenPages', value: pages }),
      });
    } catch { /* ignore */ }
  }, []);

  const setDockPages = useCallback(async (pages: string[]) => {
    setDockPagesState(pages);
    localStorage.setItem(DOCK_CACHE_KEY, JSON.stringify(pages));
    announce({ dockPages: pages });
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'dockPages', value: pages }),
      });
    } catch { /* ignore */ }
  }, []);

  const hiddenSet = useMemo(() => new Set(hiddenPages), [hiddenPages]);

  const filterNavItems = useCallback(
    (items: NavItem[]): NavItem[] =>
      items.filter(
        (item) => ALWAYS_VISIBLE_HREFS.has(item.href) || !hiddenSet.has(item.href)
      ),
    [hiddenSet]
  );

  const isPageHidden = useCallback(
    (href: string): boolean =>
      !ALWAYS_VISIBLE_HREFS.has(href) && hiddenSet.has(href),
    [hiddenSet]
  );

  return {
    hiddenPages,
    dockPages,
    setDockPages,
    loaded,
    setHiddenPages,
    filterNavItems,
    isPageHidden,
  };
}
