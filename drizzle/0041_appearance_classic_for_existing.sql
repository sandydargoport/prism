-- 0041_appearance_classic_for_existing.sql
--
-- Prism 2.0 adds a household Appearance setting, Classic or 2.0 (#799). A
-- missing row means 2.0, which is what a new install should get. Every install
-- that already has people in it keeps the look it has today, so it is given an
-- explicit Classic row; the household can switch in Settings > Appearance.
--
-- A brand-new database runs this before its first user exists, so it inserts
-- nothing there and the new install starts on 2.0.

INSERT INTO settings (key, value)
SELECT 'appearance', '"classic"'::jsonb
WHERE EXISTS (SELECT 1 FROM users)
ON CONFLICT (key) DO NOTHING;
