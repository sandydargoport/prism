/**
 * Anonymous per-install identifier.
 *
 * A random UUID generated on first check-in and persisted in the settings
 * table. It exists only so the collector can de-duplicate: one install that
 * updates every week counts as a single active install rather than N. It is not
 * derived from anything (no hostname, MAC, account, or IP) and can be wiped by
 * clearing the `telemetry.instanceId` setting.
 */
import { randomUUID } from 'node:crypto';
import { TELEMETRY_SETTING_KEYS } from './constants';
import { readSetting, writeSetting } from './store';

/** Return the install's UUID, generating and persisting one on first call. */
export async function getOrCreateInstanceId(): Promise<string> {
  const existing = await readSetting<string>(TELEMETRY_SETTING_KEYS.instanceId);
  if (existing && typeof existing === 'string') return existing;

  const id = randomUUID();
  await writeSetting(TELEMETRY_SETTING_KEYS.instanceId, id);
  return id;
}
