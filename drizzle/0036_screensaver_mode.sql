-- 0036_screensaver_mode.sql
--
-- Calm mode (#691): a dashboard can be its own idle screen instead of having a
-- separate screensaver layout. Every dashboard that exists before this is
-- 'separate', so nothing changes on upgrade; dashboards created afterwards get
-- 'calm'.
--
-- The column is added with the 'separate' default, which fills every existing
-- row, and the default is then switched for new rows. Fresh installs already
-- have the column with the 'calm' default from 02-schema.sql and skip the add.
--
-- Idempotent (safe to re-run).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'layouts'
        AND column_name = 'screensaver_mode') THEN
    ALTER TABLE layouts ADD COLUMN screensaver_mode varchar(20) DEFAULT 'separate' NOT NULL;
  END IF;
  ALTER TABLE layouts ALTER COLUMN screensaver_mode SET DEFAULT 'calm';
END $$;
