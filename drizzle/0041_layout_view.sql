-- 0041_layout_view.sql
--
-- How a dashboard is drawn (#907): 'grid', the widget grid every layout has
-- used so far, or 'today', the front page drawn as one scene over the photo.
-- Every existing layout is a grid, which the default keeps.

ALTER TABLE layouts ADD COLUMN IF NOT EXISTS view varchar(20) NOT NULL DEFAULT 'grid';
