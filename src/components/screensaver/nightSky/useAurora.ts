'use client';

import { useFetch } from '@/lib/hooks/useFetch';
import { auroraNotice, type AuroraResponse } from '@/lib/integrations/aurora';

/** NOAA renews the forecast every few minutes; the server keeps it for 30. */
const EVERY = 30 * 60_000;

/**
 * The aurora line for the night sky, or null. Asks only while `dark`, so a sky
 * that is up by day fetches nothing, and keeps asking while the screensaver is
 * up, which is the only time the sky is. A failed ask leaves the line off
 * rather than showing an old forecast.
 */
export function useAurora(dark: boolean, lat: number): string | null {
  const { data, error } = useFetch<AuroraResponse | null>({
    url: '/api/aurora',
    initialData: null,
    refreshInterval: EVERY,
    label: 'aurora',
    enabled: dark,
    pollWhileIdle: true,
  });
  if (!dark || error || !data?.enabled) return null;
  return auroraNotice(data.chance, lat);
}
