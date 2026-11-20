-- 0054_timelines.sql
--
-- Timelines (#1266): a named plan for a screen's day, kept on its own. It
-- says which dashboard shows when, and how the screen rests and what it does
-- at night. A screen picks one; null (or a deleted one) is the household's
-- first, which every device follows until it picks another.
--
-- Starts fresh: the per-screen schedule setting and the per-dashboard rest
-- and night settings are left behind (never released). The first timeline
-- takes the default dashboard's idle background, so an install upgraded from
-- v1.30.1 keeps its calm or separate screensaver (0039 converted that onto
-- the dashboard). `layouts.idle_background` and `displays.dashboard_id` stay
-- in the database, unread, so a rollback finds them.
--
-- Idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS timelines (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  name character varying(60) NOT NULL,
  position integer DEFAULT 0 NOT NULL,
  dashboard_id uuid,
  placements jsonb DEFAULT '[]'::jsonb NOT NULL,
  idle_background jsonb DEFAULT '{"source": "dashboard"}'::jsonb NOT NULL,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timelines_dashboard_id_layouts_id_fk') THEN
    ALTER TABLE timelines ADD CONSTRAINT timelines_dashboard_id_layouts_id_fk
      FOREIGN KEY (dashboard_id) REFERENCES layouts(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO timelines (name, position, idle_background)
SELECT 'Main', 0, COALESCE(
  (SELECT idle_background FROM layouts WHERE is_default ORDER BY created_at LIMIT 1),
  '{"source": "dashboard"}'::jsonb
)
WHERE NOT EXISTS (SELECT 1 FROM timelines);

ALTER TABLE displays ADD COLUMN IF NOT EXISTS timeline_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'displays_timeline_id_timelines_id_fk') THEN
    ALTER TABLE displays ADD CONSTRAINT displays_timeline_id_timelines_id_fk
      FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE displays SET settings = settings - 'prism-screen-schedule' WHERE settings ? 'prism-screen-schedule';
