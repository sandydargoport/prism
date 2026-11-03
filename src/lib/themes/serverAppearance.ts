import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { APPEARANCE_SETTING, appearanceFromRow, type Appearance } from './appearance';

/**
 * The household's look, read on the server so the first paint already has it.
 *
 * Null when the database cannot be read (or at build time, when there is none):
 * the layout then renders no attribute and the head script falls back to what
 * this browser saw last. Guessing here would be worse, because the default for
 * a missing row (v2) is the wrong answer for every install that predates it.
 */
export async function getServerAppearance(): Promise<Appearance | null> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, APPEARANCE_SETTING));
    return appearanceFromRow(row?.value, !!row);
  } catch {
    return null;
  }
}
