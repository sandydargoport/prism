import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const BABYSITTER_MODE_KEY = 'babysitterMode';

export type BabysitterModeState = {
  enabled: boolean;
  enabledAt: string | null;
  enabledBy: string | null;
};

const OFF: BabysitterModeState = { enabled: false, enabledAt: null, enabledBy: null };

/** Babysitter Mode as a parent last set it; off when it was never set. */
export async function getBabysitterModeState(): Promise<BabysitterModeState> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, BABYSITTER_MODE_KEY));
  return row ? (row.value as BabysitterModeState) : OFF;
}
