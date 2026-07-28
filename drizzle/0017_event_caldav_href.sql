-- 0017_event_caldav_href.sql
--
-- CalDAV upstream delete (issue #171, single-event scope). Deleting a synced
-- CalDAV event in Prism should also remove it from the source server (parity
-- with Google, which already propagates deletes). A CalDAV DELETE targets the
-- calendar object by its href (path on the server), not by UID, so we persist
-- the per-event href — plus the ETag for a conflict-safe delete — at sync time.
--
-- Recurring events are intentionally out of scope: their instances share one
-- parent object, so an href-based delete would remove the whole series. The
-- delete path skips write-back for recurring rows.
--
-- Idempotent (safe to re-run).

ALTER TABLE events ADD COLUMN IF NOT EXISTS caldav_href varchar(1024);
ALTER TABLE events ADD COLUMN IF NOT EXISTS caldav_etag varchar(255);
