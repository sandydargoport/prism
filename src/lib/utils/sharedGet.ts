/**
 * One request for many readers (#1081).
 *
 * A page change mounts several hooks that each read the same resource
 * (`/api/settings` five times on Calendar), and on a slow wall tablet every
 * extra response costs a parse and a re-render. A GET started while the same
 * URL is already in flight joins that request; each caller gets its own copy
 * of the response, so callers read it exactly as they would their own fetch.
 *
 * Only requests in flight are shared. A finished response is never reused:
 * a hook that writes and then reads again must see its write.
 */
const inflight = new Map<string, { pending: Promise<Response>; at: number }>();
/** A request this old is not joined: a hung one must not hold back later reads. */
const JOIN_MS = 10_000;

export function sharedGet(url: string): Promise<Response> {
  const now = Date.now();
  let entry = inflight.get(url);
  if (!entry || now - entry.at > JOIN_MS) {
    const pending = fetch(url);
    const mine = { pending, at: now };
    entry = mine;
    inflight.set(url, mine);
    const done = () => { if (inflight.get(url) === mine) inflight.delete(url); };
    pending.then(done, done);
  }
  const { pending } = entry;
  // A real Response always clones; a test's stand-in object may not, and is
  // then handed over as it is.
  return pending.then((res) => (typeof res.clone === 'function' ? res.clone() : res));
}

/** For tests: forget every request in flight. */
export function resetSharedGet(): void {
  inflight.clear();
}
