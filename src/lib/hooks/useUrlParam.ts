'use client';

import { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

/**
 * One query parameter of the current URL, read without useSearchParams.
 *
 * For components that render on every page (the nav, the dashboard).
 * useSearchParams forces a page out of static rendering unless it sits in a
 * Suspense boundary, which the static pages these appear on (e.g. /help) do
 * not have, so the build fails.
 *
 * Null on the server and while hydrating (which keeps those pages statically
 * renderable), and the real value from then on, including on the first render
 * of a client-side navigation. Empty and whitespace-only values read as null.
 */
export function useUrlParam(name: string): string | null {
  // Not used for its value: subscribing to the path is what re-renders the
  // caller on navigation, and every render re-reads the URL below.
  usePathname();
  return useSyncExternalStore(subscribeHistory, () => readParam(name), () => null);
}

/** Back and forward change the URL without a render of our own. */
function subscribeHistory(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

function readParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name)?.trim() || null;
  } catch {
    return null;
  }
}
