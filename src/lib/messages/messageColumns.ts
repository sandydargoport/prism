import { familyMessages, users } from '@/lib/db/schema';

/**
 * Columns for a message with its author. Use with a LEFT join on users: a
 * guest note has no user row and an inner join silently drops it.
 */
export const messageWithAuthorColumns = {
  id: familyMessages.id,
  message: familyMessages.message,
  pinned: familyMessages.pinned,
  important: familyMessages.important,
  expiresAt: familyMessages.expiresAt,
  createdAt: familyMessages.createdAt,
  guestKind: familyMessages.guestKind,
  guestName: familyMessages.guestName,
  authorId: users.id,
  authorName: users.name,
  authorColor: users.color,
  authorAvatar: users.avatarUrl,
};
