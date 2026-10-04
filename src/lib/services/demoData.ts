/**
 * Find and purge the demo data written by the database init seed
 * (src/lib/db/init/demo/seed.sql).
 *
 * Until #605 that seed ran on every new Docker Compose volume, so real
 * households started with the fictional family and its tasks, chores, events
 * and birthdays mixed into their own. Removing the demo members does not
 * clean it up: most tables keep their rows and set the member link to null.
 *
 * The seed is one DO block, so one transaction, and Postgres' now() is fixed
 * for a transaction. Every row it inserts therefore carries the same
 * created_at to the microsecond, which nothing done through the app shares.
 * A timestamp found in several of the seeded tables at once is the seed's,
 * and the rows that carry it are exactly the seed's rows, whatever they have
 * been renamed to since.
 *
 * Rows that hang off seeded rows (chore completions, shopping items,
 * messages, calendar groups) go with them through ON DELETE CASCADE.
 * The richer TypeScript seed (Settings > Seed demo data) inserts row by row
 * and is not detected here; that one only runs when asked for.
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { invalidateEntities } from '@/lib/cache/cacheKeys';

/**
 * Tables the seed writes, with the column holding the seed's timestamp, and
 * whether a purge deletes from it. Parents last.
 */
const SEEDED_TABLES: ReadonlyArray<readonly [table: string, column: string, purge: boolean]> = [
  ['tasks', 'created_at', true],
  ['family_messages', 'created_at', true],
  ['events', 'created_at', true],
  ['chores', 'created_at', true],
  ['shopping_items', 'created_at', true],
  ['shopping_lists', 'created_at', true],
  ['meals', 'created_at', true],
  ['maintenance_reminders', 'created_at', true],
  ['birthdays', 'created_at', true],
  ['goals', 'created_at', true],
  // Detection only. The seeded layout is the stock default dashboard with no
  // demo content, and households edit it in place (its created_at stays), so
  // deleting it would throw away their own layout.
  ['layouts', 'created_at', false],
  // Only rows never changed since, so a setting the household chose stays.
  ['settings', 'updated_at', true],
  ['users', 'created_at', true],
];

/**
 * A timestamp has to appear in this many seeded tables before it counts as
 * the seed's. The seed fills twelve; an app action that writes several
 * tables in one transaction still touches far fewer.
 */
const MIN_TABLES = 5;

export type DemoDataSummary = {
  present: boolean;
  /** Current names of the seeded members still in the household. */
  members: string[];
  /** Rows per table that a purge would delete (cascaded rows not counted). */
  counts: Record<string, number>;
  /**
   * Calendars connected under a seeded member, and their events. Deleting a
   * member cascades to the calendars they connected, so a household that
   * signed in as a demo member to connect its own calendar loses it here.
   */
  connected: { calendars: number; events: number };
};

type Executor = Pick<typeof db, 'execute'>;

async function seedStamps(exec: Executor): Promise<string[]> {
  const unions = SEEDED_TABLES.map(
    ([table, column]) => `SELECT DISTINCT '${table}' AS t, ${column} AS stamp FROM ${table}`,
  ).join(' UNION ALL ');
  const rows = await exec.execute(
    sql.raw(
      `SELECT stamp::text AS stamp FROM (${unions}) s GROUP BY stamp HAVING count(DISTINCT t) >= ${MIN_TABLES}`,
    ),
  );
  return (rows as unknown as Array<{ stamp: string }>).map((r) => r.stamp);
}

function stampList(stamps: string[]) {
  return sql.join(stamps.map((s) => sql`${s}::timestamp`), sql`, `);
}

export async function findDemoData(): Promise<DemoDataSummary> {
  const stamps = await seedStamps(db);
  if (stamps.length === 0) return { present: false, members: [], counts: {}, connected: { calendars: 0, events: 0 } };

  const counts: Record<string, number> = {};
  for (const [table, column, purge] of SEEDED_TABLES) {
    if (!purge) continue;
    const rows = await db.execute(
      sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} IN (${stampList(stamps)})`,
    );
    const n = (rows as unknown as Array<{ n: number }>)[0]?.n ?? 0;
    if (n > 0) counts[table] = n;
  }
  const memberRows = await db.execute(
    sql`SELECT name FROM users WHERE created_at IN (${stampList(stamps)}) ORDER BY name`,
  );
  const members = (memberRows as unknown as Array<{ name: string }>).map((r) => r.name);

  const connectedRows = await db.execute(sql`
    SELECT count(DISTINCT cs.id)::int AS calendars, count(e.id)::int AS events
    FROM calendar_sources cs LEFT JOIN events e ON e.calendar_source_id = cs.id
    WHERE cs.user_id IN (SELECT id FROM users WHERE created_at IN (${stampList(stamps)}))
  `);
  const connected = (connectedRows as unknown as Array<{ calendars: number; events: number }>)[0]
    ?? { calendars: 0, events: 0 };

  return { present: true, members, counts, connected };
}

/** Delete every seeded row in one transaction. Returns the rows deleted per table. */
export async function purgeDemoData(): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {};
  await db.transaction(async (tx) => {
    const stamps = await seedStamps(tx);
    if (stamps.length === 0) return;

    // The wall display's default member may be one of the seeded parents
    // (setup picks the first parent). Drop the setting rather than leave it
    // pointing at nobody; Settings or the next setup sets it again.
    await tx.execute(sql`
      DELETE FROM settings WHERE key = 'displayUserId'
        AND value #>> '{}' IN (SELECT id::text FROM users WHERE created_at IN (${stampList(stamps)}))
    `);

    for (const [table, column, purge] of SEEDED_TABLES) {
      if (!purge) continue;
      const rows = await tx.execute(
        sql`DELETE FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} IN (${stampList(stamps)}) RETURNING 1`,
      );
      const n = (rows as unknown as unknown[]).length;
      if (n > 0) deleted[table] = n;
    }
  });
  // Targeted, not a full flush: sessions live in the same Redis, and the
  // household member running the purge should stay signed in. Deleting
  // members cascades widely, so this covers every entity a member owns.
  if (Object.keys(deleted).length > 0) {
    await invalidateEntities(
      'family', 'tasks', 'task-lists', 'task-sources', 'messages', 'events', 'calendar-groups',
      'calendar-notes', 'chores', 'points', 'shopping-lists', 'shopping-list-sources', 'meals',
      'recipes', 'maintenance', 'birthdays', 'goals', 'settings', 'layouts', 'wish-items',
      'wish-item-sources', 'gift-ideas', 'bus', 'travel', 'weekend',
    ).catch(() => {});
  }
  return deleted;
}
