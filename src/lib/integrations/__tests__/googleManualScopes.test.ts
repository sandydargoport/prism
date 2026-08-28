/**
 * A pasted Google token unlocks exactly the capabilities its scopes cover.
 *
 * This is a user-facing choice, not an implementation detail: someone happy to
 * give Prism their calendar and tasks but not their Gmail simply does not tick
 * that scope in the OAuth Playground. Getting this wrong either silently drops
 * a capability they asked for, or wires up one they deliberately withheld.
 */

import { detectCapabilities, describeCapabilities } from '../googleManualScopes';

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

  it('does not mistake calendar.readonly alone for calendar access', () => {
    // The browser flow always grants the pair; readonly alone cannot write, so
    // treating it as full calendar access would fail later on the first write.
    expect(detectCapabilities('https://www.googleapis.com/auth/calendar.readonly')).toEqual([]);
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
