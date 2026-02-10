#!/bin/bash
# ============================================================================
# Prism - Fresh Install Test
# ============================================================================
# This script simulates a fresh install to verify the setup process works.
# WARNING: This will DELETE all existing Prism data!
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[Test]${NC} $1"; }
success() { echo -e "${GREEN}[Test]${NC} $1"; }
warn() { echo -e "${YELLOW}[Test]${NC} $1"; }
error() { echo -e "${RED}[Test]${NC} $1"; exit 1; }

# Confirm destructive action
if [ "$1" != "--yes" ]; then
    echo ""
    warn "This will DELETE all Prism containers, volumes, and .env file!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log "Aborted."
        exit 0
    fi
fi

# Detect docker compose command
if docker compose version &> /dev/null; then
    COMPOSE="docker compose"
else
    COMPOSE="docker-compose"
fi

echo ""
log "Starting fresh install test..."
echo ""

# Step 1: Clean up existing installation
log "Step 1/6: Cleaning up existing installation..."
$COMPOSE down -v 2>/dev/null || true
rm -f .env 2>/dev/null || true
docker volume rm prism-postgres-data prism-redis-data prism-photos-cache 2>/dev/null || true
success "Cleanup complete"

# Step 2: Run installer
log "Step 2/6: Running install script..."
./scripts/install.sh

# Step 3: Verify containers are running
log "Step 3/6: Verifying containers..."
CONTAINERS=$(docker ps --filter "name=prism" --format "{{.Names}}" | wc -l)
if [ "$CONTAINERS" -lt 3 ]; then
    error "Expected at least 3 containers, found $CONTAINERS"
fi
success "All containers running ($CONTAINERS)"

# Step 4: Test health endpoint
log "Step 4/6: Testing health endpoint..."
HEALTH=$(curl -sf http://localhost:3000/api/health || echo "failed")
if [ "$HEALTH" = "failed" ]; then
    error "Health check failed"
fi
success "Health endpoint responding"

# Step 5: Test database connection
log "Step 5/6: Testing database..."
USER_COUNT=$(docker exec prism-db psql -U prism -d prism -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
if [ "$USER_COUNT" = "0" ]; then
    warn "No users found - database may not be seeded"
else
    success "Database has $USER_COUNT user(s)"
fi

# Step 6: Test page load
log "Step 6/6: Testing page load..."
PAGE=$(curl -sf http://localhost:3000 | head -c 100)
if [[ "$PAGE" != *"<!DOCTYPE"* ]] && [[ "$PAGE" != *"<html"* ]]; then
    error "Page load failed - unexpected response"
fi
success "Page loads correctly"

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║     Fresh install test PASSED!                             ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Test results:"
echo "  - Containers: $CONTAINERS running"
echo "  - Health: OK"
echo "  - Database: $USER_COUNT user(s)"
echo "  - Page load: OK"
echo ""
