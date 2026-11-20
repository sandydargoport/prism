/**
 * Reading and changing timelines on the server (#1266). See src/lib/timeline.ts
 * for what a timeline is.
 *
 * There is always at least one: the migration makes the household's first,
 * and reading the list makes it again if every one is gone, so a screen always
 * has a timeline to follow.
 */
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { displays, timelines } from '@/lib/db/schema';
import { FIRST_TIMELINE_NAME, firstTimeline, toTimeline, type Timeline } from '@/lib/timeline';

type Row = typeof timelines.$inferSelect;

async function rows(): Promise<Row[]> {
  return db.select().from(timelines).orderBy(asc(timelines.position), asc(timelines.createdAt));
}

/** Every timeline, first first, with how many named screens follow each. */
export async function listTimelines(): Promise<Timeline[]> {
  let all = await rows();
  if (all.length === 0) {
    await db.insert(timelines).values({ name: FIRST_TIMELINE_NAME, position: 0 });
    all = await rows();
  }
  const first = firstTimeline(all);
  const picked = await db.select({ timelineId: displays.timelineId }).from(displays);
  const count = new Map<string, number>();
  for (const { timelineId } of picked) {
    // A screen that picked none follows the first.
    const id = timelineId && all.some((t) => t.id === timelineId) ? timelineId : first?.id;
    if (id) count.set(id, (count.get(id) ?? 0) + 1);
  }
  return all.map((row) => toTimeline(row, count.get(row.id) ?? 0));
}

/** The timeline a named screen follows, or the household's first for any other device. */
export async function timelineOf(screen: { timelineId: string | null } | null): Promise<Timeline | null> {
  const all = await listTimelines();
  return (screen?.timelineId ? all.find((t) => t.id === screen.timelineId) : undefined) ?? firstTimeline(all);
}
