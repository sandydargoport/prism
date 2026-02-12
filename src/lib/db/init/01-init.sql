CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

SET timezone = 'UTC';

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    RAISE NOTICE '
================================================================================
PRISM Database Initialization Complete
================================================================================
Extensions enabled:
  - uuid-ossp (UUID generation)
  - pg_trgm (fuzzy text search)

Functions created:
  - update_updated_at_column() (auto-update timestamps)

Next steps:
  - 02-schema.sql will create tables
  - 03-seed.sql will load demo data

================================================================================
';
END $$;
