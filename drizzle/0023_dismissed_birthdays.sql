-- 0023_dismissed_birthdays.sql
--
-- Two changes supporting source-agnostic birthday detection.
--
-- 1. `dismissed_birthdays` — tombstones for detected birthdays the user
--    deleted. Detection now re-reads every calendar on each sync, so without
--    a tombstone a dismissed entry is simply re-added on the next run and the
--    delete button appears not to work. Mirrors the existing
--    `dismissed_events` pattern.
--
--    Keyed on normalised name + month/day rather than a source event id: the
--    same person legitimately arrives from several calendars and from CardDAV
--    contacts, and dismissing them once should hold everywhere. The year is
--    deliberately excluded — 1904 is the unknown-year sentinel, so the same
--    person can arrive carrying different years from different sources.
--
-- 2. Seeds `provider_config.lifeEventsCalendar` for calendars that the old
--    hardcoded logic treated as birthday sources: any source whose name
--    contained "friends" (the FRIENDS_FAMILY_CALENDAR_NAME magic string), and
--    Google's generated contacts birthday calendar. Existing installs keep
--    the behaviour they had, with no user action, while the magic string
--    disappears from the code.

CREATE TABLE IF NOT EXISTS dismissed_birthdays (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_name varchar(100) NOT NULL,
  birth_month     integer NOT NULL,
  birth_day       integer NOT NULL,
  event_type      varchar(20) NOT NULL DEFAULT 'birthday',
  created_at      timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dismissed_birthdays_name_day_type_unique
  ON dismissed_birthdays (normalized_name, birth_month, birth_day, event_type);

-- Idempotent: only touches rows that don't already carry the flag.
UPDATE calendar_sources
SET provider_config = COALESCE(provider_config, '{}'::jsonb)
                      || '{"lifeEventsCalendar": true}'::jsonb
WHERE (provider_config->>'lifeEventsCalendar') IS NULL
  AND (
    COALESCE(display_name, '') ILIKE '%friends%'
    OR COALESCE(dashboard_calendar_name, '') ILIKE '%friends%'
    OR source_calendar_id LIKE '%addressbook#contacts%'
  );
