#!/bin/sh
# Prism Backup Scheduler
# Runs backup immediately on start, then daily at the configured hour

BACKUP_HOUR=${BACKUP_HOUR:-3}  # Default: 3 AM

# Seed rclone's config into a writable location. The host file is mounted
# read-only at /etc/rclone/rclone.conf; copying it to rclone's default path
# (inside the container's own filesystem, not a bind mount) lets rclone
# atomically rename-replace it when it refreshes its OAuth token. Mounting the
# config file directly makes that rename fail with "device or resource busy".
if [ -f /etc/rclone/rclone.conf ]; then
  mkdir -p /root/.config/rclone
  cp /etc/rclone/rclone.conf /root/.config/rclone/rclone.conf
fi

echo "[$(date)] Backup scheduler started (daily at ${BACKUP_HOUR}:00)"

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
