'use client';

import { useEffect, useState } from 'react';
import { SCENERY_SETTING_KEY } from '@/lib/scenery';

let pending: Promise<boolean> | null = null;

/** One settings read per page load, however many components ask. */
function readSceneryOn(): Promise<boolean> {
  if (typeof fetch === 'undefined') return Promise.resolve(false);
  pending ??= fetch('/api/settings')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => data?.settings?.[SCENERY_SETTING_KEY] === true)
    .catch(() => false);
  return pending;
}

/** For tests: forget the cached read. */
export function resetSceneryOnCache(): void {
  pending = null;
}

/**
 * Whether this household has the new-install look (#808): bundled scenery
 * while it has no photos, and the rail and bar hidden on screens that never
 * chose otherwise. Set by setup on new installs; absent on existing ones.
 */
export function useSceneryOn(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let active = true;
    readSceneryOn().then((v) => { if (active) setOn(v); });
    return () => { active = false; };
  }, []);
  return on;
}
