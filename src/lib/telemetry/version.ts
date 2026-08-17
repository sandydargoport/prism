/**
 * Pure semver helpers for the update check. Kept dependency-free so they can be
 * unit-tested without importing the db/runtime chain.
 */

/**
 * Compare two dotted versions. Returns 1 if a>b, -1 if a<b, 0 if equal.
 * Tolerant of a leading "v" and of differing segment counts.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/**
 * Whether to surface an "update available" hint for `latest` vs `current`.
 *
 * Deliberately suppresses patch-only bumps (x.y.Z): a wall-mounted family
 * dashboard shouldn't nag on every hotfix, and a fast patch cadence must not
 * translate into constant notices. Only a newer MAJOR or MINOR qualifies.
 */
export function isNotifiableUpdate(current: string, latest?: string): boolean {
  if (!latest) return false;
  if (compareVersions(latest, current) <= 0) return false;
  const [cMaj = 0, cMin = 0] = current.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const [lMaj = 0, lMin = 0] = latest.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  return lMaj > cMaj || (lMaj === cMaj && lMin > cMin);
}
