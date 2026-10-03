/**
 * Notes on the Messages board from someone without an account (#497).
 *
 * A guest note is a family_messages row with no author_id. guest_kind says
 * who wrote it and guest_name is the name they typed, if any. Only Babysitter
 * Mode opens the door today; another kind (a visitor, say) needs a value here
 * and its own gate in /api/guest-notes, not a schema change.
 */

export type GuestKind = 'babysitter';

export const GUEST_NOTE_MAX_LENGTH = 500;
export const GUEST_NAME_MAX_LENGTH = 40;

/** Household-wide, not per caller: a forwarded IP is trivially faked. */
export const GUEST_NOTE_RATE_LIMIT = { limit: 10, windowSeconds: 60 * 60 };

const GUEST_AUTHORS: Record<GuestKind, { id: string; name: string; color: string; avatarUrl: string }> = {
  babysitter: { id: 'babysitter', name: 'Babysitter', color: '#64748b', avatarUrl: 'emoji:🍼' },
};

/**
 * The author shown for a guest note. The id is fixed per kind, so the
 * Messages page can group and filter guest notes like any member's.
 */
export function guestAuthor(kind: GuestKind | null, name: string | null) {
  const base = GUEST_AUTHORS[kind ?? 'babysitter'];
  return {
    id: base.id,
    name: name ? `${base.name} (${name})` : base.name,
    color: base.color,
    avatarUrl: base.avatarUrl as string | null,
  };
}

export function isGuestAuthorId(id: string): boolean {
  return Object.values(GUEST_AUTHORS).some((a) => a.id === id);
}
