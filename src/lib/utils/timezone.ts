/**
 * Timezone helpers usable on both the server and client (no DOM / no DB deps).
 *
 * Prism historically rendered all times in the browser's local zone. Server-side
 * code (sync, crons) has no browser, so it anchors to the household `timezone`
 * setting via these helpers.
 */

/**
 * Convert an absolute instant (ISO string or Date) into the wall-clock date +
 * time in a given IANA timezone, using the built-in Intl database (no libs).
 * Returns a date-only Date (local midnight, for day/week bucketing) and an
 * "HH:mm" string. Falls back to a naive parse if the zone is invalid.
 */
export function zonedParts(input: string | Date, timeZone: string): { date: Date; time: string } {
  const d = input instanceof Date ? input : new Date(input);
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts: Record<string, string> = {};
    for (const p of fmt.formatToParts(d)) parts[p.type] = p.value;
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    const hour = parts.hour === '24' ? '00' : parts.hour;
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return { date: new Date(year, month - 1, day), time: `${hour}:${parts.minute}` };
    }
  } catch {
    /* invalid timeZone → fall through */
  }
  // Fallback: pull the authored wall-clock straight from an ISO string.
  const s = typeof input === 'string' ? input : d.toISOString();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) {
    const [, y, mo, da, hh, mm] = m;
    return { date: new Date(Number(y), Number(mo) - 1, Number(da)), time: `${hh}:${mm}` };
  }
  return { date: d, time: '00:00' };
}

/** Whether a string is a valid IANA timezone the runtime understands. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The full IANA zone list when the runtime supports it (Node 18+/modern
 * browsers), else a curated common set. Used to populate the settings dropdown.
 */
export function listTimezones(): string[] {
  const sof = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  if (typeof sof === 'function') {
    try {
      return sof('timeZone');
    } catch {
      /* fall through */
    }
  }
  return COMMON_TIMEZONES;
}

export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];
