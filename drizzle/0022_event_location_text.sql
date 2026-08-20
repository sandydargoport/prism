-- Widen events.location from varchar(255) to text.
--
-- Real calendar locations can exceed 255 chars — e.g. a CalDAV event whose
-- LOCATION concatenates several venue rooms with ';' separators (300+ chars).
-- The length check rejected the whole row, so every occurrence of such a
-- recurring series failed to sync. text has identical storage/perf to varchar
-- in Postgres and matches the already-text description column. varchar->text
-- needs no table rewrite and preserves all existing values.
ALTER TABLE "events" ALTER COLUMN "location" TYPE text;
