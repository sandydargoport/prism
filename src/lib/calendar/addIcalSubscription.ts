/**
 * Subscribe to a calendar by its link (iCal, webcal or a published .ics). The
 * keyless way in: no account, no OAuth app, read-only. Used by Settings and by
 * the setup wizard, where it works before anyone has signed in.
 *
 * Resolves with the error to show, or null when the calendar was added.
 */
export async function addIcalSubscription(url: string, name: string): Promise<string | null> {
  const body: Record<string, string> = { url: url.trim(), type: 'ical' };
  if (name.trim()) body.name = name.trim();
  try {
    const res = await fetch('/api/calendar-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return (data as { error?: string }).error || 'Failed to add calendar';
    }
  } catch (err) {
    return err instanceof Error ? err.message : 'Failed to add calendar';
  }
  // The server imports the feed in the background, then invalidates the
  // events cache. Nudge calendar views to refetch as it lands: one now, and a
  // couple of staggered follow-ups to cover the sub-second-to-a-few-seconds a
  // first import takes, so events appear without a page refresh.
  window.dispatchEvent(new Event('prism:calendar-synced'));
  [2500, 6000].forEach((ms) =>
    setTimeout(() => window.dispatchEvent(new Event('prism:calendar-synced')), ms),
  );
  return null;
}
