/**
 * A pasted Google token unlocks exactly the capabilities its scopes cover.
 *
 * This is a user-facing choice, not an implementation detail: someone happy to
 * give Prism their calendar and tasks but not their Gmail simply does not tick
 * that scope in the OAuth Playground. Getting this wrong either silently drops
 * a capability they asked for, or wires up one they deliberately withheld.
 */

import { detectCapabilities, describeCapabilities, GOOGLE_CAPABILITIES } from '../googleManualScopes';

const CAL_PAIR = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
const CAL_BROAD = 'https://www.googleapis.com/auth/calendar';
const TASKS = 'https://www.googleapis.com/auth/tasks';
const GMAIL_RO = 'https://www.googleapis.com/auth/gmail.readonly';

describe('detectCapabilities', () => {
  it('detects calendar from the pair the browser flow requests', () => {
    expect(detectCapabilities(CAL_PAIR)).toEqual(['calendar']);
  });

  it('detects calendar from the single broad scope a Playground user may pick', () => {
    expect(detectCapabilities(CAL_BROAD)).toEqual(['calendar']);
  });

  it('detects tasks on its own', () => {
    expect(detectCapabilities(TASKS)).toEqual(['tasks']);
  });

  it('detects gmail on its own', () => {
    expect(detectCapabilities(GMAIL_RO)).toEqual(['gmail']);
  });

  it('detects all three together', () => {
    expect(detectCapabilities(`${CAL_PAIR} ${TASKS} ${GMAIL_RO}`).sort())
      .toEqual(['calendar', 'gmail', 'tasks']);
  });

  it('honours a deliberate subset — calendar and tasks without gmail', () => {
    const caps = detectCapabilities(`${CAL_PAIR} ${TASKS}`);
    expect(caps).toContain('calendar');
    expect(caps).toContain('tasks');
    expect(caps).not.toContain('gmail');
  });

  it('returns nothing for unrelated scopes', () => {
    expect(detectCapabilities('openid email profile')).toEqual([]);
  });

  it('returns nothing for an absent scope string', () => {
    expect(detectCapabilities(undefined)).toEqual([]);
  });

  it('treats calendar.readonly alone as read-only, not full calendar access', () => {
    // Readonly can list and read calendars but cannot write events. Calling it
    // full access would fail later on the first write, which is the silent
    // failure this area keeps producing; rejecting it outright would drop a
    // legitimate use, the same shape as an iCal subscription. So it connects,
    // and is reported as read-only.
    const caps = detectCapabilities('https://www.googleapis.com/auth/calendar.readonly');
    expect(caps).toEqual(['calendarReadonly']);
    expect(caps).not.toContain('calendar');
  });

  it('does not also report read-only when the full pair is granted', () => {
    expect(detectCapabilities(CAL_PAIR)).toEqual(['calendar']);
  });

  it('does not report read-only for the broad calendar scope', () => {
    expect(detectCapabilities(CAL_BROAD)).toEqual(['calendar']);
  });

  it('ignores calendar.events on its own, which cannot list calendars', () => {
    // users/me/calendarList needs readonly or broad, so setup would fail.
    expect(detectCapabilities('https://www.googleapis.com/auth/calendar.events')).toEqual([]);
  });
});

describe('describeCapabilities', () => {
  it('reads naturally for one, two and three', () => {
    expect(describeCapabilities(['calendar'])).toBe('Calendar');
    expect(describeCapabilities(['calendar', 'tasks'])).toBe('Calendar and Tasks');
    expect(describeCapabilities(['calendar', 'tasks', 'gmail']))
      .toBe('Calendar, Tasks and Gmail (bus tracking)');
  });

  it('says nothing rather than producing an empty string', () => {
    expect(describeCapabilities([])).toBe('nothing');
  });
});

describe('advertised scopes round-trip through the validator', () => {
  // The setup screen renders playgroundScopes verbatim. If a scope set the UI
  // tells a user to paste no longer satisfies matches(), that user follows the
  // instructions and gets rejected — the #312 failure, in the other direction.
  const CAPS = Object.keys(GOOGLE_CAPABILITIES) as Array<keyof typeof GOOGLE_CAPABILITIES>;

  it.each(CAPS)('pasting exactly what %s advertises enables it', (cap) => {
    const pasted = GOOGLE_CAPABILITIES[cap].playgroundScopes.join(' ');
    expect(detectCapabilities(pasted)).toContain(cap);
  });

  it('every capability advertises at least one scope', () => {
    for (const cap of CAPS) {
      expect(GOOGLE_CAPABILITIES[cap].playgroundScopes.length).toBeGreaterThan(0);
    }
  });

  it('matches whole scope entries, not prefixes of longer ones', () => {
    // 'auth/tasks' must not be found inside a hypothetical 'auth/tasks.extra',
    // which is a different, narrower grant.
    expect(detectCapabilities('https://www.googleapis.com/auth/tasks.readonly')).toEqual([]);
  });
});
