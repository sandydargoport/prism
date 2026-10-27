'use client';

import { useEffect } from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';

/**
 * Tells the server a named screen is on, for "online 2 min ago" in
 * Settings > Displays (#690). Only a browser carrying the readable marker the
 * server sets when a screen is named sends anything, so phones and unnamed
 * browsers make no requests at all.
 *
 * Keeps beating while the screensaver is up: an idle wall screen is still on.
 * Every 60 s (150 s in performance mode), inside the 5 minute online window.
 */
const BEAT_MS = 60 * 1000;

function isNamed(): boolean {
  return document.cookie.split('; ').includes('prism_display_named=1');
}

function beat(): void {
  if (!isNamed()) return;
  fetch('/api/displays/heartbeat', { method: 'POST' }).catch(() => {
    // Offline for a moment; the next beat will do.
  });
}

export function DisplayHeartbeat() {
  useEffect(beat, []);
  useVisibilityPolling(beat, BEAT_MS, { pollWhileIdle: true });
  return null;
}
