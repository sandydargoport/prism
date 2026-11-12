-- The built-in dashboard is called Glance (#1187). It was Today, which read as
-- the date in a sentence. Only the built-in one (view 'today') that still has
-- the old name is renamed: one a household renamed keeps its own name, and a
-- grid dashboard someone called Today is theirs. The slug is left alone, so a
-- bookmarked /d/ link keeps working.
--
-- Idempotent (safe to re-run): once no built-in is named Today, it does nothing.

UPDATE layouts SET name = 'Glance', updated_at = now() WHERE view = 'today' AND name = 'Today';
