-- 0016_event_pending_deletion.sql
--
-- Deletes-only review for calendar sync (issue #171, Stage 3). When a synced
-- event disappears from its source, sync no longer deletes it silently — it
-- sets events.pending_deletion so the user reviews the removal (Delete / Keep),
-- protecting against a source glitch or accidental removal wiping the calendar.
--
-- Idempotent (safe to re-run).

ALTER TABLE events ADD COLUMN IF NOT EXISTS pending_deletion timestamp;

CREATE INDEX IF NOT EXISTS events_pending_deletion_idx ON events (pending_deletion);
