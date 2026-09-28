'use client';

import { useCallback, useState } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

/**
 * The current time, refreshed every `intervalMs` while something is showing.
 *
 * For relative labels ("5 minutes ago") inside a memoized widget: the widget
 * only re-renders when its data changes, so without a tick the label written
 * at the last fetch stays on a wall display for hours.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  const tick = useCallback(() => setNow(new Date()), []);
  useVisibilityPolling(tick, intervalMs);
  return now;
}
