'use client';

import { useCallback, useEffect, useState } from 'react';

export interface IntegrationStatus {
  google: {
    connected: boolean;
    expired: boolean;
    calendarCount: number;
    taskSourceCount: number;
    lastSynced: string | null;
  };
  microsoft: {
    connected: boolean;
    taskSourceCount: number;
    shoppingSourceCount: number;
  };
  onedrive: {
    connected: boolean;
    sourceCount: number;
  };
  gmail: {
    connected: boolean;
  };
}

export interface UseIntegrationStatusResult {
  status: IntegrationStatus | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Lifted from ConnectedAccountsSection so multiple provider cards can read
 * the same status without each card re-firing `/api/integrations/status`.
 * CalDAV is intentionally NOT part of this — it has its own status endpoint.
 */
export function useIntegrationStatus(): UseIntegrationStatusResult {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/integrations/status');
      if (res.ok) {
        const data = (await res.json()) as IntegrationStatus;
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { status, loading, refetch };
}
