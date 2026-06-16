#!/bin/sh
# Prism Database Backup Script
# Runs inside the backup container, dumps PostgreSQL to /backups volume
# Optionally syncs to cloud storage via rclone

set -e

BACKUP_DIR="/backups"
RETENTION_DAYS=${RETENTION_DAYS:-7}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/prism_$TIMESTAMP.sql.gz"

# Healthcheck ping helper. HC_URL is optional; no-op if unset or curl missing.
# Suffix "" = success, "/start" = job started, "/fail" = job failed.
ping_hc() {
  [ -n "${HC_URL:-}" ] || return 0
  command -v curl >/dev/null 2>&1 || return 0
  curl -fsS -m 10 --retry 3 "${HC_URL}$1" >/dev/null 2>&1 || true
}

echo "[$(date)] Starting backup..."
ping_hc /start

# Create backup with compression
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h db \
  -U prism \
  -d prism \
  --no-owner \
  --no-acl \
  | gzip > "$BACKUP_FILE"

# Check if backup was created successfully and is plausibly non-empty.
# A valid gzipped dump of an initialised schema is comfortably over 10KB; a
# smaller file means pg_dump errored out mid-stream.
if [ -f "$BACKUP_FILE" ] && [ "$(stat -c%s "$BACKUP_FILE")" -gt 10000 ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup completed: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date)] ERROR: Backup failed or too small!"
  ping_hc /fail
  exit 1
fi

# Remove backups older than retention period
echo "[$(date)] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "prism_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# List current backups
echo "[$(date)] Current backups:"
ls -lh "$BACKUP_DIR"/prism_*.sql.gz 2>/dev/null || echo "  (none)"

# Off-site backup via rclone (if configured)
SYNC_FAILED=0
if [ -n "$RCLONE_REMOTE" ] && command -v rclone >/dev/null 2>&1; then
  echo "[$(date)] Syncing database backup to off-site storage: $RCLONE_REMOTE..."
  if rclone copy "$BACKUP_FILE" "$RCLONE_REMOTE" --progress; then
    echo "[$(date)] Database backup sync completed successfully"

    # Clean up old remote backups too
    if [ -n "$RCLONE_RETENTION_DAYS" ]; then
      echo "[$(date)] Cleaning remote backups older than $RCLONE_RETENTION_DAYS days..."
      rclone delete "$RCLONE_REMOTE" --min-age "${RCLONE_RETENTION_DAYS}d" 2>/dev/null || true
    fi
  else
    echo "[$(date)] WARNING: Database backup off-site sync failed!"
    SYNC_FAILED=1
  fi

  # Sync user file assets: avatars, uploaded photos, recipe images. These all
  # live under data/ (see src/lib/config/runtime.ts), NOT uploads/. The photo
  # cache (data/photos/cache) is regenerable on demand, so it is excluded.
  DATA_REMOTE="${RCLONE_REMOTE%/*}/data"
  if [ -d "/data" ] && [ "$(ls -A /data 2>/dev/null)" ]; then
    echo "[$(date)] Syncing data directory to off-site storage: $DATA_REMOTE..."
    if rclone sync /data "$DATA_REMOTE" --exclude 'photos/cache/**' --progress; then
      echo "[$(date)] Data sync completed successfully"
    else
      echo "[$(date)] WARNING: Data off-site sync failed!"
      SYNC_FAILED=1
    fi
  else
    echo "[$(date)] Data directory is empty or missing, skipping."
  fi

  # Verify the off-site copies actually landed intact before reporting success.
  # rclone copy/sync can exit 0 on a partial or silently-dropped upload, so
  # re-check hashes one-way: every local file must exist and match off-site.
  # This is what makes the healthcheck trustworthy — on the host VM-image
  # backup, a green ping once masked a real upload gap precisely because the
  # ping only proved the script finished, not that the bytes arrived.
  if [ "$SYNC_FAILED" -eq 0 ]; then
    echo "[$(date)] Verifying database backups are intact off-site..."
    if rclone check "$BACKUP_DIR" "$RCLONE_REMOTE" --one-way; then
      echo "[$(date)] Database off-site verify OK"
    else
      echo "[$(date)] WARNING: database off-site verify found differences!"
      SYNC_FAILED=1
    fi

    # Only verify assets when real files exist: empty subdirs don't get synced,
    # so the remote data/ dir may legitimately not exist yet. Same cache
    # exclusion as the sync, or the check would flag cache as missing off-site.
    if find /data -type f -not -path '*/cache/*' 2>/dev/null | grep -q .; then
      echo "[$(date)] Verifying data assets are intact off-site..."
      if rclone check /data "$DATA_REMOTE" --one-way --exclude 'photos/cache/**'; then
        echo "[$(date)] Data off-site verify OK"
      else
        echo "[$(date)] WARNING: data off-site verify found differences!"
        SYNC_FAILED=1
      fi
    fi
  fi
elif [ -n "$RCLONE_REMOTE" ]; then
  echo "[$(date)] WARNING: RCLONE_REMOTE set but rclone not installed"
fi

if [ "$SYNC_FAILED" -ne 0 ]; then
  echo "[$(date)] Backup completed locally but off-site sync had failures."
  ping_hc /fail
else
  echo "[$(date)] Backup process complete."
  ping_hc ""
fi
