-- Expand photo usage from (wallpaper, gallery, both, neither) to (wallpaper, gallery, screensaver, all, none)
-- Migrate existing data: 'both' -> 'all', 'neither' -> 'none'
UPDATE photos SET usage = 'all' WHERE usage = 'both';
UPDATE photos SET usage = 'none' WHERE usage = 'neither';
-- Change default
ALTER TABLE photos ALTER COLUMN usage SET DEFAULT 'all';
