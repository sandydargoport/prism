/**
 * The exact fields /api/family returns to an unauthenticated caller.
 *
 * Declared separately from the route so it can be asserted in a test. This
 * endpoint answers before anyone has signed in — the login pad needs the
 * member list to render — so anything listed here is readable by any device
 * on the network. Adding a field is a disclosure decision, not a detail.
 */
export const PUBLIC_MEMBER_FIELDS = [
  'id', // always '' — the real UUID is withheld; loginIndex is the selector
  'loginIndex',
  'name',
  'role',
  'color',
  'avatarUrl',
  'pinLength',
  // Whether the pad offers letters (#1197). Says no more than pinLength does:
  // the shape of the credential, never the credential.
  'pinKind',
] as const;

export type PublicMemberField = (typeof PUBLIC_MEMBER_FIELDS)[number];
