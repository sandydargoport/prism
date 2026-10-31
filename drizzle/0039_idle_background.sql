-- 0039_idle_background.sql
--
-- What a dashboard shows behind it when idle (#782), replacing two settings:
-- the dashboard's screensaver_mode (calm or separate) and each screen's
-- background (photos, night sky, or photos by day and the sky after dark).
-- The background now lives with the dashboard, as JSON; see
-- src/lib/idleBackground.ts for the shape.
--
--   calm                              -> this dashboard
--   separate                          -> photos
--   separate, shown on a screen set to
--     photos by day, sky after dark   -> photos by day, sky after dark,
--                                        switching at sunset and sunrise
--     night sky                       -> night sky
--
-- A screen counts for the dashboard it opens on, or the household default.
-- Where screens on one dashboard disagree, day and night wins, then the sky.
-- A calm dashboard never showed the screen's background, so it stays calm.
-- Screens not saved under Settings > Displays keep their choice only in the
-- browser, which this cannot see; they show photos until someone picks again.
--
-- screensaver_mode is left in place, unread, so an older build still runs.
--
-- Runs once: only when the column is being added. Fresh installs already have
-- it from 02-schema.sql and skip this. Idempotent (safe to re-run).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'layouts'
        AND column_name = 'idle_background') THEN
    ALTER TABLE layouts ADD COLUMN idle_background jsonb;

    UPDATE layouts SET idle_background = CASE
      WHEN screensaver_mode = 'calm' THEN '{"source": "dashboard"}'::jsonb
      ELSE '{"source": "photos"}'::jsonb
    END;

    WITH fallback AS (
      SELECT id FROM layouts ORDER BY is_default DESC, created_at DESC LIMIT 1
    ), shown AS (
      SELECT COALESCE(d.dashboard_id, (SELECT id FROM fallback)) AS layout_id,
             d.settings->>'prism-screensaver-backdrop' AS backdrop
      FROM displays d
    ), picked AS (
      SELECT layout_id,
             CASE WHEN bool_or(backdrop = 'skyAtNight')
               THEN '{"day": "photos", "night": "sky", "switch": {"by": "sun", "duskOffset": 0, "dawnOffset": 0}}'::jsonb
               ELSE '{"source": "sky"}'::jsonb
             END AS bg
      FROM shown
      WHERE backdrop IN ('sky', 'skyAtNight')
      GROUP BY layout_id
    )
    UPDATE layouts l SET idle_background = p.bg
    FROM picked p
    WHERE l.id = p.layout_id AND l.screensaver_mode = 'separate';

    ALTER TABLE layouts ALTER COLUMN idle_background SET DEFAULT '{"source": "dashboard"}'::jsonb;
    ALTER TABLE layouts ALTER COLUMN idle_background SET NOT NULL;
  END IF;
END $$;
