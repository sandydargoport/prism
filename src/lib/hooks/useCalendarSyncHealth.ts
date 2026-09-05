'use client';

import { useState, useEffect } from 'react';

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  caldav: 'CalDAV',
  ics: 'Subscribed',
};

interface Options {
  /** Set false where the answer can't be shown anyway, so nothing is fetched. */
  enabled?: boolean;
  pollMs?: number;
}

/**
 * Whether any calendar has stopped syncing and needs reconnecting.
 *
 * Polled rather than pushed, and slowly: a revoked grant is a state that lasts
 * days, so every few minutes is ample and a wall display should not be asking
 * more often than that.
 */
export function useCalendarSyncHealth({ enabled = true, pollMs = 5 * 60 * 1000 }: Options = {}) {
  const [needsReauth, setNeedsReauth] = useState(0);
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let alive = true;
    const check = async () => {
      try {
        const res = await fetch('/api/calendars/sync-health');
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setNeedsReauth(data.needsReauth ?? 0);
        setProviders(data.providers ?? []);
      } catch {
        // Offline or mid-restart. Leave the last known state alone rather than
        // flashing the warning off and back on.
      }
    };
    check();
    const id = window.setInterval(check, pollMs);
    return () => { alive = false; window.clearInterval(id); };
  }, [enabled, pollMs]);

  // "Google sync has stopped" tells you which account to go fix; a bare "sync
  // has stopped" makes you check all of them. Only name a provider when that
  // is genuinely all there is.
  const provider = providers.length === 1 && providers[0] ? PROVIDER_LABELS[providers[0]] ?? null : null;

  return { needsReauth: enabled ? needsReauth : 0, providers, provider, stalled: enabled && needsReauth > 0 };
}
