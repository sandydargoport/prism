/**
 * Which Prism capabilities a pasted Google refresh token unlocks.
 *
 * LAN-only installs cannot use the browser OAuth redirect at all: Google
 * refuses a private address as a redirect URI, so every `/api/auth/google-*`
 * flow is unreachable for them. 1.17.0 worked around that for Calendar with a
 * pasted refresh token from the OAuth Playground. Tasks and Gmail were left
 * behind, which is what #310 reports.
 *
 * A token carries exactly the scopes granted when it was authorised, and
 * refreshing never widens them. So rather than one endpoint per capability, we
 * read back what Google says the token covers and enable each capability it
 * actually has. Someone who wants Calendar and Tasks but would rather not hand
 * Prism their Gmail simply does not tick that scope, and nothing else changes.
 *
 * Scope URLs are NOT written here. They come from googleScopes.ts, so the
 * lines the setup screen tells a user to paste and the check that reads the
 * resulting token cannot disagree — see the note there.
 */
import { GOOGLE_SCOPE } from '@/lib/integrations/googleScopes';

/** Matches a scope URL as a whole entry, not as a prefix of a longer one. */
const has = (scope: string) => (granted: string) =>
  granted.split(/\s+/).includes(scope);

export type GoogleCapability = 'calendar' | 'calendarReadonly' | 'tasks' | 'gmail';

interface CapabilitySpec {
  /** Does the granted scope string cover this capability? */
  matches: (scope: string) => boolean;
  /** Shown in the Playground instructions and in the result summary. */
  label: string;
  /** What to tick in the OAuth Playground to grant it. */
  playgroundApi: string;
  /**
   * The exact lines a manual/Playground user pastes to get this capability.
   * The setup screen renders these rather than repeating the URLs, and a test
   * feeds them back through `matches`, so advertised-but-rejected cannot ship.
   */
  playgroundScopes: string[];
}

export const GOOGLE_CAPABILITIES: Record<GoogleCapability, CapabilitySpec> = {
  calendar: {
    // Full two-way sync. Setup lists calendars via users/me/calendarList, which
    // needs calendar.readonly or the broad calendar scope; creating events needs
    // calendar.events or broad. So neither narrow scope alone delivers two-way
    // sync, and the browser flow accordingly grants both.
    matches: (s) =>
      has(GOOGLE_SCOPE.calendarBroad)(s) ||
      (has(GOOGLE_SCOPE.calendarEvents)(s) && has(GOOGLE_SCOPE.calendarReadonly)(s)),
    label: 'Calendar',
    playgroundApi: 'Google Calendar API v3',
    playgroundScopes: [GOOGLE_SCOPE.calendarEvents, GOOGLE_SCOPE.calendarReadonly],
  },
  calendarReadonly: {
    // calendar.readonly on its own can list and read calendars but cannot write
    // events. That is a legitimate thing to want — the same shape as an iCal
    // subscription — so it connects rather than being rejected. It is reported
    // as read-only, because a calendar that silently refuses new events is the
    // failure mode this whole area keeps producing.
    matches: (s) =>
      !has(GOOGLE_SCOPE.calendarBroad)(s) &&
      !has(GOOGLE_SCOPE.calendarEvents)(s) &&
      has(GOOGLE_SCOPE.calendarReadonly)(s),
    label: 'Calendar (read-only)',
    playgroundApi: 'Google Calendar API v3',
    playgroundScopes: [GOOGLE_SCOPE.calendarReadonly],
  },
  tasks: {
    matches: has(GOOGLE_SCOPE.tasks),
    label: 'Tasks',
    playgroundApi: 'Tasks API v1',
    playgroundScopes: [GOOGLE_SCOPE.tasks],
  },
  gmail: {
    // Bus tracking parses transport emails; readonly is enough to do that.
    matches: (s) => has(GOOGLE_SCOPE.gmailModify)(s) || has(GOOGLE_SCOPE.gmailReadonly)(s),
    label: 'Gmail (bus tracking)',
    playgroundApi: 'Gmail API v1',
    playgroundScopes: [GOOGLE_SCOPE.gmailModify],
  },
};

/** Capabilities the granted scope string actually covers. */
export function detectCapabilities(scope: string | undefined): GoogleCapability[] {
  const s = scope ?? '';
  return (Object.keys(GOOGLE_CAPABILITIES) as GoogleCapability[]).filter((c) =>
    GOOGLE_CAPABILITIES[c].matches(s),
  );
}

/** Human-readable list for a result message, e.g. "Calendar and Tasks". */
export function describeCapabilities(caps: GoogleCapability[]): string {
  const names = caps.map((c) => GOOGLE_CAPABILITIES[c].label);
  if (names.length === 0) return 'nothing';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
