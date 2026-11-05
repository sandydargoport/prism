/**
 * What callers who may not change settings see of a calendar (#809): the
 * flags the screens use, not the server details a parent configured.
 */

/** Sync status without the raw error text, which can carry server details. */
export function withoutErrorText(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null;
  const { lastError: _lastError, previousError: _previousError, ...flags } = v as Record<string, unknown>;
  return flags;
}

/** Of a calendar's provider config, only the flag the screens read. */
export function lifeEventsOnly(v: unknown): Record<string, unknown> | null {
  const cfg = v as { lifeEventsCalendar?: unknown } | null;
  return cfg && typeof cfg === 'object' && 'lifeEventsCalendar' in cfg ? { lifeEventsCalendar: cfg.lifeEventsCalendar } : null;
}
