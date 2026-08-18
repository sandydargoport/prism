/**
 * Runtime configuration shared by services that need to know where Prism
 * is running.
 *
 * Two distribution channels with different filesystem layouts:
 *   - Docker compose (default):   data persisted at <cwd>/data/{photos,avatars,...}
 *   - Home Assistant addon:       data persisted under /data (HA-managed
 *                                 volume that survives addon updates)
 *
 * Services should always go through getDataRoot() / getPhotosRoot() /
 * getAvatarsRoot() instead of hard-coding `data/...` so a single env var
 * flip moves everything to the right place.
 */
import path from 'path';

/**
 * True when running as a Home Assistant addon. Set by the addon's run.sh.
 * Other code paths (cookie scopes, ingress headers, backup skip) can branch
 * on this flag.
 */
export function isHaMode(): boolean {
  return process.env.PRISM_HA_MODE === '1';
}

/**
 * Which distribution channel this install is running under, used only for the
 * anonymous install count (see src/lib/telemetry). Resolution order:
 *   1. PRISM_DEPLOYMENT env (explicit) — set by hosted blueprints so we can tell
 *      PikaPods / Render / Railway etc. apart from a plain local Docker run.
 *   2. Home Assistant addon (PRISM_HA_MODE=1).
 *   3. Otherwise "docker" (self-hosted compose / bare container).
 * The value is sanitised to a short slug so an odd env can never bloat the payload.
 */
export function getDeploymentChannel(): string {
  const explicit = process.env.PRISM_DEPLOYMENT?.trim().toLowerCase();
  if (explicit) return explicit.replace(/[^a-z0-9_-]/g, '').slice(0, 16) || 'docker';
  if (isHaMode()) return 'ha';
  return 'docker';
}

/**
 * Base directory for persisted state (photos, avatars, future buckets).
 * Overrideable via PRISM_DATA_ROOT — the HA addon sets it to /data, the
 * docker-compose default is `<cwd>/data`.
 */
export function getDataRoot(): string {
  if (process.env.PRISM_DATA_ROOT) return process.env.PRISM_DATA_ROOT;
  return path.join(process.cwd(), 'data');
}

/** Photo storage root. Overrideable independently via PRISM_PHOTO_ROOT. */
export function getPhotosRoot(): string {
  if (process.env.PRISM_PHOTO_ROOT) return process.env.PRISM_PHOTO_ROOT;
  return path.join(getDataRoot(), 'photos');
}

/** Avatar storage root. Overrideable independently via PRISM_AVATAR_ROOT. */
export function getAvatarsRoot(): string {
  if (process.env.PRISM_AVATAR_ROOT) return process.env.PRISM_AVATAR_ROOT;
  return path.join(getDataRoot(), 'avatars');
}
