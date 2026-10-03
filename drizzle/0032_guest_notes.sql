-- 0032_guest_notes.sql
--
-- Notes from someone without an account (#497). While Babysitter Mode is on,
-- the sitter can leave a note on the Messages board. Such a row has no
-- author_id; guest_kind says who wrote it ('babysitter' for now) and
-- guest_name is the optional name they typed.
--
-- Idempotent (safe to re-run).

ALTER TABLE family_messages ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE family_messages ADD COLUMN IF NOT EXISTS guest_kind varchar(20);
ALTER TABLE family_messages ADD COLUMN IF NOT EXISTS guest_name varchar(40);
