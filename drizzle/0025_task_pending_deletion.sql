-- 0025_task_pending_deletion.sql
--
-- Hold remote-side task deletions for review, instead of applying them silently.
--
-- The reconciler deleted any synced local task the remote no longer listed.
-- That is unrecoverable and unattributable: a provider returning a short or
-- empty list — an outage, a revoked scope, the wrong list id — wiped every
-- synced task locally, with no undo and nothing said. Calendar already holds
-- these for review (events.pending_deletion, issue #171 Stage 3); this is the
-- same idea for tasks.
--
-- 1. `pending_deletion` — when set, the remote dropped this task and the
--    deletion is awaiting the user's decision. The task stays visible.
--
-- 2. `sync_exempt` — set when the user answers "keep": the task stays in Prism
--    as a local one. Detaching alone is NOT enough. The reconciler pushes any
--    local task in a synced list that has no external id to the provider
--    (sync/route.ts, the createTask branch), so a kept task would be recreated
--    on the remote it was just deleted from, and the round trip would start
--    again. This flag keeps it out of the reconciler's local set entirely.
--
--    It also covers a case that predates this change: task_source_id is
--    ON DELETE SET NULL, so removing a source detaches its tasks and leaves
--    them eligible for that same push.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pending_deletion timestamp;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sync_exempt boolean NOT NULL DEFAULT false;

-- Only ever a handful of rows, but the reconciler and the review both filter
-- on it on every run.
CREATE INDEX IF NOT EXISTS tasks_pending_deletion_idx
  ON tasks (pending_deletion) WHERE pending_deletion IS NOT NULL;
