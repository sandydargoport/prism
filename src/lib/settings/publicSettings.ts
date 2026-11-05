/**
 * The settings a caller who may not change settings gets to read (#809).
 *
 * GET /api/settings answers the signed-out wall, and while the auth wall is
 * off, any caller on the network. It used to return every row. Rows the wall
 * never reads, and that are a parent's business, are now left out for anyone
 * who may not change settings: integration credentials (encrypted, but still
 * not theirs to have), the Wi-Fi config (the babysitter screen has its own
 * endpoint), the telemetry id, the Gmail label, the Mapbox token, which
 * member the display signs in as, and all of `security` but the one switch
 * the wall needs.
 */
const HIDDEN_KEYS = new Set(['wifiConfig', 'busGmailLabel', 'mapboxToken', 'displayUserId']);
const HIDDEN_PREFIXES = ['credentials.', 'telemetry.'];

export function publicSettings(all: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(all)) {
    if (HIDDEN_KEYS.has(key) || HIDDEN_PREFIXES.some((p) => key.startsWith(p))) continue;
    if (key === 'security') {
      const v = value as { requirePinForEveryChange?: unknown } | null;
      // The wall needs only whether everyday jobs ask for a PIN (#835).
      if (v && typeof v === 'object' && 'requirePinForEveryChange' in v) {
        out.security = { requirePinForEveryChange: v.requirePinForEveryChange };
      }
      continue;
    }
    out[key] = value;
  }
  return out;
}
