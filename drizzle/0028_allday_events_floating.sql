-- 0028_allday_events_floating.sql
--
-- All-day events are stored as UTC midnight of their first date with an
-- exclusive end at UTC midnight of the day after their last ("floating"),
-- which is how Google sends them and how everything reads them.
--
-- Before #520, iCal and CalDAV all-day events were stored at midnight in the
-- server's own zone. On a UTC server that is the same thing. On a server east
-- of UTC it is the previous UTC day, so those events show a day early; west of
-- UTC the UTC date is right but the value is still not the floating form.
--
-- Sync rewrites the times of every event it still sees, so rows inside the
-- sync window corrected themselves after #520. This converts the rest: older
-- events the sync no longer revisits.
--
-- Scope: all-day events from iCal and CalDAV sources whose start or end is
-- not a UTC midnight. Each value is read as midnight in the zone the server
-- ran in, which is the zone migrate.js runs in (prism.process_timezone; UTC
-- when unset, where these rows would already be midnight and none match).
-- Converted rows are UTC midnights, so running this again changes nothing.

DO $$
DECLARE
  zone text := current_setting('prism.process_timezone', true);
BEGIN
  IF zone IS NULL OR zone = '' OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = zone) THEN
    zone := 'UTC';
  END IF;

  UPDATE events e
  SET start_time = ((e.start_time AT TIME ZONE 'UTC') AT TIME ZONE zone)::date::timestamp,
      end_time = GREATEST(
        ((e.end_time AT TIME ZONE 'UTC') AT TIME ZONE zone)::date,
        ((e.start_time AT TIME ZONE 'UTC') AT TIME ZONE zone)::date + 1
      )::timestamp
  FROM calendar_sources s
  WHERE e.calendar_source_id = s.id
    AND s.provider IN ('ical', 'caldav')
    AND e.all_day
    AND (e.start_time::time <> '00:00' OR e.end_time::time <> '00:00');
END $$;
