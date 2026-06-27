#!/usr/bin/env bash
# Prism HA addon entrypoint.
#
# Responsibilities, in order:
#   1. Read addon options from /data/options.json (HA injects this).
#   2. Generate + persist app secrets on first boot.
#   3. If bundled_db=true, initdb on first boot and start postgres + redis.
#      If bundled_db=false, expect DATABASE_URL + REDIS_URL set by user.
#   4. Apply base schema, run migrations.
#   5. Exec the Next.js server.
#
# Idempotent: a second boot finds existing secrets + initdb'd cluster
# and skips both. Persistent data lives under /data so addon updates
# never wipe the family's history.

set -euo pipefail

# ─── 0. Logging helpers ──────────────────────────────────────────────
log() { echo "[prism-ha] $*"; }
die() { echo "[prism-ha][fatal] $*" >&2; exit 1; }

OPTIONS=/data/options.json
SECRETS=/data/.prism_secrets
PG_DATA=/data/postgres
REDIS_DATA=/data/redis

[ -f "$OPTIONS" ] || die "Addon options.json not found — is this running under HA Supervisor?"

# bashio is HA's tiny helper for reading options, but to avoid the
# dependency we read JSON directly via jq. jq is part of base.
opt() { jq -r ".$1 // empty" "$OPTIONS"; }

LOG_LEVEL="$(opt log_level || echo info)"
BUNDLED_DB="$(opt bundled_db || echo true)"
EXTERNAL_DB_URL="$(opt database_url || echo '')"
EXTERNAL_REDIS_URL="$(opt redis_url || echo '')"
PHOTOS_ROOT="$(opt photos_root || echo /data/photos)"

log "log_level=$LOG_LEVEL bundled_db=$BUNDLED_DB photos_root=$PHOTOS_ROOT"

mkdir -p "$PHOTOS_ROOT"
export PRISM_PHOTO_ROOT="$PHOTOS_ROOT"

# ─── 1. App secrets (generated once, persisted) ──────────────────────
if [ ! -f "$SECRETS" ]; then
    log "Generating app secrets to $SECRETS (first boot)"
    {
        echo "SESSION_SECRET=$(openssl rand -hex 32)"
        echo "PIN_ENCRYPTION_KEY=$(openssl rand -hex 32)"
        echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
    } > "$SECRETS"
    chmod 600 "$SECRETS"
fi
# shellcheck disable=SC1090
. "$SECRETS"
export SESSION_SECRET PIN_ENCRYPTION_KEY ENCRYPTION_KEY

# ─── 2. Database (bundled or external) ───────────────────────────────
if [ "$BUNDLED_DB" = "true" ]; then
    PG_PASSWORD_FILE=/data/.prism_db_password

    # Alpine puts postgres binaries on PATH at /usr/bin (initdb, pg_ctl,
    # psql, createdb) under the `postgres` user, unlike Debian's
    # /usr/lib/postgresql/15/bin/ layout.
    if [ ! -d "$PG_DATA/base" ]; then
        log "Initializing bundled postgres cluster at $PG_DATA (first boot)"
        mkdir -p "$PG_DATA"
        chown -R postgres:postgres "$PG_DATA"
        sudo -u postgres initdb -D "$PG_DATA" --auth=trust --encoding=UTF8 --no-locale

        # Random password kept on the host volume; survives updates.
        openssl rand -hex 32 > "$PG_PASSWORD_FILE"
        chmod 600 "$PG_PASSWORD_FILE"
    fi

    # Postgres on Alpine defaults its Unix socket to /run/postgresql, which
    # does not exist in the container — and /run is a fresh tmpfs each boot,
    # so this must run every start, not just first boot. Without it pg_ctl
    # dies with: could not create lock file "/run/postgresql/.s.PGSQL.5432
    # .lock": No such file or directory. See issue #81.
    mkdir -p /run/postgresql
    chown postgres:postgres /run/postgresql

    log "Starting bundled postgres"
    # On failure, surface the server log — pg_ctl only says "could not start
    # server / Examine the log output", and set -e would otherwise kill the
    # script before anyone sees why.
    if ! sudo -u postgres pg_ctl -D "$PG_DATA" -l "$PG_DATA/postgres.log" -w start; then
        log "bundled postgres failed to start — dumping $PG_DATA/postgres.log:"
        cat "$PG_DATA/postgres.log" >&2 2>/dev/null || true
        die "bundled postgres did not start"
    fi

    PG_PASSWORD="$(cat "$PG_PASSWORD_FILE")"
    # Create role + database (idempotent: check existence first).
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='prism'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE ROLE prism LOGIN PASSWORD '$PG_PASSWORD'"
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='prism'" | grep -q 1 || \
        sudo -u postgres createdb -O prism prism

    export DATABASE_URL="postgresql://prism:${PG_PASSWORD}@127.0.0.1:5432/prism"

    log "Starting bundled redis"
    mkdir -p "$REDIS_DATA"
    redis-server --daemonize yes --dir "$REDIS_DATA" --bind 127.0.0.1 --port 6379
    export REDIS_URL="redis://127.0.0.1:6379"
else
    [ -n "$EXTERNAL_DB_URL" ] || die "bundled_db=false but database_url is empty"
    export DATABASE_URL="$EXTERNAL_DB_URL"
    if [ -n "$EXTERNAL_REDIS_URL" ]; then
        export REDIS_URL="$EXTERNAL_REDIS_URL"
    fi
fi

# ─── 3. Schema + migrations ──────────────────────────────────────────
# The base schema (02-schema.sql) is a full pg_dump and is NOT idempotent:
# its ADD CONSTRAINT statements have no IF NOT EXISTS and error out on a
# second apply. So run it only when the database has no schema yet —
# mirroring the standalone deploy, where Postgres' docker-entrypoint-initdb.d
# runs it exactly once. On every later boot, migrate.js (idempotent) brings
# the schema up to date. Detect "empty" by the absence of the migration
# bookkeeping table. Auth comes from DATABASE_URL (works for both the bundled
# trust-auth socket and an external password URL). See issue #81.
SCHEMA_PRESENT="$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.__prism_migrations') IS NOT NULL" 2>/dev/null || echo f)"
if [ "$SCHEMA_PRESENT" != "t" ]; then
    log "Fresh database — applying base schema"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/db-init/02-schema.sql
else
    log "Existing database — skipping base schema (migrate.js handles updates)"
fi

log "Running migrations"
cd /app && node scripts/migrate.js

# ─── 4. App ──────────────────────────────────────────────────────────
export PORT=3000
export HOSTNAME=0.0.0.0
log "Starting Next.js (PORT=$PORT)"
exec node /app/server.js
