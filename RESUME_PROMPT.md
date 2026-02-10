# Resume Prompt for Next Session

## Pre-Work: Rename Verification & Folder Rename

Before starting Phase 2, complete these steps:

### 1. Rename the project folder

The project folder is still `C:\projects\prism` — rename it to `C:\projects\prism`:

```powershell
Rename-Item C:\projects\prism prism
```

If it fails due to "in use", close all terminals/editors accessing the folder first, then retry.

### 2. Verify the Prism → Prism rename is complete

We performed a full brand rename from "Prism" to "Prism" across the entire codebase. Run this grep to confirm no remaining references in source code:

```bash
grep -ri '\bprism\b' --include='*.{ts,tsx,js,jsx,css,md,yml,yaml,sql,env}' . | grep -v node_modules | grep -v .next | grep -v '.claude/'
```

**Expected:** Only `docs/architecture-review-v1.md` should show hits (filesystem paths to temp files like `C--projects-prism` — these are correct and should not be changed).

If any other hits appear, fix them. Here's what was changed:

- **package.json/lock**: name→`prism`, license→`AGPL-3.0`, author→`Prism Community`
- **Docker**: containers→`prism-app/db/redis`, DB name/user→`prism`, network/volumes→`prism-*`
- **Auth cookies**: `prism_session`→`prism_session`, `prism_user`→`prism_user`
- **localStorage keys**: all `prism-*` → `prism-*` (15 keys across 10 files)
- **Custom events**: `prism:screensaver` → `prism:screensaver`
- **UI/metadata**: all user-visible "Prism" → "Prism"
- **Comment banners**: `PRISM -` → `PRISM -` in 97+ source files
- **Config files**: `.env`, `.env.example`, `docker-compose.yml`, `Dockerfile`, `tailwind.config.js`, etc.
- **Docs**: README (full rewrite), LICENSE, CLAUDE.md, all docs/ and tests/ files
- **File renamed**: `prism-requirements_v19.md` → `prism-requirements_v19.md`

### 3. Rebuild Docker

After the folder rename, rebuild Docker from the new location:

```bash
cd C:\projects\prism
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Important:** The database name/user changed from `prism` to `prism`, so you'll need to recreate the database:

```bash
docker-compose down -v   # removes volumes including DB data
docker-compose up -d     # recreates everything fresh
```

Then re-seed:

```bash
docker exec prism-app npm run db:push
docker exec prism-app npm run db:seed
```

### 4. Verify the app loads

```bash
docker logs prism-app --tail 20
curl http://localhost:3000/api/health
```

---

## Phase 2: Server Optimization

We completed Phase 1 of the Performance Roadmap from `docs/architecture-review-v1.md`. All 4 tasks are done and deployed:

1. Redis caching on GET endpoints with invalidation on mutations
2. Polling intervals reduced (60s → 300s/120s) with visibility-based pause
3. COUNT query bugs fixed in tasks and messages routes
4. FamilyContext provider replacing 9 duplicate `fetch('/api/family')` calls

Read `docs/architecture-review-v1.md` for the full roadmap. Phase 2 covers these items (roadmap items #5-9):

### Task 5: Add missing database indexes
Create a migration adding 7 indexes: `tasks.completed`, `choreCompletions.approvedBy`, `shoppingItems.checked`, `calendarSources.enabled`, `calendarGroups.type`, `familyMessages.expiresAt`, and composite `choreCompletions(choreId, approvedBy)`. This is a zero-downtime change.

### Task 6: Consolidate shopping API
Add `?includeItems=true` parameter to `/api/shopping-lists` that returns items inline, eliminating the N+1 waterfall in `useShoppingLists.ts:69-86` (currently fetches all lists, then fetches items for each list separately).

### Task 7: Fix N+1 in calendar-groups seeding
Replace the `for` loop with individual inserts in `seedDefaultGroups()` with a single `db.insert().values([...])` batch insert. Pre-build a Map for the source migration loop.

### Task 8: Fix N+1 in birthday sync
Replace the per-event `findFirst` + `insert/update` loop in `birthdays/sync/route.ts:233-279` with a batch upsert using `ON CONFLICT`.

### Task 9: Add cascade rules to foreign keys
Create a migration adding `onDelete: 'set null'` to the 16+ user-referencing FK columns, and `onDelete: 'cascade'` to `familyMessages.authorId`. See issue #11 in the architecture review for the full list of affected columns.

Continue with Phase 2 implementation.
