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

RUN apk add --no-cache postgresql-client chromium nss freetype harfbuzz ca-certificates ttf-freefont

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

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
