/**
 * What /api/family discloses to a caller with no session.
 *
 * A wall display sits on a home network, and this endpoint answers before
 * anyone has authenticated — the login pad needs the member list to render.
 * So whatever it returns is readable by anything on the LAN.
 *
 * Names, faces and roles are already on the screen, so listing them changes
 * nothing. `hasPin` is different: it names which members are undefended, which
 * is exactly what someone would want to know before choosing who to target,
 * and it is not visible on the display. It belongs to the authenticated
 * response only.
 */
import { PUBLIC_MEMBER_FIELDS } from '../publicShape';

describe('the unauthenticated family payload', () => {
  it('does not disclose which members have a PIN', () => {
    expect(PUBLIC_MEMBER_FIELDS).not.toContain('hasPin');
  });

  it('does not disclose real user ids', () => {
    // loginIndex is the login selector; the UUID is withheld deliberately.
    expect(PUBLIC_MEMBER_FIELDS).not.toContain('userId');
  });

  it('still carries what the login pad needs to render', () => {
    // Removing any of these breaks sign-in on a display that has never
    // authenticated, which is worse than the disclosure being fixed.
    // pinKind (#1197) tells the pad whether to offer letters.
    for (const field of ['name', 'avatarUrl', 'role', 'loginIndex', 'pinLength', 'pinKind']) {
      expect(PUBLIC_MEMBER_FIELDS).toContain(field);
    }
  });

  it('is a closed list, so a new field cannot be added without a decision', () => {
    // The guard: this test fails when someone widens the payload, forcing
    // them to justify the addition rather than discovering it in production.
    expect([...PUBLIC_MEMBER_FIELDS].sort()).toEqual(
      ['avatarUrl', 'color', 'id', 'loginIndex', 'name', 'pinKind', 'pinLength', 'role'].sort(),
    );
  });
});
