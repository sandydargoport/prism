'use client';

import { useEffect, useState } from 'react';

export type OAuthConfigStatus = {
  google: boolean;
  microsoft: boolean;
};

/**
 * Whether the Google/Microsoft OAuth *app* is configured on this instance
 * (client id/secret present — DB or env), not whether a user has connected
 * an account. Backs keyless-first gating: on a fresh instance with no OAuth
 * app registered, "Connect" buttons are replaced with a setup note instead
 * of dead-ending (#178). `null` while loading — treat as "unknown", not
 * "unconfigured", to avoid a flash of the gated state for the common
 * already-configured case.
 */
export function useOAuthConfigStatus(): OAuthConfigStatus | null {
  const [status, setStatus] = useState<OAuthConfigStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/integrations/oauth-status');
        if (res.ok && !cancelled) {
          setStatus((await res.json()) as OAuthConfigStatus);
        }
      } catch (error) {
        console.error('Failed to fetch OAuth config status:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
