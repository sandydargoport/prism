#!/bin/sh
# Prism Database Restore Script
# Usage: ./restore.sh <backup_file.sql.gz>
#
# Run from the host machine:
#   docker exec -i prism-db sh -c 'gunzip -c | psql -U prism -d prism' < backups/prism_20240101_030000.sql.gz
#
# Or use this script inside the backup container:
#   docker exec -it prism-backup /scripts/restore.sh /backups/prism_20240101_030000.sql.gz

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh /backups/prism_*.sql.gz 2>/dev/null || echo "  (none found)"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will overwrite the current database!"
echo "Backup file: $BACKUP_FILE"
echo ""
echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
sleep 5

echo "[$(date)] Starting restore from $BACKUP_FILE..."

# Drop and recreate database
PGPASSWORD="$POSTGRES_PASSWORD" psql -h db -U prism -d postgres -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'prism' AND pid <> pg_backend_pid();
"
PGPASSWORD="$POSTGRES_PASSWORD" psql -h db -U prism -d postgres -c "DROP DATABASE IF EXISTS prism;"
PGPASSWORD="$POSTGRES_PASSWORD" psql -h db -U prism -d postgres -c "CREATE DATABASE prism;"

# Restore from backup
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$POSTGRES_PASSWORD" psql -h db -U prism -d prism

echo "[$(date)] Restore completed successfully!"
echo ""
echo "IMPORTANT: Restart the app container to reconnect:"
echo "  docker-compose restart app"
