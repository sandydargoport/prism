-- 0047_chore_kind.sql
--
-- A reminder (#1109) is a chore with a time and no points or approval.
-- Every existing row is a chore.

ALTER TABLE chores ADD COLUMN IF NOT EXISTS kind varchar(20) NOT NULL DEFAULT 'chore';
