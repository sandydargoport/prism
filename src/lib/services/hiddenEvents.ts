import { and, eq, isNotNull, isNull, ne, notExists, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db/client';
import { events, hiddenEventSeries } from '@/lib/db/schema';

const twin = alias(events, 'live_twin');

/**
 * The condition every event read path adds so hidden events stay out (#592):
 * not hidden on its own, and not an occurrence of a hidden series. A row with
 * no seriesKey never matches a series, since NULL equals nothing.
 *
 * Also out: a synced event its source no longer has (pending deletion) when
 * the same calendar has a live event with the same title at the same time.
 * Google replaces a series when it is edited, under new ids; the old copy
 * waits for a parent's review, and until then the screen showed it twice
 * (#1047). One gone from its source with no replacement still shows until
 * reviewed, so a sync that wrongly flags everything empties nothing.
 */
export function visibleEventsCondition() {
  return and(
    or(
      isNull(events.pendingDeletion),
      notExists(
        db
          .select({ one: sql`1` })
          .from(twin)
          .where(and(
            isNotNull(events.pendingDeletion),
            eq(twin.calendarSourceId, events.calendarSourceId),
            eq(twin.startTime, events.startTime),
            eq(twin.title, events.title),
            ne(twin.id, events.id),
            isNull(twin.pendingDeletion),
          )),
      ),
    ),
    isNull(events.hiddenAt),
    notExists(
      db
        .select({ one: sql`1` })
        .from(hiddenEventSeries)
        .where(and(
          eq(hiddenEventSeries.calendarSourceId, events.calendarSourceId),
          eq(hiddenEventSeries.seriesKey, events.seriesKey),
        )),
    ),
  );
}
