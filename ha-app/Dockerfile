# Prism Home Assistant addon image.
#
# Standard tier: builds Prism from source inside the addon container,
# bundles postgres + redis as in-container processes, persists data to
# the HA-managed /data volume.
#
# The Dockerfile mirrors the root Dockerfile's multi-stage shape so the
# Next.js standalone build is identical; the addon-specific bits live
# in the final stage (postgres + redis install, run.sh entrypoint).

ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest

# ─── deps ─────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps

WORKDIR /build

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile

# ─── builder ──────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /build

COPY --from=deps /build/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build && npm run db:bundle

# ─── addon runtime ────────────────────────────────────────────────────
FROM ${BUILD_FROM}

# Node + bundled postgres + redis + everything Prism needs at runtime.
# Alpine vs. HA's base (Debian) — HA's base IS Debian, so we use apt-get
# and Debian-style paths (postgresql @ /var/lib/postgresql/15).
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        postgresql-15 \
        postgresql-client-15 \
        redis-server \
        sudo \
        chromium \
        fonts-freefont-ttf \
        libnss3 \
        libfreetype6 \
        libharfbuzz0b \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# HA addon mode flag — runtime config reads this to flip paths to /data.
ENV PRISM_HA_MODE=1

WORKDIR /app

# Copy the standalone Next.js build the same way the root Dockerfile does.
COPY --from=builder /build/public ./public
COPY --from=builder /build/.next/standalone ./
COPY --from=builder /build/.next/static ./.next/static
COPY --from=builder /build/drizzle ./drizzle
COPY --from=builder /build/scripts/migrate.js ./scripts/migrate.js
COPY --from=builder /build/node_modules/postgres ./node_modules/postgres
COPY --from=builder /build/dist/db ./dist/db
# Base schema (applied before any migration) lives in src/lib/db/init.
COPY --from=builder /build/src/lib/db/init ./db-init

# Entrypoint orchestrates: init secrets, init DB, start postgres+redis,
# run migrations, exec Next.js.
COPY ha-app/run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 3000

CMD ["/run.sh"]
