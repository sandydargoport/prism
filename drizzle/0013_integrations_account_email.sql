-- 0013_integrations_account_email.sql
--
-- Adds `account_email` to every integration source table so the
-- Integrations cards can show "Connected as <email>" per provider /
-- per-feature sub-section (issue #100).
--
-- The email is the OAuth account identity (id_token "email" claim /
-- provider userinfo), captured at token-exchange time. NULL-safe: existing
-- rows and non-OAuth sources (CalDAV basic-auth, local photo sources)
-- simply carry NULL and render without an email label. No backfill — the
-- email is populated on the next (re-)authentication.
--
-- Idempotent via ADD COLUMN IF NOT EXISTS.

ALTER TABLE calendar_sources      ADD COLUMN IF NOT EXISTS account_email varchar(320);
ALTER TABLE task_sources          ADD COLUMN IF NOT EXISTS account_email varchar(320);
ALTER TABLE shopping_list_sources ADD COLUMN IF NOT EXISTS account_email varchar(320);
ALTER TABLE wish_item_sources     ADD COLUMN IF NOT EXISTS account_email varchar(320);
ALTER TABLE photo_sources         ADD COLUMN IF NOT EXISTS account_email varchar(320);
ALTER TABLE api_credentials       ADD COLUMN IF NOT EXISTS account_email varchar(320);
