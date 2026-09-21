#!/bin/bash
# Local deploy: rebuild the image, then recreate the container from it.
#
# WHY THIS CHANGED (2026-09-21)
# -----------------------------
# This script used to `docker cp` a locally built bundle into the RUNNING
# container. That writes to the container's ephemeral writable layer, so any
# recreate threw the deploy away: `compose down`/`up`, a `docker rm`, or a host
# reboot that recreates rather than restarts.
#
# It happened. A `compose down`/`up` on 2026-09-16 reverted production to the
# image built on 2026-06-28, and it served three-month-old code for five days
# before anyone noticed. Nothing caught it, because every signal a deploy is
# normally judged by still passed: /api/health returned ok, every page returned
# 200, and the dashboard rendered correctly in a screenshot. A rolled-back build
# is a working build. Only the BUILD_ID said otherwise, and nothing compared it.
#
# The original reason for copying was that `docker compose build` failed on this
# host over docker credential-store issues. That is no longer true: there is no
# ~/.docker/config.json and no credential helper installed, and a build was
# verified working before this script was rewritten. So the workaround outlived
# the problem, and the workaround is what broke.
#
# Building the image also fixes what the copy approach had to manage by hand:
# native modules compile against Alpine's musl instead of being stripped out to
# avoid a glibc/musl mismatch (so sharp stops lagging package.json), public/ and
# .next/static ship via the Dockerfile, and file ownership is correct on arrival
# rather than being chown'd back afterwards.
#
# MIGRATIONS ARE STILL SEPARATE. The image carries drizzle/ and migrate.js, but
# this script does not run them. A schema-changing deploy still needs its own
# step; see the local-deploy-migrations note.

set -e

cd "$(dirname "$0")/.."

SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
DIRTY=""
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  DIRTY=" (working tree has uncommitted changes)"
fi
echo "Deploying ${SHA}${DIRTY}"

# Tag whatever is currently deployed so there is somewhere to go back to. The
# image is about to be replaced under the same name, and without this the only
# rollback is rebuilding from an older commit.
if docker image inspect prism-app >/dev/null 2>&1; then
  docker tag prism-app "prism-app:rollback-$(date +%Y%m%d-%H%M%S)"
  echo "Tagged the outgoing image for rollback."
fi

echo "Building image..."
docker compose build --build-arg "PRISM_GIT_SHA=${SHA}" app

echo "Recreating container..."
# Only the app service. The database and redis keep running; recreating those
# is never part of a code deploy.
docker compose up -d --no-deps app

# Wait for the app to actually come up, rather than guessing at a fixed sleep.
# A sleep shorter than a cold start printed the same warning after a good deploy
# as after a broken one, which is how a genuinely broken deploy got waved
# through on 2026-09-11.
echo "Waiting for health check..."
healthy=""
for _ in $(seq 1 40); do
  if curl -sf -m 5 http://localhost:3000/api/health/ready >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 3
done

if [ -z "$healthy" ]; then
  echo "WARNING: app did not become healthy within 120s."
  echo "--- last 20 log lines ---"
  docker logs prism-app --tail 20 2>&1
  # A native module that will not load is the likeliest cause and the hardest to
  # read out of the logs, so name it directly.
  echo "--- native module check ---"
  docker exec prism-app node -e "require('sharp'); console.log('sharp loads OK')" 2>&1 | tail -3
  echo
  echo "To go back, retag the most recent rollback image and recreate:"
  docker images --format '  docker tag {{.Repository}}:{{.Tag}} prism-app && docker compose up -d --no-deps app' \
    --filter 'reference=prism-app:rollback-*' | head -1
  exit 1
fi

echo "App is healthy: $(curl -s -m 5 http://localhost:3000/api/health/ready)"

# Prove the running container is the thing just built, rather than trusting that
# it is. This is the check whose absence hid a five-day rollback: under the old
# copy-based model the container's BUILD_ID matching the image's meant NO deploy
# was applied; under this one it is exactly what success looks like.
img_build=$(docker run --rm --entrypoint sh prism-app -c 'cat /app/.next/BUILD_ID' 2>/dev/null)
run_build=$(docker exec prism-app sh -c 'cat /app/.next/BUILD_ID' 2>/dev/null)
run_sha=$(docker exec prism-app printenv PRISM_GIT_SHA 2>/dev/null || echo "")

if [ -n "$img_build" ] && [ "$img_build" != "$run_build" ]; then
  echo "WARNING: the running container is not the image that was just built."
  echo "         image=$img_build running=$run_build"
  echo "         Something recreated it from a different image, or the build did not take."
  exit 1
fi

echo "Deployed ${run_sha:-$SHA} (build ${run_build})."
echo
echo "The wall display caches a service worker. To pick this up there:"
echo "  Settings -> Backup -> Clear Cache & Reload"
