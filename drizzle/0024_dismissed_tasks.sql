-- 0024_dismissed_tasks.sql
--
-- `dismissed_tasks` — tombstones for synced tasks the user deleted in Prism.
--
-- Task sync reconciles by comparing the remote list against local rows, and a
-- task present remotely with no local match is treated as newly created and
-- inserted. A delete in Prism was therefore undone on the next run, roughly
-- five minutes later, with nothing to explain it.
--
-- The delete now also removes the task from the provider, which handles the
-- ordinary case. A tombstone is still required, because the upstream delete
-- is best-effort and deliberately non-blocking:
--
--   * the provider call can fail — expired token, network, revoked access —
--     and the local delete proceeds anyway, matching how calendar behaves;
--   * a provider may not support deletion at all;
--   * the remote can lag, still listing the task on the next sync.
--
-- In each case the tombstone is what makes the deletion stick. Mirrors
-- `dismissed_events`, which exists for exactly these reasons on the calendar
-- side, and is keyed the same way: source + external id.
--
-- Rows are removed when the tombstone is no longer needed (the task is gone
-- from the remote), so this table stays small rather than growing forever.

CREATE TABLE IF NOT EXISTS dismissed_tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_source_id   uuid NOT NULL REFERENCES task_sources(id) ON DELETE CASCADE,
  external_task_id varchar(255) NOT NULL,
  created_at       timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dismissed_tasks_source_external_unique
  ON dismissed_tasks (task_source_id, external_task_id);
