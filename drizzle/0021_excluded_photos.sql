-- 0021_excluded_photos.sql
--
-- Tombstones for synced photos the user removed from Prism. Photo sources are a
-- one-way pull sync, so a plain delete would re-download the photo on the next
-- run. The sync skips any (source_id, external_id) recorded here, so
-- "remove from Prism" stays removed without ever touching OneDrive/Immich.
-- Only synced photos (with an external_id) are tombstoned; local uploads have
-- no remote to boomerang from.
--
-- Idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS excluded_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  source_id uuid NOT NULL,
  external_id varchar(255) NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

-- FK excluded_photos.source_id -> photo_sources.id (guarded).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'excluded_photos_source_id_photo_sources_id_fk'
      AND table_name = 'excluded_photos'
  ) THEN
    ALTER TABLE excluded_photos
      ADD CONSTRAINT excluded_photos_source_id_photo_sources_id_fk
      FOREIGN KEY (source_id) REFERENCES photo_sources(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS excluded_photos_source_external_unique
  ON excluded_photos (source_id, external_id);
