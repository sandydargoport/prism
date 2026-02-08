# Prism — Project Instructions for Claude Code

## Debugging

When troubleshooting any bug that takes more than 2-3 iterations to resolve, **read `LESSONS_LEARNED.md`** in the project root and follow the Quick Debugging Checklist before continuing.

Key rules:
- Always verify deployed code is fresh (`--no-cache`, grep for unique strings in container)
- Check database/API data before changing component code
- Add a visible DOM debug element showing state on the first failed test
- Ask the user for browser console output (F12) early
- Run `npx next build` locally before Docker builds
- Change one thing at a time

## Stack

- Next.js 15 (App Router) with TypeScript
- PostgreSQL + Drizzle ORM
- Redis for caching
- react-grid-layout v2 for dashboard layout
- Tailwind CSS + shadcn/ui
- Docker Compose for deployment

## Docker

```bash
# Always use --no-cache during debugging
docker-compose build --no-cache app && docker-compose up -d

# Verify code is deployed
docker exec prism-app sh -c "grep -r 'UNIQUE_STRING' /app/.next/ 2>/dev/null | head -1"

# Check logs
docker logs prism-app --tail 30

# Check database
docker exec prism-db psql -U prism -d prism -c "SELECT ..."
```

## Architecture

### Auth & RBAC
- PIN + bcrypt authentication. Sessions stored in Redis.
- **All mutation routes** must use `requireAuth()` + `requireRole(auth, 'permission')` from `@/lib/auth`.
- Permissions defined in `src/types/user.ts` (`PERMISSIONS` object). Server-side enforcement is mandatory — never rely on client-side checks alone.
- Never serialize `pinHash` to the client. API responses use `hasPin: boolean`.

### Database
- Drizzle ORM. Use the `db` proxy from `src/lib/db/client.ts`.
- Schema in `src/lib/db/schema.ts`.
- After schema changes, push to DB: rebuild Docker, then either expose DB port and run `npx drizzle-kit push` locally, or apply SQL directly via `docker exec prism-db psql -U prism -d prism -c "SQL..."` (production image doesn't include drizzle-kit).

### Redis
- Single shared client from `src/lib/cache/getRedisClient.ts`. Both cache (`redis.ts`) and session (`session.ts`) import from here.
- `createSession()` returns `null` when Redis is down — callers must handle this as "service unavailable".

### OAuth & Tokens
- OAuth tokens are encrypted at rest using AES-256-GCM (`src/lib/utils/crypto.ts`). Requires `ENCRYPTION_KEY` env var (64 hex chars).
- Encrypt before DB write, decrypt when reading for API calls. Never store plaintext tokens.
- OAuth callbacks use `process.env.BASE_URL` (not hardcoded localhost).

### Session Durations
- Single source of truth: `SESSION_DURATION` in `src/lib/constants.ts` (PARENT/CHILD/GUEST keys).

### Component Size
- If a component exceeds 250 lines or uses more than 5 data-fetching hooks, extract a custom hook or split into sub-components. See `useDashboardData.ts` as the pattern.

### Comment Policy
- No tutorial-style comments explaining frameworks or TypeScript concepts.
- Keep "why" comments for business logic and non-obvious decisions.
- Remove section banner separators (`// ====...====`).

## Layout System

Widget configs use the format `{i, x, y, w, h}` (NOT `{type, position: {x,y,w,h}}`). The `useLayouts` hook normalizes legacy formats but new code should always use the correct format.
