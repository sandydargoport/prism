'use client';

import { useUrlParam } from './useUrlParam';
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
 * So this reads the URL directly instead (see useUrlParam). Only Settings ever
 * carries the token; every other page takes its slug from the path.
 */
export function useReturnSlug(): string | null {
  return useUrlParam(RETURN_PARAM);
}
