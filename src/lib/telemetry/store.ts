/**
 * Tiny typed read/write helpers over the key-value `settings` table, scoped to
 * the telemetry feature so it does not depend on the HTTP settings route.
 */
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/** Read a single setting value, or `undefined` if the key is absent. */
export async function readSetting<T = unknown>(key: string): Promise<T | undefined> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row ? (row.value as T) : undefined;
}

/** Upsert a single setting value. */
export async function writeSetting(key: string, value: unknown): Promise<void> {
  const [existing] = await db.select().from(settings).where(eq(settings.key, key));
  if (existing) {
    await db
      .update(settings)
      .set({ value: value as object, updatedAt: new Date() })
      .where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value: value as object });
  }
}
