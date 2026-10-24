'use client';

import { useState, useCallback } from 'react';
import { usePersistedState, isStringArray } from '@/lib/hooks/usePersistedState';

const STORAGE_KEY = 'prism-mobile-card-order';
const DEFAULT_ORDER = [
  'weather',
  'calendar',
  'busTracking',
  'chores',
  'tasks',
  'shopping',
  'meals',
  'recipes',
  'messages',
  'birthdays',
  'points',
  'wishes',
  'photos',
  'clock',
];

const HIDDEN_CARDS_KEY = 'prism-mobile-hidden-cards';
const DEFAULT_HIDDEN = ['clock', 'photos']; // Hidden by default

/**
 * Which cards the mobile dashboard hides. Shared through the stored-value
 * store, so a card toggled in the FAB menu leaves (or joins) the dashboard
 * straight away rather than on the next reload.
 */
export function useHiddenCards() {
  return usePersistedState(HIDDEN_CARDS_KEY, DEFAULT_HIDDEN, isStringArray);
}

function loadOrder(): string[] {
  if (typeof window === 'undefined') return DEFAULT_ORDER;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_ORDER;
    const parsed = JSON.parse(stored) as string[];
    // Merge: keep stored order but ensure all default cards are present
    const merged = parsed.filter((id) => DEFAULT_ORDER.includes(id));
    for (const id of DEFAULT_ORDER) {
      if (!merged.includes(id)) merged.push(id);
    }
    return merged;
  } catch {
    return DEFAULT_ORDER;
  }
}

export function useMobileCardOrder() {
  const [order, setOrderState] = useState(loadOrder);

  const setOrder = useCallback((newOrder: string[]) => {
    setOrderState(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
  }, []);

  return { order, setOrder };
}
