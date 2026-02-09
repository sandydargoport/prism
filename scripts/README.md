# Prism Database Backup

Automated PostgreSQL backups with optional off-site sync to cloud storage.

## How It Works

- **Daily backups** at 3 AM (configurable via `BACKUP_HOUR`)
- **Initial backup** runs immediately when container starts
- **7-day retention** locally (configurable via `RETENTION_DAYS`)
- **Compressed** with gzip (~90% size reduction)
- Stored in `./backups/` directory on host

## Local Backups

Local backups work out of the box:

```bash
# Start backup container
docker-compose up -d backup

# Check backup logs
docker logs prism-backup

# List backups
ls -lh backups/

# Manual backup
docker exec prism-backup /scripts/backup.sh
```

## Off-Site Backups (Recommended)

Protect against hard drive failure by syncing to cloud storage.

### Step 1: Configure rclone

Run rclone config on your host machine to set up a remote:

```bash
# Install rclone (if not installed)
# Windows: winget install rclone
# Mac: brew install rclone
# Linux: curl https://rclone.org/install.sh | sudo bash

# Configure a remote (interactive)
rclone config

# Example: Set up OneDrive
# 1. Choose 'n' for new remote
# 2. Name it 'onedrive'
# 3. Choose 'Microsoft OneDrive'
# 4. Follow OAuth prompts
```

### Step 2: Copy config to Prism

```bash
# Copy your rclone config
cp ~/.config/rclone/rclone.conf ./config/rclone.conf
```

### Step 3: Enable in docker-compose.yml

Uncomment these lines in the backup service:

```yaml
environment:
  - RCLONE_REMOTE=onedrive:Prism/backups
  - RCLONE_RETENTION_DAYS=30
volumes:
  - ./config/rclone.conf:/root/.config/rclone/rclone.conf:ro
```

### Step 4: Restart backup container

```bash
docker-compose up -d --build backup
```

## Supported Cloud Providers

rclone supports 40+ providers including:
- **OneDrive** (you already use MS services)
- Google Drive
- Dropbox
- Amazon S3
- Backblaze B2
- SFTP/SSH servers

See: https://rclone.org/overview/

## Restoring from Backup

### From Local Backup

```bash
# Interactive restore (with confirmation)
docker exec -it prism-backup /scripts/restore.sh /backups/prism_20240101_030000.sql.gz

# Then restart the app
docker-compose restart app
```

### From Off-Site Backup

```bash
# Download from cloud first
rclone copy onedrive:Prism/backups/prism_20240101_030000.sql.gz ./backups/

# Then restore as above
docker exec -it prism-backup /scripts/restore.sh /backups/prism_20240101_030000.sql.gz
```

## Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_HOUR` | 3 | Hour to run daily backup (0-23) |
| `RETENTION_DAYS` | 7 | Days to keep local backups |
| `RCLONE_REMOTE` | (none) | rclone remote path (e.g., `onedrive:Prism/backups`) |
| `RCLONE_RETENTION_DAYS` | (none) | Days to keep remote backups |
