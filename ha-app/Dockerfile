# Prism Home Assistant addon image — self-contained build.
#
# HA Supervisor uses the addon's own folder (ha-app/) as the Docker build
# context, so the Dockerfile can't reach `../package.json` or anything else
# in the parent repo. To stay buildable on a user's HA host without
# requiring a separate published image, we clone the Prism source at
# build time and build inside this container.
#
# When the release pipeline (#104) publishes pre-built multi-arch images
# to ghcr.io, this Dockerfile gets replaced with a tiny wrapper that just
# `FROM`s the published image and copies run.sh — install drops from
# ~10 min to ~30 s.

ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

# Pin which Prism ref the addon builds from. Defaults to master so a
# fresh `Update` from the HA UI grabs the latest. Override via HA build
# args if you want a tagged release.
ARG PRISM_REF=master

# Install everything in a single layer: postgres + redis (bundled DB),
# node 24 (build + runtime), chromium (Puppeteer screenshots), git (to
# fetch the source).
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        postgresql-15 \
        postgresql-client-15 \
        redis-server \
        sudo \
        chromium \
        fonts-freefont-ttf \
        libnss3 \
        libfreetype6 \
        libharfbuzz0b \
        openssl \
        jq \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Clone + build Prism inside the container. `--depth 1` keeps the clone
# small; `${PRISM_REF}` lets you build a specific tag if you want.
RUN git clone --depth 1 --branch ${PRISM_REF} https://github.com/sandydargoport/prism.git /src

WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci --frozen-lockfile && \
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
    cp -r /src/dist/db /app/dist/db && \
    cp -r /src/src/lib/db/init /app/db-init && \
    rm -rf /src

ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# HA addon mode flag — runtime config reads this to flip paths to /data.
ENV PRISM_HA_MODE=1

# Entrypoint orchestrates: init secrets, init DB, start postgres+redis,
# run migrations, exec Next.js. Only file from the addon's own context.
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 3000

CMD ["/run.sh"]
