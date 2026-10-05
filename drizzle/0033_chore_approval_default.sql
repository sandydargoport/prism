-- 0033_chore_approval_default.sql
--
-- The chore requiresApproval flag now decides approval (#597): a chore without
-- it is approved as soon as anyone completes it, a flagged one still waits for
-- a parent when a child completes it. Until now every child completion waited,
-- whatever the flag said, so every existing chore is flagged here and nothing
-- changes on upgrade. New chores are flagged by default too.
--
-- Runs its update once: the column default is flipped in the same block and
-- checked first, so a re-run does not re-flag chores a parent has since
-- unflagged. Fresh installs already have the true default and skip it.

DO $$
BEGIN
  IF (SELECT column_default FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'chores'
        AND column_name = 'requires_approval') = 'false' THEN
    UPDATE chores SET requires_approval = true WHERE requires_approval = false;
    ALTER TABLE chores ALTER COLUMN requires_approval SET DEFAULT true;
  END IF;
END $$;
