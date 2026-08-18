/**
 * Anonymous update-check / telemetry constants.
 *
 * Prism phones home once a week to (a) ask whether a newer version exists so it
 * can show a quiet "update available" line in Settings, and (b) let the
 * maintainer count *active* installs (de-duplicated by a random instance id, so
 * one install that updates ten times still counts once).
 *
 * Design guarantees, all enforced elsewhere in this module:
 *   - Opt-OUT: on by default, one switch in Settings -> About turns it off, and
 *     `PRISM_DISABLE_TELEMETRY=true` hard-disables it for distro/enterprise builds.
 *   - Anonymous: the payload is exactly {schema,id,version,deployment,arch}. No
 *     IP (the collector is instructed not to store it), no PII, no config, no
 *     usage. The id is a random UUID with no link to any account or hostname.
 *   - Inert until configured: if no collector endpoint is set, nothing is sent.
 */

/** Bump if the payload shape changes so the collector can branch on it. */
export const TELEMETRY_SCHEMA_VERSION = 1;

/** Settings-table keys owned by this feature. */
export const TELEMETRY_SETTING_KEYS = {
  /** boolean — user's opt-out switch. Unset/true = enabled (opt-out default). */
  enabled: 'telemetry.enabled',
  /** string — random per-install UUID. Generated lazily on first check-in. */
  instanceId: 'telemetry.instanceId',
  /** string — latest version the collector reported (for the update notice). */
  latestVersion: 'telemetry.latestVersion',
  /** string — ISO timestamp of the last successful check-in. */
  lastCheckAt: 'telemetry.lastCheckAt',
} as const;

/**
 * Where installs check in. This is the maintainer's deployed collector
 * (see /collector — a Cloudflare Worker). Override per-deployment with
 * PRISM_TELEMETRY_URL.
 *
 * NOTE FOR THE MAINTAINER: set this to your deployed Worker URL before shipping
 * a release build. While it is empty, telemetry is completely inert — no
 * request is ever made — which is the safe default for this review branch.
 */
export const DEFAULT_TELEMETRY_ENDPOINT = '';

/** Resolve the collector endpoint (env override wins). Empty => inert. */
export function getTelemetryEndpoint(): string {
  return (process.env.PRISM_TELEMETRY_URL || DEFAULT_TELEMETRY_ENDPOINT).trim();
}

/** The exact anonymous payload sent on each weekly check-in. */
export type TelemetryPayload = {
  /** Payload schema version. */
  schema: number;
  /** Random per-install UUID. Not tied to any account, host, or IP. */
  id: string;
  /** Running app version, e.g. "1.14.2". */
  version: string;
  /**
   * Distribution channel, e.g. "ha" | "docker" | "pikapods" | "render". Set by
   * getDeploymentChannel() so installs can be counted by source. Open-ended so
   * new hosted blueprints need no schema change.
   */
  deployment: string;
  /** CPU architecture, e.g. "x64" | "arm64". */
  arch: string;
};
