-- 0029_default_now_to_utc.sql
--
-- Timestamp columns are `timestamp without time zone` holding UTC, and
-- Drizzle reads them as UTC. A column default of now() writes the wall time
-- of the session's zone, and until #527 opened every connection in UTC,
-- sessions ran in the database's own default zone. Where that is not UTC
-- (the Home Assistant add-on's bundled database takes the host's zone at
-- initdb), every default-written timestamp is that zone's wall time read as
-- UTC: messages show as hours old, and records land on the wrong day.
--
-- This converts them, reading each value as wall time in the database's
-- default zone (prism.db_default_timezone, set by migrate.js from a
-- connection without the UTC override). No published image contains #527,
-- so on an install upgrading from a release every existing row was written
-- the old way. When the default zone is UTC nothing changes.
--
-- Converted:
-- - created_at in every table where it defaults to now(). The app never
--   writes it explicitly.
-- - updated_at where it still equals created_at, i.e. the row has not been
--   updated since the insert that set both. An update writes a UTC value.
-- - goals.last_reset_at where it still equals created_at (a redeem writes it
--   explicitly), and goal_achievements.achieved_at (only ever the default).
--
-- Not converted: chore_completions.completed_at, which the app writes in UTC
-- except on the voice path, with nothing in the row to tell the two apart;
-- and settings.updated_at, which has no created_at to compare against.

DO $$
DECLARE
  zone text := current_setting('prism.db_default_timezone', true);
  t record;
BEGIN
  IF zone IS NULL OR zone = '' THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = zone) THEN
    RAISE NOTICE '0029: database default zone % is not a zone name, nothing converted', zone;
    RETURN;
  END IF;
  -- A zone that is UTC all year leaves every value as it is.
  IF NOT EXISTS (
    SELECT 1 FROM generate_series(0, 11) AS m
    WHERE (timestamp '2026-01-15' + make_interval(months => m)) AT TIME ZONE zone
       <> (timestamp '2026-01-15' + make_interval(months => m)) AT TIME ZONE 'UTC'
  ) THEN
    RETURN;
  END IF;

  -- Before the loop below, which converts created_at.
  UPDATE goals
  SET last_reset_at = (last_reset_at AT TIME ZONE zone) AT TIME ZONE 'UTC'
  WHERE last_reset_at = created_at;

  UPDATE goal_achievements
  SET achieved_at = (achieved_at AT TIME ZONE zone) AT TIME ZONE 'UTC';

  FOR t IN
    SELECT c.table_name,
           EXISTS (
             SELECT 1 FROM information_schema.columns u
             WHERE u.table_schema = 'public'
               AND u.table_name = c.table_name
               AND u.column_name = 'updated_at'
               AND u.data_type = 'timestamp without time zone'
           ) AS has_updated_at
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'created_at'
      AND c.data_type = 'timestamp without time zone'
      AND c.column_default ILIKE '%now()%'
  LOOP
    IF t.has_updated_at THEN
      -- SET expressions see the row as it was, so the comparison is between
      -- the two stored values.
      EXECUTE format(
        'UPDATE %I SET created_at = (created_at AT TIME ZONE %L) AT TIME ZONE ''UTC'', '
        'updated_at = CASE WHEN updated_at = created_at '
        'THEN (updated_at AT TIME ZONE %L) AT TIME ZONE ''UTC'' ELSE updated_at END',
        t.table_name, zone, zone);
    ELSE
      EXECUTE format(
        'UPDATE %I SET created_at = (created_at AT TIME ZONE %L) AT TIME ZONE ''UTC''',
        t.table_name, zone);
    END IF;
  END LOOP;
END $$;
