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
 *   - Feedback votes (#1311) send {schema,id,referendum,answer}, and only when
 *     someone taps an answer in More. The same switches stop them.
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

/**
 * Where a feedback vote goes (#1311): `/vote` beside the check-in on the same
 * collector. The check-in posts to the Worker's root, or to `/v1/checkin`, so
 * `https://c.example.com` gives `https://c.example.com/vote` and
 * `https://c.example.com/v1/checkin` gives `https://c.example.com/v1/vote`.
 * Empty when there is no endpoint (or it is not a URL), which means inert.
 */
export function getVoteEndpoint(): string {
  const base = getTelemetryEndpoint();
  if (!base) return '';
  try {
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/checkin\/?$/, '').replace(/\/$/, '') + '/vote';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Why nothing may be sent right now (see telemetryOffReason in checkIn.ts):
 *   - 'hard-disabled': PRISM_DISABLE_TELEMETRY=true (the Home Assistant
 *     add-on's Anonymous stats option sets it).
 *   - 'disabled': the switch in Settings > About is off.
 *   - 'no-endpoint': no collector on this build (forks, source builds).
 */
export type TelemetryOffReason = 'hard-disabled' | 'disabled' | 'no-endpoint';

/** Bump if the vote payload shape changes. Separate from the check-in's. */
export const VOTE_SCHEMA_VERSION = 1;

/** The exact payload a feedback vote sends (#1311). */
export type VotePayload = {
  /** Vote payload schema version. */
  schema: number;
  /** The same random install UUID the check-in sends, so one install has one answer. */
  id: string;
  /** Which question, e.g. "2026-11-navigation". */
  referendum: string;
  /** Which answer, e.g. "bottom-bar". */
  answer: string;
};

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
