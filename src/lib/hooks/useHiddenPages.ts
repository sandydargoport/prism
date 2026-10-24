'use client';

import { useState, useCallback, useMemo } from 'react';
import { ALWAYS_VISIBLE_HREFS } from '@/lib/constants/navItems';
import type { NavItem } from '@/lib/constants/navItems';
import { useFetchOnMount } from './useFetchOnMount';

const CACHE_KEY = 'prism:hidden-pages';

function readCachedHiddenPages(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch { return []; }
}

export function useHiddenPages() {
  const [hiddenPages, setHiddenPagesState] = useState<string[]>(readCachedHiddenPages);
  const [loaded, setLoaded] = useState(false);

  const fetchHiddenPages = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const val = data.settings?.hiddenPages;
        if (Array.isArray(val)) {
          setHiddenPagesState(val);
          localStorage.setItem(CACHE_KEY, JSON.stringify(val));
        }
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useFetchOnMount(fetchHiddenPages);

  const setHiddenPages = useCallback(async (pages: string[]) => {
    setHiddenPagesState(pages);
    localStorage.setItem(CACHE_KEY, JSON.stringify(pages));
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hiddenPages', value: pages }),
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
    loaded,
    setHiddenPages,
    filterNavItems,
    isPageHidden,
  };
}
