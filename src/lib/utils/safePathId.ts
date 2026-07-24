/**
 * Guard for route/entity ids that are interpolated into filesystem paths.
 *
 * Avatar and recipe-image storage build `path.join(DIR, `${id}.jpg`)` from an
 * id that arrives as a raw route param. Ids in this codebase are always UUIDs
 * (users.id, recipes.id), so restricting to the UUID shape rejects any `..`,
 * `/`, `\`, or NUL payload that could escape the storage directory — without
 * needing a resolved-path prefix check. Non-UUID ids never address a real
 * file here, so rejecting them changes no legitimate behavior.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSafePathId(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id);
}

/**
 * Throw if `id` is not a UUID. Storage helpers call this before touching the
 * filesystem; the image GET routes turn the throw into a 404.
 */
export function assertSafePathId(id: unknown): asserts id is string {
  if (!isSafePathId(id)) {
    throw new Error('Invalid id: expected a UUID');
  }
}
