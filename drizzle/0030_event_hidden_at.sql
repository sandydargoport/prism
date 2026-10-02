-- 0030_event_hidden_at.sql
--
-- Hide an event in Prism without deleting it (#592). A hidden event stays in
-- its source calendar; Prism leaves it out of every view. The sync upserts
-- name the columns they overwrite, so a hide survives every sync.
--
-- Idempotent (safe to re-run).

ALTER TABLE events ADD COLUMN IF NOT EXISTS hidden_at timestamp;
