-- 0037_displays.sql
--
-- Display registry (#690): one row per screen a parent has named. The screen's
-- browser carries a signed cookie holding the row's id, so settings can later
-- be stored per screen and edited from another device. A browser nobody named
-- has no row and works exactly as before.
--
-- Idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS displays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name varchar(60) NOT NULL,
  last_seen_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
