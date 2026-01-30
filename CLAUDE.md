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

## Layout System

Widget configs use the format `{i, x, y, w, h}` (NOT `{type, position: {x,y,w,h}}`). The `useLayouts` hook normalizes legacy formats but new code should always use the correct format.
