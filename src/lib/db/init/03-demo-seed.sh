#!/bin/sh
# Loads the fictional demo family (demo/seed.sql) on first database creation,
# but only when PRISM_DEMO_SEED=true. A real install starts empty and the
# setup wizard creates the family. Seeding by default left demo members,
# tasks and birthdays inside new households, and birthdays cannot be deleted
# in the app (they are maintained by calendar and contact sync).
#
# The public demo turns this on in docker-compose.demo.yml. Postgres runs this
# file once, from docker-entrypoint-initdb.d, and ignores the demo/ directory.
set -e

if [ "${PRISM_DEMO_SEED:-false}" != "true" ]; then
    echo "PRISM_DEMO_SEED is not true, starting with an empty household"
    return 0 2>/dev/null || exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -f /docker-entrypoint-initdb.d/demo/seed.sql
