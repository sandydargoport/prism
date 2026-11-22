-- 0056_screen_switches.sql
--
-- A screen shows one dashboard and switches to another for a while, at bus
-- time or at set times (#1282). This replaces the timeline the screen
-- followed (#1266): each screen takes its timeline's dashboard (null is the
-- household default) and that timeline's placements as set-times switches,
-- first twelve, in order, so it shows the same thing at every moment as it
-- did before. A screen that picked no timeline, or one since deleted, takes
-- the household's first.
--
-- `displays.timeline_id` and the `timelines` table stay, unread, so a
-- rollback finds them. `dashboard_id` keeps its foreign key from 0038: a
-- deleted dashboard sends the screen back to the default.
--
-- Runs once: only when the column is being added. Idempotent (safe to re-run).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'displays'
        AND column_name = 'switches') THEN
    ALTER TABLE displays ADD COLUMN switches jsonb DEFAULT '[]'::jsonb NOT NULL;

    IF to_regclass('timelines') IS NOT NULL
      AND EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'displays'
          AND column_name = 'timeline_id') THEN
      UPDATE displays d SET
        dashboard_id = t.dashboard_id,
        switches = COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'when', 'times',
            'days', p.value->'days',
            'from', p.value->'from',
            'to', p.value->'to',
            'dashboardId', p.value->'dashboardId'
          ) ORDER BY p.ordinality)
          FROM jsonb_array_elements(t.placements) WITH ORDINALITY AS p
          WHERE p.ordinality <= 12
        ), '[]'::jsonb)
      FROM timelines t
      WHERE t.id = COALESCE(
        (SELECT own.id FROM timelines own WHERE own.id = d.timeline_id),
        (SELECT first.id FROM timelines first ORDER BY first.position, first.created_at LIMIT 1)
      );
    END IF;
  END IF;
END $$;
