-- 0011_calendar_provider_config.sql
--
-- Adds `provider_config` JSONB to `calendar_sources`. Historically the
-- `sync_errors` column was being overloaded to hold both:
--   (a) error state — { needsReauth, lastError, timestamp }
--   (b) connection config — { serverUrl, username, supportsEvents,
--       supportsTasks, taskListId, contactBirthdaysEnabled }
-- That worked but was semantically muddy: an error-handler that
-- overwrote the column would lose connection config; a sync writer
-- that updated config would smother any in-flight error state.
--
-- The migration:
--   1. Add the new column.
--   2. Copy the config-shaped keys out of sync_errors into provider_config
--      for every existing CalDAV row that hasn't already been migrated.
--   3. Strip those keys back out of sync_errors so the column carries
--      only error state going forward.
--
-- Idempotency: both UPDATEs guard against re-running over already-migrated
-- rows. The first version of this migration (shipped briefly before this
-- amendment) lacked the guards and, when applied twice in a row, blanked
-- out provider_config because the second run pulled from an already-empty
-- sync_errors. Fixed by gating on `provider_config IS NULL` and on the
-- presence of at least one of the config keys in sync_errors.

ALTER TABLE calendar_sources
  ADD COLUMN IF NOT EXISTS provider_config jsonb;

-- Copy CalDAV config out of sync_errors → provider_config.
UPDATE calendar_sources
SET provider_config = jsonb_strip_nulls(
  jsonb_build_object(
    'serverUrl',                sync_errors->'serverUrl',
    'username',                 sync_errors->'username',
    'authMethod',               sync_errors->'authMethod',
    'supportsEvents',           sync_errors->'supportsEvents',
    'supportsTasks',            sync_errors->'supportsTasks',
    'taskListId',               sync_errors->'taskListId',
    'contactBirthdaysEnabled',  sync_errors->'contactBirthdaysEnabled'
  )
)
WHERE provider = 'caldav'
  AND provider_config IS NULL
  AND sync_errors IS NOT NULL
  AND (
    sync_errors ? 'serverUrl' OR sync_errors ? 'username' OR
    sync_errors ? 'supportsEvents' OR sync_errors ? 'supportsTasks' OR
    sync_errors ? 'taskListId' OR sync_errors ? 'contactBirthdaysEnabled'
  );

-- Remove the migrated keys from sync_errors so the column carries only
-- error state. (PostgreSQL doesn't have a multi-key jsonb subtraction,
-- so chain `-` operators.) Idempotent: stripping keys that are already
-- absent is a no-op.
UPDATE calendar_sources
SET sync_errors = sync_errors
  - 'serverUrl'
  - 'username'
  - 'authMethod'
  - 'supportsEvents'
  - 'supportsTasks'
  - 'taskListId'
  - 'contactBirthdaysEnabled'
WHERE provider = 'caldav'
  AND sync_errors IS NOT NULL
  AND (
    sync_errors ? 'serverUrl' OR sync_errors ? 'username' OR
    sync_errors ? 'authMethod' OR sync_errors ? 'supportsEvents' OR
    sync_errors ? 'supportsTasks' OR sync_errors ? 'taskListId' OR
    sync_errors ? 'contactBirthdaysEnabled'
  );
