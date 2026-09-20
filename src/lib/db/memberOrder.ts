import { asc } from 'drizzle-orm';
import { users } from './schema';

/**
 * The canonical family-member ordering, and the one thing several endpoints
 * have to agree on exactly.
 *
 * `/api/family` hands the unauthenticated PIN pad an ordinal `loginIndex`
 * rather than a UUID, and `/api/auth/login` and `/api/auth/verify-pin` resolve
 * that ordinal back to a member by re-running the same query. Neither
 * `sortOrder` nor `createdAt` is unique: members written in a single statement,
 * by a seed or a restore, tie on both, and SQL leaves the relative order of
 * tied rows undefined. Two runs of the same query could disagree, so the pad
 * could show one member, post their index, and have the server resolve it to
 * another one, authenticating the wrong person against their own PIN.
 *
 * `id` is the primary key, so appending it makes the ordering total: there are
 * no ties left to break. Import this instead of spelling the columns out at a
 * call site, so the three ordinal paths cannot drift apart again.
 */
export const memberOrder = [asc(users.sortOrder), asc(users.createdAt), asc(users.id)];
