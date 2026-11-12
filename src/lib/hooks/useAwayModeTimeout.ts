'use client';

import { useState, useEffect, useCallback } from 'react';
import { resolveAwayAutoAfter } from '@/lib/awayMode/autoAfter';

/**
 * The household's hours before Away turns itself on (#1159). 0 is "only by
 * hand". Read from the server, so every screen and Settings agree; a value a
 * browser kept from before is carried over on first read.
 *
 * `ready` is false until the server has answered, so a control does not show
 * "Never" and then jump.
 */
export function useAwayModeTimeout() {
  const [timeout, setTimeoutValue] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/away-mode');
        const state = res.ok ? await res.json() : {};
        const hours = await resolveAwayAutoAfter(state);
        if (live) setTimeoutValue(hours);
      } catch {
        // Unreachable: shown as "Never" until it is.
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => { live = false; };
  }, []);

  const setTimeout = useCallback(async (hours: number) => {
    const before = timeout;
    setTimeoutValue(hours);
    setError(null);
    try {
      const res = await fetch('/api/away-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoAfterHours: hours }),
      });
      if (!res.ok) throw new Error(String(res.status));
      window.dispatchEvent(new CustomEvent('prism:away-mode-timeout-change', { detail: hours }));
    } catch (e) {
      setTimeoutValue(before);
      setError(e instanceof Error && (e.message === '401' || e.message === '403')
        ? 'Only a parent can change this.'
        : 'That did not save. Try again.');
    }
  }, [timeout]);

  return { timeout, setTimeout, ready, error };
}
