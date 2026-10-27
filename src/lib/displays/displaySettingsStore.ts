/**
 * Writes to a screen's stored settings (#690).
 *
 * The merge is done by Postgres in one UPDATE (add the set keys with `||`,
 * drop the unset ones with `-`), not read, merged and written back here, so a
 * change from the screen and one from a phone arriving together both land.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';
import type { ScreenSettingChanges, ScreenSettings } from './screenSettings';

export type StoredScreenSettings = {
  settings: ScreenSettings;
  settingsUpdatedAt: Date | null;
};

/** Apply changes to a display's settings. Null when the display does not exist. */
export async function applySettingChanges(
  displayId: string,
  changes: ScreenSettingChanges
): Promise<StoredScreenSettings | null> {
  const set: Record<string, string> = {};
  const unset: string[] = [];
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) unset.push(key);
    else if (typeof value === 'string') set[key] = value;
  }

  const [row] = await db
    .update(displays)
    .set({
      // The removed keys go in as one JSON array rather than a JS array, which
      // the driver would expand into a list (and an empty one into invalid SQL).
      settings: sql`(${displays.settings} || ${JSON.stringify(set)}::jsonb)
        - ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(unset)}::jsonb))`,
      settingsUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(displays.id, displayId))
    .returning({ settings: displays.settings, settingsUpdatedAt: displays.settingsUpdatedAt });
  return row ?? null;
}
