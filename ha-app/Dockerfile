# Prism Home Assistant addon image — self-contained build.
#
# HA Supervisor uses the addon's own folder (ha-app/) as the Docker build
# context, so the Dockerfile can't reach `../package.json` or anything else
# in the parent repo. To stay buildable on a user's HA host, we clone the
# Prism source at build time and build inside this container.
#
# Why node:24-alpine instead of HA's official `ghcr.io/home-assistant/
# <arch>-base`: package.json requires Node >=24, and HA's base images
# (Alpine 3.x) ship Node 20 via the `nodejs` apk package. Pulling a real
# Node 24 onto HA's base is more friction than just using the official
# node:24-alpine multi-arch image and adding what we need on top.
# Supervisor doesn't care which base — it just runs the container's CMD.

FROM node:24-alpine

# Pin which Prism ref the addon builds from. Defaults to master so a
# fresh `Update` from the HA UI grabs the latest. The release pipeline
# overrides this to the version tag (`v1.8.5`) for reproducible builds.
ARG PRISM_REF=master

# Single-layer install of everything the build + runtime needs:
#   - bash         (run.sh shebang; alpine ships ash by default)
#   - git          (clone Prism source at build time)
#   - postgres + redis  (bundled DB + cache)
#   - chromium     (Puppeteer screenshots for share-card rendering)
#   - sudo         (drop privileges for postgres role switch in run.sh)
#   - jq, openssl  (run.sh: parse options.json, generate secrets)
#   - libc6-compat (sharp / native modules — same pattern as root Dockerfile)
#
# Note on postgres version: this Dockerfile uses the unversioned
# `postgresql` apk package, which resolves to whichever postgres major
# the current Alpine release ships (Alpine 3.21 → postgres 17, etc.).
# The standalone docker-compose and CI matrix run against postgres 15,
# but Drizzle migrations are standard SQL and run cleanly on both.
# Pinning a specific major (e.g. `postgresql15`) breaks on Alpine
# versions that no longer carry that major in the main repo, which is
# how the first attempt of this Dockerfile failed.
RUN apk add --no-cache \
        bash \
        ca-certificates \
        curl \
        git \
        jq \
        openssl \
        sudo \
        postgresql \
        postgresql-client \
        postgresql-contrib \
        redis \
        chromium \
        nss \
        freetype \
        harfbuzz \
        ttf-freefont \
        libc6-compat

# Clone + build Prism inside the container. `--depth 1` keeps the clone
# small; `${PRISM_REF}` lets the release pipeline pin a specific tag.
RUN git clone --depth 1 --branch ${PRISM_REF} https://github.com/sandydargoport/prism.git /src

WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci && \
    npm run build && \
    npm run db:bundle

# Lay out the runtime tree at /app — mirrors the standalone shape the
# root Dockerfile uses, but flattened into one stage.
WORKDIR /app
RUN cp -r /src/.next/standalone/. /app/ && \
    mkdir -p /app/.next && cp -r /src/.next/static /app/.next/static && \
    cp -r /src/public /app/public && \
    cp -r /src/drizzle /app/drizzle && \
    mkdir -p /app/scripts && cp /src/scripts/migrate.js /app/scripts/migrate.js && \
    mkdir -p /app/node_modules && cp -r /src/node_modules/postgres /app/node_modules/postgres && \
    mkdir -p /app/dist && cp -r /src/dist/db /app/dist/db && \
    cp -r /src/src/lib/db/init /app/db-init && \
    rm -rf /src

ENV NODE_ENV=production
# Alpine's chromium apk package installs the binary as chromium-browser.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# HA addon mode flag — runtime config reads this to flip paths to /data.
ENV PRISM_HA_MODE=1

# Entrypoint orchestrates: init secrets, init DB, start postgres+redis,
# run migrations, exec Next.js. Only file from the addon's own context.
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 3000

CMD ["/run.sh"]
