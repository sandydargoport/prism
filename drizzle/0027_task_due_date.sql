-- 0027_task_due_date.sql
--
-- A task's due becomes a calendar date plus an optional wall-clock time, the
-- way a chore's next_due and next_due_time already are.
--
-- due_date was a timestamp, and each writer meant something different by it:
-- the add-task form stored UTC midnight of the chosen date, the edit form and
-- calendar drag stored a local wall time (23:59 for "no time"), Google Tasks
-- sent UTC midnight, and CalDAV stored midnight in the server's zone. Read
-- back with local getters, a task moved a day depending on who wrote it and
-- where it was read.
--
-- Existing values convert with the rules in src/lib/utils/taskDue.ts
-- (dueFromInstant):
--   exactly 00:00 UTC        -> that UTC date, no time (a date-only value)
--   otherwise                -> the wall date and time in the household zone,
--                               with 00:00 and 23:58 or later meaning no time
-- The household zone is the `timezone` setting; without a valid one, the zone
-- migrate.js runs in (prism.process_timezone), then UTC, which is also what
-- getHouseholdTimezone() falls back to.
--
-- Fresh installs get the date column from init/02-schema.sql, so the
-- conversion only runs while due_date is still a timestamp.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time varchar(5);

DO $$
DECLARE
  zone text;
BEGIN
  IF (
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date'
  ) = 'date' THEN
    RETURN;
  END IF;

  SELECT s.value #>> '{}' INTO zone
  FROM settings s
  WHERE s.key = 'timezone' AND jsonb_typeof(s.value) = 'string';

  IF zone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = zone) THEN
    zone := current_setting('prism.process_timezone', true);
  END IF;
  IF zone IS NULL OR zone = '' OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = zone) THEN
    zone := 'UTC';
  END IF;

  ALTER TABLE tasks ADD COLUMN due_on date;

  UPDATE tasks t
  SET due_on = w.wall::date,
      due_time = CASE
        WHEN w.date_only OR w.wall::time = '00:00' OR w.wall::time >= '23:58' THEN NULL
        ELSE to_char(w.wall, 'HH24:MI')
      END
  FROM (
    SELECT id,
           due_date::time = '00:00' AS date_only,
           CASE WHEN due_date::time = '00:00' THEN due_date
                ELSE (due_date AT TIME ZONE 'UTC') AT TIME ZONE zone
           END AS wall
    FROM tasks
    WHERE due_date IS NOT NULL
  ) w
  WHERE t.id = w.id;

  DROP INDEX IF EXISTS tasks_due_date_idx;
  ALTER TABLE tasks DROP COLUMN due_date;
  ALTER TABLE tasks RENAME COLUMN due_on TO due_date;
END $$;

CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks (due_date);
