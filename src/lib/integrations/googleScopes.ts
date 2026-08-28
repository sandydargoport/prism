/**
 * Every Google OAuth scope Prism asks for, written down exactly once.
 *
 * Prism requests scopes from four places that must agree: the browser sign-in
 * flows for Calendar and Tasks, the Gmail flow behind bus tracking, the
 * instructions telling a manual/Playground user which lines to paste, and the
 * validator that reads back what a pasted token actually carries.
 *
 * They used to hold their own copies of the URLs. In #312 the validator was
 * changed on its own, and nothing noticed that the instructions still told
 * users to paste something it would now reject — the drift is invisible until
 * a user hits it, because no single file is wrong on its own.
 *
 * So the literals live here and nowhere else. `scopeGuard.test.ts` fails the
 * build if a `googleapis.com/auth/…` string reappears in another file, and
 * `googleManualScopes.test.ts` round-trips each advertised scope set through
 * the validator, so instructions that would be rejected cannot ship.
 */

export const GOOGLE_SCOPE = {
  /** Read calendars and events. Required to list calendars at all. */
  calendarReadonly: 'https://www.googleapis.com/auth/calendar.readonly',
  /** Create and edit events. Cannot list calendars on its own. */
  calendarEvents: 'https://www.googleapis.com/auth/calendar.events',
  /** Full calendar access. Playground users often pick this single line. */
  calendarBroad: 'https://www.googleapis.com/auth/calendar',
  tasks: 'https://www.googleapis.com/auth/tasks',
  /**
   * Read mail, and change labels. Bus tracking clears UNREAD on the transport
   * emails it consumes, so read-only is not enough for the default behaviour.
   */
  gmailModify: 'https://www.googleapis.com/auth/gmail.modify',
  /** Strict subset of gmailModify: reading works, clearing UNREAD does not. */
  gmailReadonly: 'https://www.googleapis.com/auth/gmail.readonly',
  /**
   * Identify which account authorized, for the "Connected as <email>" label.
   * Browser flows only — a Playground token usually lacks these, and the
   * connection falls back to the primary calendar id.
   */
  openid: 'openid',
  email: 'email',
} as const;

/** Space-separated scope string for the Calendar browser sign-in. */
export const CALENDAR_BROWSER_SCOPES = [
  GOOGLE_SCOPE.calendarReadonly,
  GOOGLE_SCOPE.calendarEvents,
  GOOGLE_SCOPE.openid,
  GOOGLE_SCOPE.email,
].join(' ');

/** Space-separated scope string for the Google Tasks browser sign-in. */
export const TASKS_BROWSER_SCOPES = [
  GOOGLE_SCOPE.tasks,
  GOOGLE_SCOPE.openid,
  GOOGLE_SCOPE.email,
].join(' ');

/**
 * Space-separated scope string for the Gmail (bus tracking) flow.
 *
 * `modify` alone, not `modify` + `readonly`. Requesting both was redundant —
 * readonly is a strict subset — and it made the browser flow ask for something
 * the paste-a-token instructions never mentioned, which is the drift this
 * module exists to remove.
 */
export const GMAIL_BROWSER_SCOPES = GOOGLE_SCOPE.gmailModify;
