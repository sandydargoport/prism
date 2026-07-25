-- 0014_recipe_sources.sql
--
-- Recipe sync sources (Tandoor / Mealie) + sync-linkage columns on recipes,
-- for the review-and-approve recipe sync (issue #58, phase 2).
--
--  - recipe_sources: a connected recipe server. The API token is stored
--    encrypted at the app layer (AES-256-GCM via lib/utils/crypto).
--  - recipes.source_id / external_id / external_updated_at: link a synced
--    recipe to its source + remote id + remote last-modified time. All NULL
--    for locally-created recipes.
--  - recipes_source_external_unique: the upsert/match key. (NULL, NULL) local
--    rows never collide — Postgres treats NULLs as distinct in a unique index.
--
-- Idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS recipe_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  provider varchar(50) NOT NULL,
  name varchar(255),
  server_url text NOT NULL,
  access_token text,
  enabled boolean DEFAULT true NOT NULL,
  last_synced timestamp,
  sync_errors jsonb,
  provider_config jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS recipe_sources_enabled_idx ON recipe_sources (enabled);

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS external_id varchar(255);
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS external_updated_at timestamp;

-- FK recipes.source_id -> recipe_sources.id (guarded; ADD CONSTRAINT is not
-- IF NOT EXISTS-able directly).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'recipes_source_id_recipe_sources_id_fk'
      AND table_name = 'recipes'
  ) THEN
    ALTER TABLE recipes
      ADD CONSTRAINT recipes_source_id_recipe_sources_id_fk
      FOREIGN KEY (source_id) REFERENCES recipe_sources(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS recipes_source_external_unique
  ON recipes (source_id, external_id);
