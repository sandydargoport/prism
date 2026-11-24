-- 0057_screen_owns_day.sql
--
-- The screen owns its day (#1345): what it shows idle by day and at night,
-- when night is, and how much darker at night. Until now the looks and the
-- rule were on the dashboard that was up (`layouts.idle_background`), so a
-- switch to another dashboard changed how the screen idled, and how much
-- darker was the screen setting `prism-screensaver-dim`.
--
-- The day is now one screen setting, `prism-screen-day`, kept in
-- `displays.settings` as the JSON text of
--   {"day": look, "night": look, "switch": night rule, "nightLevel": 0|25|50|75}.
--
--  - Each named screen takes the idle background of the dashboard it
--    normally shows (the default dashboard when it shows the household's),
--    so it idles as it did whenever no switch was in force.
--  - Its `prism-screensaver-dim` moves into the night level; none is 0, not
--    darker. The key is removed.
--  - A screen that switched to a dashboard which idled differently now idles
--    as its normal dashboard during the switch too. Each such screen is
--    logged once, by name, as a notice starting "0057:".
--  - The household's starting day, one `settings` row (`screenStartingDay`),
--    takes the default dashboard's idle background, not darker, as 0054 did
--    for its first timeline. A fresh install has it already from
--    02-schema.sql (50% darker), and keeps that.
--
-- `layouts.idle_background` stays, unread, so a rollback finds it.
--
-- Runs once per screen: a screen that already has its day is left alone, so
-- a replay keeps a day changed since. Idempotent (safe to re-run).

CREATE OR REPLACE FUNCTION pg_temp.prism_screen_day(bg jsonb, level integer) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT jsonb_build_object(
    'day', COALESCE(bg->'day', bg->'source', '"dashboard"'::jsonb),
    'night', COALESCE(bg->'night', bg->'source', '"dashboard"'::jsonb),
    -- One look all the time had the default night: half an hour after sunset
    -- to half an hour before sunrise.
    'switch', CASE WHEN bg ? 'day' AND bg ? 'night' AND bg ? 'switch' THEN bg->'switch'
      ELSE '{"by": "sun", "duskOffset": 30, "dawnOffset": -30}'::jsonb END,
    'nightLevel', level
  )
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.prism_dim_level(dim text) RETURNS integer
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE dim WHEN '0.25' THEN 25 WHEN '0.5' THEN 50 WHEN '0.75' THEN 75 ELSE 0 END
$fn$;

DO $$
DECLARE
  default_bg CONSTANT jsonb := COALESCE(
    (SELECT idle_background FROM layouts WHERE is_default ORDER BY created_at LIMIT 1),
    '{"source": "dashboard"}'::jsonb
  );
  screen record;
BEGIN
  -- First the log, while each screen's switches still say what they were.
  FOR screen IN
    SELECT d.name, d.switches,
      COALESCE((SELECT l.idle_background FROM layouts l WHERE l.id = d.dashboard_id), default_bg) AS bg
    FROM displays d
    WHERE NOT (d.settings ? 'prism-screen-day')
    ORDER BY d.name
  LOOP
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(screen.switches) = 'array' THEN screen.switches ELSE '[]'::jsonb END) AS sw
      JOIN layouts l ON l.id::text = sw->>'dashboardId'
      WHERE pg_temp.prism_screen_day(l.idle_background, 0) IS DISTINCT FROM pg_temp.prism_screen_day(screen.bg, 0)
    ) THEN
      RAISE NOTICE '0057: screen "%" idled differently during a switch; it now idles as its normal dashboard', screen.name;
    END IF;
  END LOOP;

  UPDATE displays d SET
    settings = (d.settings - 'prism-screensaver-dim') || jsonb_build_object(
      'prism-screen-day',
      pg_temp.prism_screen_day(
        COALESCE((SELECT l.idle_background FROM layouts l WHERE l.id = d.dashboard_id), default_bg),
        pg_temp.prism_dim_level(d.settings->>'prism-screensaver-dim')
      )::text
    ),
    -- So each screen fetches its new day on its next heartbeat.
    settings_updated_at = now()
  WHERE NOT (d.settings ? 'prism-screen-day');

  INSERT INTO settings (key, value)
  SELECT 'screenStartingDay', pg_temp.prism_screen_day(default_bg, 0)
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'screenStartingDay');
END $$;
