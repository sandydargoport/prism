'use client';

import { useEffect } from 'react';

/**
 * Run an async loader on mount, and again whenever `load` changes identity
 * (a useCallback whose deps, such as a user id, changed).
 *
 * For the common shape "fetch, then set state when the response arrives".
 * The react-hooks/set-state-in-effect rule cannot see an `await`, so it reads
 * every setter in an async function called from an effect as synchronous and
 * flags it. Those setters run after the response, not during the effect, so
 * they are not the cascading render the rule exists to catch.
 *
 * Only for loaders that return a promise. Marking the request as started
 * (loading, syncing) before the first `await` is part of the request and fine.
 * What does not belong here is state worked out from props or other state:
 * that is the real case the rule catches, and it belongs in the render.
 *
 * `signal` is aborted when `load` changes or the component unmounts. A loader
 * whose inputs change quickly (a search box) checks it before setting state,
 * so a slow earlier response cannot land on top of a newer one.
 */
export function useFetchOnMount(load: (signal: AbortSignal) => Promise<unknown>): void {
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
}
