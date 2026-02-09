#!/bin/sh
# Prism Backup Scheduler
# Runs backup immediately on start, then daily at the configured hour

BACKUP_HOUR=${BACKUP_HOUR:-3}  # Default: 3 AM

echo "[$(date)] Backup scheduler started (daily at ${BACKUP_HOUR}:00)"

# Run initial backup on container start
echo "[$(date)] Running initial backup..."
/scripts/backup.sh

# Loop forever, running backup at the scheduled hour
while true; do
  CURRENT_HOUR=$(date +%H)

  if [ "$CURRENT_HOUR" -eq "$BACKUP_HOUR" ]; then
    /scripts/backup.sh
    # Sleep 1 hour to avoid running multiple times in the same hour
    sleep 3600
  else
    # Check every 15 minutes
    sleep 900
  fi
done
