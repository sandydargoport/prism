#!/bin/sh
# ============================================================================
# PRISM - Demo Reset Script
# ============================================================================
#
# Wipes all user-modifiable data from the demo database and reseeds it from
# the canonical 03-seed.sql. Designed to run nightly via cron on the demo
# host so visitors always start from a known-good state.
#
# Usage (from demo host):
#   /opt/prism/scripts/demo-reset.sh
#
# Cron example (midnight UTC nightly):
#   0 0 * * * /opt/prism/scripts/demo-reset.sh >> /var/log/prism-demo-reset.log 2>&1
#
# Assumes:
#   - The DEMO compose stack is running
#   - 03-seed.sql is mounted at /docker-entrypoint-initdb.d/03-seed.sql
#     (this is already true via docker-compose.yml volume mount)
#
# SAFETY
# ------
# This script TRUNCATES every user table and FLUSHES redis. It used to default
# to prism-db, prism-app and prism-redis, which are the PRODUCTION container
# names, while the header above invites you to run it from cron. Running it with
# no environment set destroyed the real instance, and a self-hoster following
# the usage line had no way to know.
#
# Two changes stop that. The defaults now name demo containers, which do not
# exist on a production host, so the honest failure is "no such container".
# And before anything is destroyed the target app container must declare
# itself a demo (DEMO_MODE=true). That check is the real gate: a name can be
# overridden by accident, but a production container cannot claim to be a demo.
#
# ============================================================================

set -e

DB_CONTAINER="${DB_CONTAINER:-prism-demo-db}"
APP_CONTAINER="${APP_CONTAINER:-prism-demo-app}"
REDIS_CONTAINER="${REDIS_CONTAINER:-prism-demo-redis}"

# Refuse to touch anything that is not a declared demo. Checked against the
# running container's own environment rather than its name, because the name is
# exactly what goes wrong.
if ! docker inspect "$APP_CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: app container '$APP_CONTAINER' not found." >&2
  echo "       This script only resets a DEMO stack. Set APP_CONTAINER," >&2
  echo "       DB_CONTAINER and REDIS_CONTAINER if yours are named differently." >&2
  exit 1
fi

if ! docker inspect "$APP_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
     | grep -qx 'DEMO_MODE=true'; then
  echo "ERROR: '$APP_CONTAINER' does not declare DEMO_MODE=true." >&2
  echo "       Refusing to truncate. This script wipes every user table and" >&2
  echo "       flushes redis; it must never run against a real instance." >&2
  exit 1
fi

echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] Demo reset starting"

# 1. Truncate every user-data table in public schema. Excludes the migration
#    bookkeeping table so Drizzle's idempotent migrations stay in sync.
docker exec "$DB_CONTAINER" psql -U prism -d prism <<'SQL'
DO $$
DECLARE
  truncate_list TEXT;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO truncate_list
    FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename NOT IN ('__prism_migrations');
  IF truncate_list IS NOT NULL THEN
    EXECUTE format('TRUNCATE TABLE %s RESTART IDENTITY CASCADE', truncate_list);
  END IF;
END $$;
SQL

echo "  - tables truncated"

# 2. Reapply seed (the seed has its own "skip if users exist" guard, but we
#    just truncated users so it will run).
docker exec "$DB_CONTAINER" psql -U prism -d prism -f /docker-entrypoint-initdb.d/03-seed.sql

echo "  - seed reapplied"

# 3. Flush Redis so cached responses don't leak across the reset boundary.
docker exec "$REDIS_CONTAINER" redis-cli FLUSHDB > /dev/null

echo "  - redis flushed"

echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] Demo reset complete"
