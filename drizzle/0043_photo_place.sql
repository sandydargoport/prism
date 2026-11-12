-- 0043_photo_place.sql
--
-- The place a photo was taken, as a short name, looked up once from its
-- coordinates when a parent turns on "Show where photos were taken" (#958).
-- place_looked_up records that the lookup ran, so a photo with no nameable
-- place is not asked about again.

ALTER TABLE photos ADD COLUMN IF NOT EXISTS place_name varchar(120);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS place_looked_up boolean NOT NULL DEFAULT false;
