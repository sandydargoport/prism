'use client';

import { useState, useEffect } from 'react';
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
 * So this reads the URL directly instead: null on the server and first paint
 * (which keeps the nav statically renderable), resolved on mount, and re-read
 * on navigation. Only Settings ever carries the token; there the tabs scope a
 * tick after mount, and every other page takes its slug from the path.
 */
export function useReturnSlug(): string | null {
  const pathname = usePathname();
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    try {
      const value = new URLSearchParams(window.location.search).get(RETURN_PARAM)?.trim();
      setSlug(value || null);
    } catch {
      setSlug(null);
    }
  }, [pathname]);

  return slug;
}
