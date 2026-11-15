/**
 * Where to go after signing in (#1221). `next` arrives from the query string,
 * so it is resolved against this page's origin and kept only when it stays on
 * it. A prefix check is not enough: a browser reads `/\evil.example` as
 * `//evil.example`, another site. Returns path, query and hash, or '/'.
 */
export function safeNextPath(next: string | null | undefined, origin: string): string {
  if (!next) return '/';
  try {
    const url = new URL(next, origin);
    if (url.origin !== new URL(origin).origin) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
