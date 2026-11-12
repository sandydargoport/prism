-- 0050_retire_calendar_view.sql
--
-- The Calendar ready-made dashboard is retired (#1154). One already saved
-- becomes a regular dashboard: the same widgets, which already carry grid
-- positions, drawn on the grid. Today and grid dashboards are left alone.
--
-- Idempotent (safe to re-run): once no row has the view, it does nothing.

UPDATE layouts SET view = 'grid', updated_at = now() WHERE view = 'calendar';
