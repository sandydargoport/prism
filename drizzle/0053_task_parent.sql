-- A task can be a subtask of another (#1200): Google Tasks subtasks and
-- Microsoft To Do steps are imported under their parent. Deleting the parent
-- deletes its subtasks, as Google does.
--
-- Idempotent (safe to re-run).

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_parent_id_tasks_id_fk') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_parent_id_tasks_id_fk
      FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tasks_parent_id_idx ON tasks USING btree (parent_id);
