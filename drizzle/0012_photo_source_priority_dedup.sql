-- 0012_photo_source_priority_dedup.sql
--
-- Cross-source photo dedup (issue #57). A user who backs up to BOTH
-- OneDrive and iCloud will have the same photo pulled from two sources;
-- we want to display it once, preferring whichever source they rank
-- higher.
--
--   photo_sources.priority — lower = preferred. Read-time dedup keeps the
--   lowest-priority-number copy when multiple sources carry the same shot.
--
--   photos.dedupe_key — `${takenAt-to-the-second}_${width}x${height}`.
--   Identical key across sources ⇒ same photo. Null when EXIF capture
--   time + dimensions are unavailable; those rows are never deduped.
--
-- Both adds are idempotent (IF NOT EXISTS), so a replay over an
-- already-migrated DB is a no-op — see scripts/test-migration-replay.sh
-- Scenario C.

ALTER TABLE photo_sources
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100;

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS dedupe_key varchar(120);

CREATE INDEX IF NOT EXISTS photos_dedupe_key_idx ON photos (dedupe_key);
