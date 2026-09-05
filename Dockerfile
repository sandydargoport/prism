FROM node:24-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./

RUN npm ci --frozen-lockfile

FROM node:24-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build && npm run db:bundle

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Anonymous update-check endpoint (see src/lib/telemetry). Empty by default, so
# an image built from source phones home to nobody; only the official CI build
# passes the real URL as a build-arg (Option B). Overridable/disable at runtime
# via PRISM_TELEMETRY_URL / PRISM_DISABLE_TELEMETRY.
ARG PRISM_TELEMETRY_URL=""
ENV PRISM_TELEMETRY_URL=${PRISM_TELEMETRY_URL}

RUN apk add --no-cache postgresql-client chromium nss freetype harfbuzz ca-certificates ttf-freefont

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Third-party notices. The bundled Twemoji artwork is CC-BY 4.0, which — unlike
# the OFL fonts — genuinely requires attribution from anyone redistributing it.
# That obligation attaches to the distributed artifact, so the notices have to
# be in the image; sitting in the repository does not discharge it.
COPY --from=builder /app/NOTICE ./NOTICE
COPY --from=builder /app/third-party ./third-party

# Migration runner and SQL files
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts/migrate.js ./scripts/migrate.js
# reset-pin.js: offline PIN recovery, run via `docker compose exec`.
COPY --from=builder /app/scripts/reset-pin.js ./scripts/reset-pin.js
# postgres (postgres.js) and bcryptjs are bundled into Next.js server chunks and
# not included in the standalone node_modules — copy them explicitly for the
# migration runner and the reset-pin recovery script.
COPY --from=builder /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
# Bundled DB scripts (seed + clear) for the Settings → Backups buttons.
# Self-contained CJS bundles with all deps inlined via esbuild — no need
# to ship src/ or the dev node_modules.
COPY --from=builder /app/dist/db ./dist/db
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

RUN mkdir -p /app/config /app/uploads /app/cache/photos
RUN chown -R nextjs:nodejs /app/config /app/uploads /app/cache /app/drizzle /app/scripts /app/entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["/bin/sh", "./entrypoint.sh"]
