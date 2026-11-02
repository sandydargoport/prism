/**
 * Whether Prism can add events to a calendar, which decides if it is offered
 * in the event form and in Settings' "Show in Add Event" switch.
 *
 * Prism's own calendars always take events. Google and CalDAV calendars take
 * them too (an event made in Prism is created there), except the ones that
 * are subscriptions by nature, recognised by name: birthdays, holidays and
 * the like are read-only in every app that offers them. A CalDAV calendar
 * that turns out to be read-only anyway keeps the event in Prism, with a
 * warning when it is saved.
 */

const READ_ONLY_NAMES = ['birthday', 'holiday', 'contacts', 'phases of the moon', 'week numbers'];

/** True when the calendar's name marks it as a subscription nobody writes to. */
export function looksReadOnlyCalendar(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('subscribe') || READ_ONLY_NAMES.some((word) => lower.includes(word));
}

export function canAddEventsTo(calendar: { provider: string; dashboardCalendarName: string }): boolean {
  if (calendar.provider === 'local') return true;
  if (calendar.provider !== 'google' && calendar.provider !== 'caldav') return false;
  return !looksReadOnlyCalendar(calendar.dashboardCalendarName);
}
