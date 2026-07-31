/**
 * Detects the classic user mistake of pasting the Google Calendar *web app*
 * link (the address-bar URL, or the "cid=" link from Google's share dialog)
 * where an iCal subscription feed URL is expected.
 *
 * The web link returns an HTML page, not an iCal feed, so a naive fetch
 * "succeeds" (200 OK) but yields zero events — a silent failure that's
 * confusing to diagnose. We can't derive the real feed URL from the web
 * link (it embeds a secret token only Google knows), so callers should
 * reject it with guidance rather than store it.
 */
export function isGoogleCalendarWebLink(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.hostname !== 'calendar.google.com') return false;

  const looksLikeFeed = parsed.pathname.includes('/ical/') || parsed.pathname.endsWith('.ics');
  if (looksLikeFeed) return false;

  return parsed.searchParams.has('cid') || parsed.pathname.includes('/calendar/u/');
}

export const GOOGLE_WEB_LINK_ERROR =
  'That\'s a Google Calendar web link, not a subscription feed. In Google Calendar, go to ' +
  'Settings → your calendar → "Integrate calendar", then copy the "Secret address in iCal ' +
  'format" (it ends in .ics).';
