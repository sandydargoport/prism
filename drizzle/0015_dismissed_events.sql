-- 0015_dismissed_events.sql
--
-- Tombstones for synced calendar events the user deleted locally. A one-way
-- pull sync would otherwise re-add them from the source on the next run, so the
-- sync skips any (calendar_source_id, external_event_id) recorded here.
-- (Google deletes also propagate upstream; CalDAV/iCal rely on this table.)
--
-- Idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS dismissed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  calendar_source_id uuid NOT NULL,
  external_event_id varchar(255) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

-- FK dismissed_events.calendar_source_id -> calendar_sources.id (guarded).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'dismissed_events_calendar_source_id_calendar_sources_id_fk'
      AND table_name = 'dismissed_events'
  ) THEN
    ALTER TABLE dismissed_events
      ADD CONSTRAINT dismissed_events_calendar_source_id_calendar_sources_id_fk
      FOREIGN KEY (calendar_source_id) REFERENCES calendar_sources(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS dismissed_events_source_external_unique
  ON dismissed_events (calendar_source_id, external_event_id);
