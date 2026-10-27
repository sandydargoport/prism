-- 0038_display_settings.sql
--
-- Per-screen settings (#690, part 2). A named screen keeps its own copy of the
-- settings that belong to the screen rather than the household (screensaver,
-- performance mode, keyboard, orientation and the like) in `settings`, keyed
-- by the browser storage key each one already uses, so it survives a browser
-- reset and can be edited from another device. `settings_updated_at` tells the
-- screen when to pick up an edit made elsewhere.
--
-- `dashboard_id` is the dashboard this screen opens on; null means the
-- household default, as before.
--
-- Idempotent (safe to re-run).

ALTER TABLE displays ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE displays ADD COLUMN IF NOT EXISTS settings_updated_at timestamp;
ALTER TABLE displays ADD COLUMN IF NOT EXISTS dashboard_id uuid;

-- Added on its own, so a fresh install (whose base schema already has the
-- column) gets the constraint too.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'displays_dashboard_id_fkey') THEN
    ALTER TABLE displays ADD CONSTRAINT displays_dashboard_id_fkey
      FOREIGN KEY (dashboard_id) REFERENCES layouts(id) ON DELETE SET NULL;
  END IF;
END $$;
