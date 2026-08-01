-- 0020_meal_absolute_date.sql
--
-- Meals were keyed by (week_of, day_of_week) — a WEEK-RELATIVE identity. week_of
-- is startOfWeek(today, weekStartsOn), so toggling the "week starts on"
-- preference (Sunday <-> Monday) shifts every week boundary by a day, and the
-- stored meals no longer match the fetched week — the whole plan appears to
-- vanish (nothing is deleted; it's just unfindable). This adds an absolute
-- `date` so the week views can query a stable 7-day date range instead.
--
-- Backfill: a meal's real date is the single occurrence of its day-of-week
-- inside the [week_of, week_of + 6] window, independent of which weekday
-- week_of itself falls on. EXTRACT(DOW) is 0=Sunday..6=Saturday, matching the
-- day-name mapping below.
--
-- Idempotent (safe to re-run).

ALTER TABLE meals ADD COLUMN IF NOT EXISTS "date" date;

UPDATE meals
SET "date" = (
  week_of + (
    (
      (CASE day_of_week
         WHEN 'sunday'    THEN 0
         WHEN 'monday'    THEN 1
         WHEN 'tuesday'   THEN 2
         WHEN 'wednesday' THEN 3
         WHEN 'thursday'  THEN 4
         WHEN 'friday'    THEN 5
         WHEN 'saturday'  THEN 6
       END)
      - EXTRACT(DOW FROM week_of)::int + 7
    ) % 7
  ) * INTERVAL '1 day'
)::date
WHERE "date" IS NULL;

ALTER TABLE meals ALTER COLUMN "date" SET NOT NULL;

CREATE INDEX IF NOT EXISTS meals_date_idx ON meals ("date");
