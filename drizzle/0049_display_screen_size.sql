-- 0049_display_screen_size.sql
--
-- Editing a screen from a phone (#1153). `screen_width` and `screen_height`
-- are the size the screen last reported in CSS pixels, so the phone can show
-- its dashboard at the same size and shape. `editing_at` is set while
-- someone edits the screen from another device and kept fresh by that
-- device, so the screen can say it is being edited; it counts only while
-- recent, so a phone that went away does not leave the note up.
--
-- Idempotent (safe to re-run).

ALTER TABLE displays ADD COLUMN IF NOT EXISTS screen_width integer;
ALTER TABLE displays ADD COLUMN IF NOT EXISTS screen_height integer;
ALTER TABLE displays ADD COLUMN IF NOT EXISTS editing_at timestamp;
