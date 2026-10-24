'use client';

import { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { RETURN_PARAM } from '@/lib/utils/dashboardScope';

/**
 * The `?from=` return token, read on the client.
 *
 * The navigation needs this to keep its tabs scoped to a display while you are
 * on the global Settings page (#660). Reading it with `useSearchParams` is not
 * an option here: the nav renders on every page, and useSearchParams forces a
 * page out of static rendering unless it sits in a Suspense boundary, which the
 * static pages the nav appears on (e.g. /help) do not have, so the build fails.
 *
 * So this reads the URL directly instead: null on the server and while
 * hydrating (which keeps the nav statically renderable), and the real token
 * from then on, including on the first render of a client-side navigation.
 * Only Settings ever carries the token; every other page takes its slug from
 * the path.
 */
export function useReturnSlug(): string | null {
  // Not used for its value: subscribing to the path is what re-renders the nav
  // on navigation, and every render re-reads the URL below.
  usePathname();
  return useSyncExternalStore(subscribeHistory, readReturnSlug, () => null);
}

/** Back and forward change the URL without a render of our own. */
function subscribeHistory(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

function readReturnSlug(): string | null {
  try {
    return new URLSearchParams(window.location.search).get(RETURN_PARAM)?.trim() || null;
  } catch {
    return null;
  }
}
