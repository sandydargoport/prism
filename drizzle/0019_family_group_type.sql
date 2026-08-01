-- 0019_family_group_type.sql
--
-- The shared "Family" calendar group is auto-seeded (seedDefaultGroups) and is
-- system-managed — it should never be deletable or renamable, just like the
-- per-member 'user' groups. It was previously created with the generic 'custom'
-- type, which lumped it in with user-created groups: the settings UI showed it a
-- "Custom" badge and a delete button, and deleting it just respawned it on the
-- next calendar load.
--
-- Reclassify the auto-seeded Family aggregate to a dedicated 'family' system
-- type. Scoped to the seed's exact shape (name 'Family', no linked user) so a
-- user's own custom group that happens to be named "Family" is left alone.
--
-- Idempotent (safe to re-run — a no-op once converted).

UPDATE calendar_groups
SET type = 'family'
WHERE type = 'custom'
  AND name = 'Family'
  AND user_id IS NULL;
