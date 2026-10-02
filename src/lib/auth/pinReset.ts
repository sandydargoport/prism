/**
 * Whether a PIN change can skip the member's current PIN.
 *
 * Changing a PIN normally needs the current one, so one parent cannot lock
 * out the other. A child or guest who forgets theirs would then need
 * `scripts/reset-pin.js` on the server, so a parent may set a new PIN for
 * them without it. Only from a signed-in session: an API token never resets
 * a PIN. A parent's own PIN, and another parent's, still need the current one.
 *
 * Shared by the PATCH route and the settings dialogs so they cannot disagree.
 */
export function parentCanResetPin(
  actor: { id: string; role: string; viaApiToken?: boolean },
  target: { id: string; role?: string },
): boolean {
  return (
    actor.role === 'parent' &&
    !actor.viaApiToken &&
    actor.id !== target.id &&
    (target.role === 'child' || target.role === 'guest')
  );
}
