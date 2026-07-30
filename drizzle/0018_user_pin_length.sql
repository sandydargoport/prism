-- 0018_user_pin_length.sql
--
-- Per-member PIN length. Previously PIN length was one family-wide setting
-- (`pinLength`), which caused lockouts whenever members wanted PINs of
-- different lengths — every pad enforced the same digit count for everyone.
-- This adds a `pin_length` column to `users` so each member's PIN pad
-- requires exactly *their* chosen length (4/5/6).
--
-- Backfill: existing users pick up whatever family-wide length was
-- configured (if the `pinLength` setting row exists), so their already-hashed
-- PIN keeps validating at the same digit count it was created with. If the
-- setting was never configured (or is malformed), the column default (4)
-- is left in place.
--
-- Idempotent (safe to re-run).

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_length integer DEFAULT 4 NOT NULL;

DO $$
DECLARE
  family_len integer;
BEGIN
  SELECT NULLIF(trim(both '"' from value::text), '')::integer INTO family_len
  FROM settings
  WHERE key = 'pinLength'
  LIMIT 1;

  IF family_len IS NOT NULL AND family_len BETWEEN 4 AND 6 THEN
    UPDATE users SET pin_length = family_len;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Malformed settings value — leave the column default (4) rather than
  -- fail the migration.
  NULL;
END $$;
