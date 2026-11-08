-- 0046_chore_times_per_day.sql
--
-- A daily chore done more than once a day (#1107): it stays due today until
-- it has been ticked this many times today. 1 is once a day, as before.

ALTER TABLE chores ADD COLUMN IF NOT EXISTS times_per_day integer NOT NULL DEFAULT 1;
