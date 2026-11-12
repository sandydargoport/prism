-- 0045_calendar_display_rules.sql
--
-- Per-calendar display rules (#877): show as Busy, hide after a time of day,
-- birthdays as name and age. Null means none, as before.

ALTER TABLE calendar_sources ADD COLUMN IF NOT EXISTS display_rules jsonb;
