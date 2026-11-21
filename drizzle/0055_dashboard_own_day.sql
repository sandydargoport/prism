-- 0055_dashboard_own_day.sql
--
-- A dashboard keeps its own resting and night look again (#1281): what it
-- shows while resting, what it shows at night, and when night is. Every
-- screen showing it rests and sleeps the same way. For a while it lived on
-- the timeline the screen followed (#1266); it is back on
-- `layouts.idle_background`, which 0054 left in place, unread.
--
-- Where the household's first timeline, the one every screen followed unless
-- it picked another, was changed after 0054 made it, every dashboard takes
-- its look, so each screen rests as it did the moment before. Where it was
-- never changed (an install upgraded straight past 0054, which runs this in
-- the same start), its look is the default dashboard's, and each dashboard
-- keeps its own. `timelines.idle_background` stays, unread, so a rollback
-- finds it.
--
-- Runs once: the copy is marked on the timelines' column, so a replay leaves
-- a look changed since alone. Idempotent (safe to re-run).

DO $$
DECLARE
  moved CONSTANT text := 'moved to layouts.idle_background by 0055';
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'timelines'
        AND column_name = 'idle_background')
    AND col_description('timelines'::regclass,
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'timelines'::regclass AND attname = 'idle_background'))
      IS DISTINCT FROM moved
  THEN
    UPDATE layouts SET idle_background = first.idle_background
    FROM (SELECT idle_background, created_at, updated_at FROM timelines ORDER BY position, created_at LIMIT 1) AS first
    WHERE first.updated_at > first.created_at;

    EXECUTE format('COMMENT ON COLUMN timelines.idle_background IS %L', moved);
  END IF;
END $$;
