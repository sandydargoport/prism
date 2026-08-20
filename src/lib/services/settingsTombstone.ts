/**
 * Reusable "tombstone" (soft-delete / dismissed-item) store backed by a single
 * key in the settings table, holding a JSON array of { id, name } entries.
 *
 * When a user deletes a synced item that a provider would otherwise re-create on
 * the next sync (a Google calendar, and — with a parallel store — potentially
 * photos or other entities), we record its external id here so discovery skips
 * it. Storing the display name alongside the id lets a "Removed items → Restore"
 * UI show something human instead of an opaque id.
 *
 * Entity-agnostic on purpose: any sub-page that tombstones via a settings key
 * can reuse this (calendars use `dismissedGoogleCalendarIds`). Table-backed
 * tombstones (excluded_photos, dismissed_events) keep their own storage but can
 * expose the same { id, name } + restore contract to share the UI.
 *
 * Backward compatible: legacy values were a bare `string[]` of ids; those are
 * read transparently as { id, name: id } so nothing breaks pre-migration.
 */
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface TombstoneEntry {
  id: string;
  name: string;
}

/** Coerce a raw settings value (legacy string[] or {id,name}[]) to entries. */
export function normalizeTombstones(raw: unknown): TombstoneEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): TombstoneEntry | null => {
      if (typeof item === 'string') return { id: item, name: item };
      if (item && typeof item === 'object' && typeof (item as TombstoneEntry).id === 'string') {
        const e = item as TombstoneEntry;
        return { id: e.id, name: typeof e.name === 'string' && e.name ? e.name : e.id };
      }
      return null;
    })
    .filter((e): e is TombstoneEntry => e !== null);
}

async function readRaw(key: string): Promise<TombstoneEntry[]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return normalizeTombstones(row?.value);
}

async function writeRaw(key: string, entries: TombstoneEntry[]): Promise<void> {
  const [existing] = await db.select().from(settings).where(eq(settings.key, key));
  if (existing) {
    await db.update(settings).set({ value: entries, updatedAt: new Date() }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value: entries });
  }
}

/** All tombstoned entries for this key (each { id, name }). */
export async function listTombstones(key: string): Promise<TombstoneEntry[]> {
  return readRaw(key);
}

/** Just the ids, as a Set — for fast "is this dismissed?" checks in discovery. */
export async function tombstoneIdSet(key: string): Promise<Set<string>> {
  return new Set((await readRaw(key)).map((e) => e.id));
}

/** Add (or refresh the name of) a tombstone. Idempotent on id. */
export async function addTombstone(key: string, entry: TombstoneEntry): Promise<void> {
  const entries = await readRaw(key);
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = entry; // refresh name
  } else {
    entries.push(entry);
  }
  await writeRaw(key, entries);
}

/** Remove a tombstone by id (the "restore" primitive). No-op if absent. */
export async function removeTombstone(key: string, id: string): Promise<void> {
  const entries = await readRaw(key);
  const next = entries.filter((e) => e.id !== id);
  if (next.length !== entries.length) await writeRaw(key, next);
}
