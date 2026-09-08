-- 0026_photo_orientation_backfill.sql
--
-- Give synced photos the orientation they should always have had.
--
-- `photos.orientation` drives the Photos page filter, and it was computed only
-- in the manual upload path. Neither the OneDrive nor the Immich sync set it,
-- so every synced photo landed with orientation NULL. The filter compares with
-- equality, so it silently matched nothing for those rows: on an instance whose
-- photos all arrive by sync, filtering by landscape or portrait returned an
-- empty page and there was no way to keep phone-shaped portraits out of a
-- landscape wallpaper rotation.
--
-- The sync paths now set orientation on insert. This backfills what is already
-- in the table. Width and height were always recorded, so this is pure
-- arithmetic on data we hold: no re-sync, no provider calls, no file reads.
--
-- Rows with a missing dimension keep NULL, which is the honest value for
-- "unknown" and is what the helper returns for them too.

UPDATE photos
SET orientation = CASE
  WHEN width > height THEN 'landscape'
  WHEN height > width THEN 'portrait'
  ELSE 'square'
END
WHERE orientation IS NULL
  AND width IS NOT NULL
  AND height IS NOT NULL;
