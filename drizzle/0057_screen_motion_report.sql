-- 0057_screen_motion_report.sql
--
-- What a screen reports about how it runs (#1289): the performance level it
-- actually runs at, and whether its browser asks for reduced motion. Either
-- turns its fireworks into a plain fade, and Settings > Screens says so.
-- Null until the screen next reports.
--
-- Idempotent (safe to re-run).

ALTER TABLE displays ADD COLUMN IF NOT EXISTS perf_level varchar(8);
ALTER TABLE displays ADD COLUMN IF NOT EXISTS reduced_motion boolean;
