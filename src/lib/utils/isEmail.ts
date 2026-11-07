/**
 * A loose email shape check: a local part, an at sign, a dotted domain, at
 * most 254 characters.
 *
 * The pattern it replaces, `[^\s@]+@[^\s@]+\.[^\s@]+`, let the domain and the
 * dot overlap, so a long string without a dot took seconds to reject on the
 * server's only thread (CodeQL polynomial ReDoS). Here no two parts can match
 * the same character, and the length is capped before the test.
 */
export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}
