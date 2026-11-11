/**
 * How long the house goes untouched before Away turns itself on (#1159).
 *
 * One value for the household, kept on the server and read by every screen.
 * It used to be kept per browser, so only the screen it was set on ever
 * turned Away on, while Away itself is one switch for the whole house.
 */

/** The settings row holding the hours. Absent means nobody has chosen yet. */
export const AWAY_AUTO_AFTER_KEY = 'awayModeAutoAfterHours';

/** Where each browser kept it before. Carried over once, then removed. */
export const LEGACY_AWAY_TIMEOUT_KEY = 'prism-away-mode-timeout';

export const AWAY_AUTO_OPTIONS = [
  { value: 0, label: 'Never (only by hand)' },
  { value: 4, label: '4 hours' },
  { value: 8, label: '8 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '1 day' },
  { value: 48, label: '2 days' },
  { value: 72, label: '3 days' },
  { value: 168, label: '1 week' },
] as const;

const HOURS = new Set<number>(AWAY_AUTO_OPTIONS.map((o) => o.value));

export function isAwayAutoHours(v: unknown): v is number {
  return typeof v === 'number' && HOURS.has(v);
}

/**
 * The hours a browser kept before, if it is worth carrying over: one of the
 * choices and not "Never", since a browser that never chose also reads 0.
 */
export function legacyAwayHours(stored: string | null): number | null {
  if (stored === null) return null;
  const n = Number(stored);
  return isAwayAutoHours(n) && n > 0 ? n : null;
}

/**
 * The household's hours, from the answer of GET /api/away-mode. When the
 * household has none yet and this browser kept a value, that value is offered
 * to the server, which keeps it only if still nobody has chosen. The browser's
 * copy is removed once the household has a value, so it is offered once.
 */
export async function resolveAwayAutoAfter(
  state: { autoAfterHours?: unknown },
  fetchFn: typeof fetch = fetch,
): Promise<number> {
  if (typeof window === 'undefined') return isAwayAutoHours(state.autoAfterHours) ? state.autoAfterHours : 0;
  const forget = () => { try { window.localStorage.removeItem(LEGACY_AWAY_TIMEOUT_KEY); } catch { /* storage refused */ } };
  if (isAwayAutoHours(state.autoAfterHours)) {
    forget();
    return state.autoAfterHours;
  }
  let stored: string | null = null;
  try { stored = window.localStorage.getItem(LEGACY_AWAY_TIMEOUT_KEY); } catch { /* storage refused */ }
  const legacy = legacyAwayHours(stored);
  if (legacy === null) return 0;
  try {
    const res = await fetchFn('/api/away-mode', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoAfterHours: legacy, carryOver: true }),
    });
    if (!res.ok) return legacy;
    const body = (await res.json()) as { autoAfterHours?: unknown };
    forget();
    return isAwayAutoHours(body.autoAfterHours) ? body.autoAfterHours : legacy;
  } catch {
    return legacy;
  }
}
