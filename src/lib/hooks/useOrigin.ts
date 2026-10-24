'use client';

import { useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

/**
 * This page's origin (`https://host:port`), or null on the server and while
 * hydrating. The origin cannot change without a page load, so there is
 * nothing to subscribe to.
 */
export function useOrigin(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => null,
  );
}
