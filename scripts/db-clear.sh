#!/bin/sh
# ============================================================================
# PRISM - Database Clear Script
# ============================================================================
#
# Clears user-created data from the database while preserving the schema.
#
# Usage:
#   ./scripts/db-clear.sh              # Clear all data including users
#   ./scripts/db-clear.sh --keep-users # Clear data but keep family members
#
# WARNING: This is destructive! Backup first:
#   pg_dump -U prism prism > backup.sql
#
# ============================================================================

set -e

KEEP_USERS=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --keep-users)
      KEEP_USERS=true
      shift
      ;;
  esac
done

echo ""
echo "🗑️  PRISM Database Clear"
echo "=================================================="

if [ "$KEEP_USERS" = true ]; then
  echo "Mode: Clearing data but KEEPING family members"
else
  echo "Mode: Clearing ALL data including family members"
fi
echo ""

# Tables to clear (order matters for foreign keys)
# Using CASCADE handles any remaining FK constraints

psql -U prism -d prism << 'EOF'
-- Goal-related
TRUNCATE TABLE goal_achievements CASCADE;
TRUNCATE TABLE goals CASCADE;

-- Photo-related
TRUNCATE TABLE photos CASCADE;
TRUNCATE TABLE photo_sources CASCADE;

-- Chore-related
TRUNCATE TABLE chore_completions CASCADE;
TRUNCATE TABLE chores CASCADE;

-- Maintenance-related
TRUNCATE TABLE maintenance_completions CASCADE;
TRUNCATE TABLE maintenance_reminders CASCADE;

-- Shopping-related
TRUNCATE TABLE shopping_items CASCADE;
TRUNCATE TABLE shopping_lists CASCADE;

-- Other user content
TRUNCATE TABLE meals CASCADE;
TRUNCATE TABLE family_messages CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE birthdays CASCADE;
TRUNCATE TABLE events CASCADE;
TRUNCATE TABLE layouts CASCADE;

-- Calendar-related
TRUNCATE TABLE calendar_sources CASCADE;
TRUNCATE TABLE calendar_groups CASCADE;

-- Settings and credentials
TRUNCATE TABLE settings CASCADE;
TRUNCATE TABLE api_credentials CASCADE;
EOF

echo "  ✓ Cleared all content tables"

# Clear users if not keeping them
if [ "$KEEP_USERS" = false ]; then
  psql -U prism -d prism -c "TRUNCATE TABLE users CASCADE;"
  echo "  ✓ Cleared users table"
fi

echo ""
echo "=================================================="
echo "✅ Database cleared!"

if [ "$KEEP_USERS" = true ]; then
  echo ""
  echo "💡 Family members were preserved."
  echo "   Run seed to add sample data:"
  echo "   docker exec prism-db psql -U prism -d prism -f /docker-entrypoint-initdb.d/seed.sql"
else
  echo ""
  echo "💡 All data cleared including users."
  echo "   Run seed to create sample family and data."
fi
echo ""
