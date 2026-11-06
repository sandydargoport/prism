/**
 * Fetch and parse an iCal feed (#809). The fetch goes through safeFetch, so
 * every redirect hop is re-checked and each host's resolved addresses must be
 * public; node-ical's own fromURL followed redirects unchecked.
 */
import { async as icalAsync, type CalendarResponse } from 'node-ical';
import { safeFetch } from '@/lib/utils/safeFetch';

export async function fetchIcal(url: string): Promise<CalendarResponse> {
  const res = await safeFetch(url, { headers: { Accept: 'text/calendar, text/plain, */*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return icalAsync.parseICS(await res.text());
}
