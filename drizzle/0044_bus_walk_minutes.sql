-- 0044_bus_walk_minutes.sql
--
-- Minutes to walk to the bus stop, per route (#900), for a leave-by line in
-- Now & Next. 0 means no leave-by line, as before.

ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS walk_minutes integer NOT NULL DEFAULT 0;
