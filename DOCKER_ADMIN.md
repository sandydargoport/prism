# Prism Docker Administration Guide

This guide covers common administrative tasks for managing your Prism installation.

## Prerequisites

Make sure Prism is running:
```bash
docker-compose up -d
```

## Database Backup & Restore

### Create a Backup

**Always backup before any destructive operation!**

```bash
# Full database backup (recommended before any changes)
docker exec prism-db pg_dump -U prism prism > backup_$(date +%Y%m%d_%H%M%S).sql

# Or with a custom filename
docker exec prism-db pg_dump -U prism prism > my_backup.sql
```

### Restore from Backup

```bash
# Restore a backup (this will overwrite current data!)
docker exec -i prism-db psql -U prism prism < backup_20260205_120000.sql
```

## Data Management

### Load Sample/Demo Data

Populates the database with sample family members and demo data:

```bash
docker exec prism-app npm run db:seed
```

This creates:
- Sample family members (Alex, Jamie, Emma, Sophie) with PIN "1234"
- Sample tasks, chores, events, meals, shopping lists
- Sample goals and birthdays

### Clear All Data

**⚠️ WARNING: This is destructive and cannot be undone! Backup first!**

```bash
# Backup first!
docker exec prism-db pg_dump -U prism prism > backup_before_clear.sql

# Clear all content but KEEP family members
docker exec prism-db psql -U prism -d prism -c "
  TRUNCATE TABLE goal_achievements, goals, photos, photo_sources,
    chore_completions, chores, maintenance_completions, maintenance_reminders,
    shopping_items, shopping_lists, meals, family_messages, tasks, birthdays,
    events, layouts, calendar_sources, calendar_groups, settings, api_credentials
  CASCADE;
"

# Clear EVERYTHING including users (full reset)
docker exec prism-db psql -U prism -d prism -c "
  TRUNCATE TABLE goal_achievements, goals, photos, photo_sources,
    chore_completions, chores, maintenance_completions, maintenance_reminders,
    shopping_items, shopping_lists, meals, family_messages, tasks, birthdays,
    events, layouts, calendar_sources, calendar_groups, settings, api_credentials,
    users
  CASCADE;
"
```

### Fresh Start Workflow

To completely reset and start fresh:

```bash
# 1. Backup current data (just in case)
docker exec prism-db pg_dump -U prism prism > backup_before_reset.sql

# 2. Clear all data including users
docker exec prism-db psql -U prism -d prism -c "
  TRUNCATE TABLE goal_achievements, goals, photos, photo_sources,
    chore_completions, chores, maintenance_completions, maintenance_reminders,
    shopping_items, shopping_lists, meals, family_messages, tasks, birthdays,
    events, layouts, calendar_sources, calendar_groups, settings, api_credentials,
    users
  CASCADE;
"

# 3. Load demo data
docker exec prism-app npm run db:seed
```

## Container Management

### View Logs

```bash
# All containers
docker-compose logs -f

# Just the app
docker logs prism-app -f --tail 100

# Just the database
docker logs prism-db -f --tail 100
```

### Restart Services

```bash
# Restart everything
docker-compose restart

# Restart just the app
docker-compose restart app

# Full rebuild (after code changes)
docker-compose build --no-cache app && docker-compose up -d
```

### Stop and Remove

```bash
# Stop containers (keeps data)
docker-compose down

# Stop and remove volumes (DESTROYS ALL DATA!)
docker-compose down -v
```

## Database Access

### Direct SQL Access

```bash
# Interactive PostgreSQL shell
docker exec -it prism-db psql -U prism -d prism

# Run a single query
docker exec prism-db psql -U prism -d prism -c "SELECT * FROM users;"
```

### Useful Queries

```bash
# Count records in each table
docker exec prism-db psql -U prism -d prism -c "
  SELECT 'users' as table_name, COUNT(*) FROM users
  UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
  UNION ALL SELECT 'chores', COUNT(*) FROM chores
  UNION ALL SELECT 'events', COUNT(*) FROM events
  UNION ALL SELECT 'meals', COUNT(*) FROM meals;
"

# List all family members
docker exec prism-db psql -U prism -d prism -c "SELECT id, name, role, color FROM users;"

# Check chore completions
docker exec prism-db psql -U prism -d prism -c "
  SELECT u.name, COUNT(*) as completions, SUM(cc.points_awarded) as points
  FROM chore_completions cc
  JOIN users u ON cc.completed_by = u.id
  WHERE cc.approved_by IS NOT NULL
  GROUP BY u.name;
"
```

## Redis Cache

### Clear Cache

```bash
# Clear all cached data
docker exec prism-redis redis-cli FLUSHALL
```

### Check Cache Status

```bash
# Interactive Redis CLI
docker exec -it prism-redis redis-cli

# Check memory usage
docker exec prism-redis redis-cli INFO memory
```

## Troubleshooting

### App Won't Start

```bash
# Check logs for errors
docker logs prism-app --tail 50

# Verify database is healthy
docker exec prism-db pg_isready -U prism

# Verify Redis is healthy
docker exec prism-redis redis-cli ping
```

### Database Connection Issues

```bash
# Test database connection
docker exec prism-app node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query('SELECT NOW()').then(r => console.log('Connected:', r.rows[0])).catch(console.error);
"
```

### Reset Everything

Nuclear option - completely destroys and recreates everything:

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Rebuild and start
docker-compose build --no-cache
docker-compose up -d

# Wait for database to be ready, then seed
sleep 10
docker exec prism-app npm run db:seed
```

## Environment Variables

Key environment variables (set in `.env` or `docker-compose.yml`):

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Set in docker-compose |
| `REDIS_URL` | Redis connection string | Set in docker-compose |
| `ENCRYPTION_KEY` | 64-char hex for token encryption | Must be set |
| `BASE_URL` | Public URL for OAuth callbacks | `http://localhost:3000` |

---

*Last updated: February 2026*
