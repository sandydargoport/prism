-- A member can sign in with a passcode (lowercase letters and numbers)
-- instead of a numeric PIN (#1197). Every existing member keeps a PIN.
--
-- Idempotent (safe to re-run).

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_kind varchar(16) DEFAULT 'digits' NOT NULL;
