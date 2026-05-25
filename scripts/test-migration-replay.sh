#!/usr/bin/env bash
# ============================================================================
# Prism — Migration Replay Test
# ============================================================================
# Validates the schema's idempotency and migrate.js's resilience by:
#   A) Fresh install + replay     — running migrate.js twice against a freshly
#                                    initialized DB. Catches non-idempotent
#                                    CREATE / ALTER statements.
#   B) Recovery from partial state — simulating a prior interrupted migration
#                                    (tracking table exists but 0000_upgrade
#                                    entry missing) on a fresh-install DB,
#                                    and verifying the next migrate run
#                                    recovers cleanly.
#   C) Data preservation on replay — inserting realistic provider-shaped data
#                                    into tables a DML migration touches, then
#                                    forcing the migration to re-run (via
#                                    __prism_migrations DELETE), and verifying
#                                    the data round-trip is byte-identical.
#                                    Scenario B catches "errors on replay" but
#                                    can miss "succeeds but corrupts" — that
#                                    bit 0011 (provider_config columns wiped
#                                    to all-nulls on second run). C catches it.
#
# A "legacy install with only extensions" path does NOT exist in production —
# every install that ever ran the app already has the original schema in
# place. 0000_upgrade.sql is designed to ALTER on top of an existing schema,
# not build one from scratch. So we don't test that path here.
#
# Spins up an ephemeral postgres:15-alpine container on a random port,
# tears it down on exit. Does NOT touch the live prism-db.
#
# Usage:
#   bash scripts/test-migration-replay.sh
#
# Exit code 0 = all scenarios pass. Non-zero = a regression in idempotency
# or recovery behavior; investigate before merging.
# ============================================================================

set -euo pipefail

CONTAINER_NAME="prism-migration-test-$$"
TEST_PORT="$((5500 + RANDOM % 200))"
DB_PASS="test_migration_replay"
# Use Windows-style path on Git Bash (pwd -W) so Docker Desktop volume mounts
# resolve correctly. Falls back to plain pwd on Linux/macOS.
REPO_ROOT="$(pwd -W 2>/dev/null || pwd)"
INIT_DIR="${REPO_ROOT}/src/lib/db/init"
MIGRATE_SCRIPT="${REPO_ROOT}/scripts/migrate.js"

if [ ! -f "$MIGRATE_SCRIPT" ]; then
  echo "ERROR: $MIGRATE_SCRIPT not found — run from the repo root." >&2
  exit 1
fi

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

log() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

cleanup() {
  if [ -n "${CONTAINER_NAME:-}" ]; then
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm   "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

start_pg() {
  docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_USER=prism \
    -e POSTGRES_PASSWORD="$DB_PASS" \
    -e POSTGRES_DB=prism \
    -p "${TEST_PORT}:5432" \
    -v "${INIT_DIR}:/docker-entrypoint-initdb.d:ro" \
    postgres:15-alpine >/dev/null

  log "Waiting for postgres to accept connections + finish init scripts..."
  for _ in $(seq 1 60); do
    # Wait for init to complete: postgres restarts after init scripts run, so
    # we wait for the second "ready" state. A simple approach: query a known
    # post-init table.
    if docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -c "SELECT 1 FROM users LIMIT 1" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "ERROR: postgres never became ready (or init scripts never finished)" >&2
  docker logs "$CONTAINER_NAME" 2>&1 | tail -20 >&2
  exit 1
}

reset_pg() {
  # Tear down + restart fresh between scenarios so each run is independent.
  cleanup
  CONTAINER_NAME="prism-migration-test-$$-${RANDOM}"
  TEST_PORT="$((5500 + RANDOM % 200))"
}

run_migrate() {
  DATABASE_URL="postgresql://prism:${DB_PASS}@localhost:${TEST_PORT}/prism" \
    node "$MIGRATE_SCRIPT"
}

psql_exec() {
  docker exec -i "$CONTAINER_NAME" psql -U prism -d prism -v ON_ERROR_STOP=1 -c "$1"
}

# ----------------------------------------------------------------------------
# Scenario A: fresh install + replay
# ----------------------------------------------------------------------------
log "=== Scenario A: fresh install + replay ==="
start_pg

log "First migrate run (fresh install)..."
run_migrate

log "Second migrate run (replay — must be a no-op)..."
run_migrate

log "Scenario A: PASS"

# ----------------------------------------------------------------------------
# Scenario B: recovery from partial migration state
# Simulates: a prior run installed the schema and applied numbered migrations
# but was interrupted before recording its progress. Verifies that the next
# run picks up correctly without breaking on idempotency or missing-row errors.
# ----------------------------------------------------------------------------
reset_pg
log "=== Scenario B: recovery from partial migration state ==="
start_pg

log "Bring DB up to date once..."
run_migrate

log "Simulate prior failure: clear migration tracking but leave schema intact..."
psql_exec "DELETE FROM public.__prism_migrations;"

log "Next migrate run should re-apply idempotently with no errors..."
run_migrate

log "And replay still a no-op..."
run_migrate

log "Scenario B: PASS"

# ----------------------------------------------------------------------------
# Scenario C: data preservation on migration replay
# ----------------------------------------------------------------------------
# Insert one row per touched table BEFORE forcing a replay, then snapshot
# the row's contents, replay, and diff. A migration that ALTER-only does
# DDL trivially passes; a migration that does DML (e.g. JSONB key shuffles
# like 0011) must hold the data invariant.
#
# Each added DML migration should append a row + snapshot pair here.
# ----------------------------------------------------------------------------
reset_pg
log "=== Scenario C: data preservation on migration replay ==="
start_pg

log "Bring DB up to date..."
run_migrate

log "Seed a realistic CalDAV calendar_source row (touched by 0011)..."
# Uses provider_config + a non-config sync_errors entry (lastError) to
# mirror the production shape post-migration. If 0011 re-runs and
# accidentally pulls from an empty sync_errors, it'd overwrite
# provider_config with nulls and the diff at the end would fail.
psql_exec "
INSERT INTO calendar_sources (
  provider, source_calendar_id, dashboard_calendar_name, display_name,
  color, access_token, enabled, show_in_event_modal,
  sync_errors, provider_config
) VALUES (
  'caldav',
  'https://caldav.example.com/calendars/test/',
  'Test',
  'Test',
  '#3B82F6',
  'fake-encrypted',
  true,
  false,
  '{\"lastError\": \"prior issue\", \"lastErrorAt\": \"2026-01-01T00:00:00Z\"}'::jsonb,
  '{\"username\": \"test@example.com\", \"serverUrl\": \"https://caldav.example.com\", \"authMethod\": \"basic\", \"supportsEvents\": true, \"supportsTasks\": false}'::jsonb
);
"

log "Snapshot provider_config + sync_errors before replay..."
BEFORE=$(docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -A -c \
  "SELECT provider_config::text || '|' || sync_errors::text FROM calendar_sources WHERE display_name = 'Test'")

log "Force a replay of every migration (clear tracking, intact schema + data)..."
psql_exec "DELETE FROM public.__prism_migrations;"

run_migrate

log "Snapshot after replay + diff..."
AFTER=$(docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -A -c \
  "SELECT provider_config::text || '|' || sync_errors::text FROM calendar_sources WHERE display_name = 'Test'")

if [ "$BEFORE" != "$AFTER" ]; then
  echo "ERROR: replay corrupted calendar_sources data" >&2
  echo "  BEFORE: $BEFORE" >&2
  echo "  AFTER:  $AFTER" >&2
  exit 1
fi

log "Scenario C: PASS"

# ----------------------------------------------------------------------------
echo
echo "=========================================="
echo "  All migration-replay scenarios passed"
echo "=========================================="
