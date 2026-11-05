-- 0042_photo_focal_point.sql
--
-- Where a photo's subject is (#956), as fractions of its width and height.
-- Found once in the browser; null until then, which reads as the centre.

ALTER TABLE photos ADD COLUMN IF NOT EXISTS focal_x real;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS focal_y real;
