/**
 * How each driver's name is shown on the display, set once per driver by the
 * family (say "Mr. O'Donnel" for the name a provider reports in full).
 *
 * A title is never worked out from the name: that would mean guessing the
 * driver's gender, and it would be wrong often enough to matter. Until one is
 * set, the name shows as the provider reports it.
 */

export const BUS_DRIVER_NAMES_SETTING = 'busDriverNames';

export type DriverNames = Record<string, string>;

const MAX_ENTRIES = 200;
const MAX_LENGTH = 60;

export function isDriverNames(value: unknown): value is DriverNames {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= MAX_ENTRIES && entries.every(
    ([k, v]) => k.length > 0 && k.length <= 100 && typeof v === 'string' && v.length <= MAX_LENGTH,
  );
}

/** The name to show for a reported driver name. */
export function driverLabel(reported: string | null | undefined, names: DriverNames | null | undefined): string | null {
  if (!reported) return null;
  const shown = names?.[reported]?.trim();
  return shown || reported;
}
