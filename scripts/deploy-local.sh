#!/bin/bash
# Local deploy: copy fresh build artifacts into the running container.
# Avoids docker-compose build (which fails on this host due to credential store issues).
# Run from project root after: npm run build

set -e

echo "Building..."
npm run build

echo "Deploying to container..."

# Copy server-side standalone files
docker cp .next/standalone/. prism-app:/app/

# Remove old static dir (as root to avoid permission issues from prior cp operations)
# then copy contents (trailing /.) so they land at /app/.next/static/* not nested deeper
docker exec --user root prism-app sh -c "rm -rf /app/.next/static && mkdir -p /app/.next/static"
docker cp .next/static/. prism-app:/app/.next/static/

echo "Restarting app..."
docker compose restart app

echo "Done. Waiting for health check..."
sleep 5
curl -sf http://localhost:3000/api/health/ready && echo "App is healthy" || echo "WARNING: health check failed"
