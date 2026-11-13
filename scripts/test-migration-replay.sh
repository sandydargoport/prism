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
# Scenario D: 0033 flags existing chores once.
# An install from before 0033 has requires_approval DEFAULT false, and its
# chores must come out flagged. A chore a parent unflags afterwards must stay
# unflagged when the migrations replay.
# ----------------------------------------------------------------------------
log "=== Scenario D: 0033 flags existing chores once ==="

log "Simulate a pre-0033 install with one unflagged chore..."
psql_exec "
ALTER TABLE chores ALTER COLUMN requires_approval SET DEFAULT false;
INSERT INTO chores (title, category, frequency) VALUES ('Replay chore', 'other', 'daily');
DELETE FROM public.__prism_migrations;
"
run_migrate

FLAG=$(docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -A -c \
  "SELECT requires_approval FROM chores WHERE title = 'Replay chore'")
if [ "$FLAG" != "t" ]; then
  echo "ERROR: 0033 did not flag an existing chore (got '$FLAG')" >&2
  exit 1
fi

log "Unflag it, then replay every migration..."
psql_exec "
UPDATE chores SET requires_approval = false WHERE title = 'Replay chore';
DELETE FROM public.__prism_migrations;
"
run_migrate

FLAG=$(docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -A -c \
  "SELECT requires_approval FROM chores WHERE title = 'Replay chore'")
if [ "$FLAG" != "f" ]; then
  echo "ERROR: replaying 0033 re-flagged a chore that was unflagged (got '$FLAG')" >&2
  exit 1
fi

log "Scenario D: PASS"

# ----------------------------------------------------------------------------
# Scenario E: 0036 keeps existing dashboards on the separate screensaver.
# An install from before 0036 has no screensaver_mode column. Its dashboards
# must come out 'separate', a dashboard created afterwards must be 'calm', and
# a replay must not undo a mode someone has since picked.
# ----------------------------------------------------------------------------
log "=== Scenario E: 0036 existing dashboards stay separate ==="

layout_mode() {
  docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -A -c \
    "SELECT screensaver_mode FROM layouts WHERE name = '$1'"
}

log "Simulate a pre-0036 install with one dashboard..."
psql_exec "
ALTER TABLE layouts DROP COLUMN IF EXISTS screensaver_mode;
INSERT INTO layouts (name, widgets) VALUES ('Old dashboard', '[]'::jsonb);
DELETE FROM public.__prism_migrations;
"
run_migrate

psql_exec "INSERT INTO layouts (name, widgets) VALUES ('New dashboard', '[]'::jsonb);"
OLD=$(layout_mode 'Old dashboard')
NEW=$(layout_mode 'New dashboard')
if [ "$OLD" != "separate" ] || [ "$NEW" != "calm" ]; then
  echo "ERROR: 0036 gave old='$OLD' new='$NEW' (want separate, calm)" >&2
  exit 1
fi

log "Switch the old one to calm, then replay every migration..."
psql_exec "
UPDATE layouts SET screensaver_mode = 'calm' WHERE name = 'Old dashboard';
DELETE FROM public.__prism_migrations;
"
run_migrate
OLD=$(layout_mode 'Old dashboard')
if [ "$OLD" != "calm" ]; then
  echo "ERROR: replaying 0036 reset a picked mode (got '$OLD')" >&2
  exit 1
fi

log "Scenario E: PASS"

# ----------------------------------------------------------------------------
# Scenario F: 0039 moves the idle background onto the dashboard.
# An install from before 0039 has screensaver_mode on each dashboard and a
# background on each saved screen. Calm becomes this dashboard, separate
# becomes photos, and a separate dashboard shown on a screen set to the sky
# takes that screen's choice. A replay must not undo a background picked since.
# ----------------------------------------------------------------------------
log "=== Scenario F: 0039 idle background from mode + screen ==="

idle_bg() {
  docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -A -c \
    "SELECT idle_background::text FROM layouts WHERE name = '$1'"
}
expect_bg() {
  local got
  got=$(idle_bg "$1")
  if [ "$got" != "$2" ]; then
    echo "ERROR: 0039 gave '$1' = $got (want $2)" >&2
    exit 1
  fi
}

log "Simulate a pre-0039 install: four dashboards, three saved screens..."
psql_exec "
ALTER TABLE layouts DROP COLUMN IF EXISTS idle_background;
UPDATE layouts SET is_default = false;
INSERT INTO layouts (name, widgets, screensaver_mode) VALUES
  ('F calm', '[]'::jsonb, 'calm'),
  ('F photos', '[]'::jsonb, 'separate'),
  ('F night', '[]'::jsonb, 'separate'),
  ('F calm sky', '[]'::jsonb, 'calm');
INSERT INTO layouts (name, widgets, screensaver_mode, is_default) VALUES
  ('F default', '[]'::jsonb, 'separate', true);
INSERT INTO displays (name, settings, dashboard_id) VALUES
  ('Hall', '{\"prism-screensaver-backdrop\": \"skyAtNight\"}'::jsonb, (SELECT id FROM layouts WHERE name = 'F night')),
  ('Den', '{\"prism-screensaver-backdrop\": \"sky\"}'::jsonb, (SELECT id FROM layouts WHERE name = 'F night')),
  ('Porch', '{\"prism-screensaver-backdrop\": \"skyAtNight\"}'::jsonb, (SELECT id FROM layouts WHERE name = 'F calm sky')),
  ('Attic', '{\"prism-screensaver-backdrop\": \"sky\"}'::jsonb, NULL);
DELETE FROM public.__prism_migrations;
"
run_migrate

expect_bg 'F calm' '{"source": "dashboard"}'
expect_bg 'F photos' '{"source": "photos"}'
expect_bg 'F night' '{"day": "photos", "night": "sky", "switch": {"by": "sun", "dawnOffset": 0, "duskOffset": 0}}'
expect_bg 'F calm sky' '{"source": "dashboard"}'
expect_bg 'F default' '{"source": "sky"}'

psql_exec "INSERT INTO layouts (name, widgets) VALUES ('F new', '[]'::jsonb);"
expect_bg 'F new' '{"source": "dashboard"}'

log "Pick a new background for one, then replay every migration..."
psql_exec "
UPDATE layouts SET idle_background = '{\"source\": \"sky\"}'::jsonb WHERE name = 'F photos';
DELETE FROM public.__prism_migrations;
"
run_migrate
expect_bg 'F photos' '{"source": "sky"}'
expect_bg 'F night' '{"day": "photos", "night": "sky", "switch": {"by": "sun", "dawnOffset": 0, "duskOffset": 0}}'

log "Scenario F: PASS"

# ----------------------------------------------------------------------------
# Scenario G: 0050 retires the Calendar view.
# A dashboard saved as the Calendar ready-made layout becomes a regular grid
# dashboard with the same widgets. Today and grid dashboards are left alone.
# ----------------------------------------------------------------------------
log "=== Scenario G: 0050 Calendar view becomes a grid dashboard ==="

layout_view() {
  docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -A -c \
    "SELECT view || '|' || widgets::text FROM layouts WHERE name = '$1'"
}

psql_exec "
INSERT INTO layouts (name, widgets, view) VALUES
  ('G calendar', '[{\"i\": \"calendar\", \"x\": 0, \"y\": 5, \"w\": 32, \"h\": 22}]'::jsonb, 'calendar'),
  ('G today', '[{\"i\": \"clock\", \"x\": 0, \"y\": 0, \"w\": 12, \"h\": 5}]'::jsonb, 'today');
DELETE FROM public.__prism_migrations;
"
run_migrate
GOT=$(layout_view 'G calendar')
if [ "$GOT" != 'grid|[{"h": 22, "i": "calendar", "w": 32, "x": 0, "y": 5}]' ]; then
  echo "ERROR: 0050 gave the Calendar dashboard '$GOT' (want grid, same widgets)" >&2
  exit 1
fi
GOT=$(layout_view 'G today')
case "$GOT" in today\|*) ;; *) echo "ERROR: 0050 changed Today ('$GOT')" >&2; exit 1 ;; esac

log "Scenario G: PASS"

# ----------------------------------------------------------------------------
# Scenario H: a v1.30.1 install upgrades to what it showed (#1154).
# The database is built by v1.30.1 itself: its init schema and its own
# migrate.js, from the release tag. Its dashboards, as v1.30.1 saved them,
# then go through every migration since. Each must come out on the grid,
# resting over photos with the screensaver arrangement it had, the default
# still the default, and nothing added (no Today, no other dashboard).
# ----------------------------------------------------------------------------
reset_pg
log "=== Scenario H: v1.30.1 install upgrades to what it showed ==="

OLD_TAG="v1.30.1"
if ! git rev-parse -q --verify "refs/tags/$OLD_TAG" >/dev/null; then
  git fetch -q --depth 1 origin "refs/tags/$OLD_TAG:refs/tags/$OLD_TAG"
fi
OLD_DIR="$(mktemp -d)"
git archive "$OLD_TAG" src/lib/db/init drizzle scripts/migrate.js | tar -x -C "$OLD_DIR"

INIT_DIR_SAVED="$INIT_DIR"
INIT_DIR="$OLD_DIR/src/lib/db/init"
start_pg
INIT_DIR="$INIT_DIR_SAVED"

log "Bring it up to v1.30.1 with v1.30.1's own migrate.js..."
DATABASE_URL="postgresql://prism:${DB_PASS}@localhost:${TEST_PORT}/prism" \
  NODE_PATH="${REPO_ROOT}/node_modules" node "$OLD_DIR/scripts/migrate.js"

log "Two dashboards as v1.30.1 saved them: the default, edited (its screensaver saved), and one by link, never edited..."
psql_exec "
INSERT INTO layouts (name, slug, is_default, widgets, screensaver_widgets) VALUES
  ('H kitchen', 'kitchen', true,
   '[{\"i\": \"calendar\", \"x\": 0, \"y\": 0, \"w\": 32, \"h\": 27}, {\"i\": \"clock\", \"x\": 32, \"y\": 0, \"w\": 16, \"h\": 8}]'::jsonb,
   '[{\"i\": \"clock\", \"x\": 2, \"y\": 2, \"w\": 16, \"h\": 10, \"visible\": true}]'::jsonb),
  ('H hall', 'hall', false,
   '[{\"i\": \"weather\", \"x\": 0, \"y\": 0, \"w\": 24, \"h\": 24}]'::jsonb,
   NULL);
"
snapshot() {
  docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -A -c \
    "SELECT string_agg(name || '|' || COALESCE(slug, '') || '|' || is_default || '|' || widgets::text || '|' || COALESCE(screensaver_widgets::text, 'null'), E'\n' ORDER BY name) FROM layouts"
}
BEFORE=$(snapshot)

log "Upgrade with this checkout's migrate.js..."
run_migrate

AFTER=$(snapshot)
if [ "$BEFORE" != "$AFTER" ]; then
  echo "ERROR: the upgrade changed a v1.30.1 dashboard or added one" >&2
  echo "  BEFORE: $BEFORE" >&2
  echo "  AFTER:  $AFTER" >&2
  exit 1
fi
SHAPE=$(docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -A -c \
  "SELECT string_agg(name || '|' || view || '|' || idle_background::text, E'\n' ORDER BY name) FROM layouts")
WANT=$'H hall|grid|{"source": "photos"}\nH kitchen|grid|{"source": "photos"}'
if [ "$SHAPE" != "$WANT" ]; then
  echo "ERROR: upgraded dashboards are not grids resting over photos:" >&2
  echo "$SHAPE" >&2
  exit 1
fi
SCREENS=$(docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -A -c "SELECT count(*) FROM displays")
if [ "$SCREENS" != "0" ]; then
  echo "ERROR: the upgrade named a screen ($SCREENS)" >&2
  exit 1
fi

log "And a replay is a no-op on it..."
psql_exec "DELETE FROM public.__prism_migrations WHERE name <> '0000_upgrade';"
run_migrate
if [ "$(snapshot)" != "$BEFORE" ]; then
  echo "ERROR: replaying the migrations changed an upgraded dashboard" >&2
  exit 1
fi
rm -rf "$OLD_DIR"

log "Scenario H: PASS"

# ----------------------------------------------------------------------------
# Scenario I: 0051 names the built-in dashboard Glance (#1187).
# The built-in (view today) still called Today becomes Glance, with its slug
# kept. One the household renamed, and a grid dashboard someone called Today,
# keep their names. A replay changes nothing more.
# ----------------------------------------------------------------------------
log "=== Scenario I: 0051 Today becomes Glance ==="

psql_exec "
INSERT INTO layouts (name, slug, widgets, view) VALUES
  ('Today', 'today', '[]'::jsonb, 'today'),
  ('I mornings', 'i-mornings', '[]'::jsonb, 'today'),
  ('Today', 'i-grid-today', '[]'::jsonb, 'grid');
DELETE FROM public.__prism_migrations WHERE name <> '0000_upgrade';
"
run_migrate
names() {
  docker exec "$CONTAINER_NAME" psql -U prism -d prism -t -A -c \
    "SELECT string_agg(slug || '|' || view || '|' || name, E'\n' ORDER BY slug) FROM layouts WHERE slug IN ('today', 'i-mornings', 'i-grid-today')"
}
WANT=$'i-grid-today|grid|Today\ni-mornings|today|I mornings\ntoday|today|Glance'
GOT=$(names)
if [ "$GOT" != "$WANT" ]; then
  echo "ERROR: 0051 named the dashboards:" >&2
  echo "$GOT" >&2
  exit 1
fi
psql_exec "DELETE FROM public.__prism_migrations WHERE name <> '0000_upgrade';"
run_migrate
if [ "$(names)" != "$WANT" ]; then
  echo "ERROR: replaying 0051 changed the names again" >&2
  exit 1
fi

log "Scenario I: PASS"

# ----------------------------------------------------------------------------
echo
echo "=========================================="
echo "  All migration-replay scenarios passed"
echo "=========================================="
