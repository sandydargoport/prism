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
--      for every existing CalDAV row.
--   3. Strip those keys back out of sync_errors so the column carries
--      only error state going forward.
--
-- Backward compat: reads that check `sync_errors->>'serverUrl'` etc.
-- still work after the migration runs because the migration is the same
-- transaction that updates application code to read from provider_config.
-- (See PR feat/caldav-followups.)

ALTER TABLE calendar_sources
  ADD COLUMN IF NOT EXISTS provider_config jsonb;

-- Copy CalDAV config out of sync_errors → provider_config.
UPDATE calendar_sources
SET provider_config = jsonb_build_object(
  'serverUrl',                sync_errors->'serverUrl',
  'username',                 sync_errors->'username',
  'authMethod',               sync_errors->'authMethod',
  'supportsEvents',           sync_errors->'supportsEvents',
  'supportsTasks',            sync_errors->'supportsTasks',
  'taskListId',               sync_errors->'taskListId',
  'contactBirthdaysEnabled',  sync_errors->'contactBirthdaysEnabled'
) - 'serverUrl' || jsonb_strip_nulls(
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
  AND sync_errors IS NOT NULL;

-- Remove the migrated keys from sync_errors so the column carries only
-- error state. (PostgreSQL doesn't have a multi-key jsonb subtraction,
-- so chain `-` operators.)
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
  AND sync_errors IS NOT NULL;
