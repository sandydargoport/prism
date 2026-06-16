import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  DEFAULT_PIN_LENGTH,
  MIN_PIN_LENGTH,
  MAX_PIN_LENGTH,
  PIN_LENGTH_SETTING_KEY,
} from '@/lib/constants';

/**
 * Family-wide PIN length, read from the settings table (server-side source of
 * truth). Used to validate that a PIN being set matches the configured length
 * so a member can never be created with a PIN the login pad can't enter.
 * Falls back to the default if unset or malformed.
 */
export async function getConfiguredPinLength(): Promise<number> {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, PIN_LENGTH_SETTING_KEY));
    const n = Math.round(Number(row?.value));
    if (Number.isFinite(n) && n >= MIN_PIN_LENGTH && n <= MAX_PIN_LENGTH) return n;
  } catch {
    /* fall through to default */
  }
  return DEFAULT_PIN_LENGTH;
}
