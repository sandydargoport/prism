# Prism v1.0 Architectural & Performance Review

**Date:** 2026-02-04
**Status:** Implementation in progress

## Executive Summary

The Prism codebase has solid foundational architecture — proper server/client component boundaries, structured auth/RBAC, and well-organized database schema with Drizzle ORM — but is undermined by **pervasive data-fetching inefficiencies** that are the primary source of latency issues. The client layer makes an estimated 3,300+ unnecessary API calls per day through aggressive 1-minute polling intervals and redundant family member fetches across every View, while the server layer has a fully-built Redis caching infrastructure that is **never actually used** (the `getCached()` function exists but is called zero times). Addressing the top 10 findings below would eliminate the majority of observable latency without requiring architectural changes.

---

## Critical Fixes (Must-Fix for v1.0)

### P0 — Actively Causing Latency

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| **1** | **Redis cache built but never called** | `src/lib/cache/redis.ts` — `getCached()` is never invoked in any API route. `invalidateCache()` is called in some routes, but nothing is cached. | Every request hits PostgreSQL directly. Wrapping `/api/events`, `/api/chores`, `/api/meals`, `/api/calendar-groups` in `getCached()` with 60-300s TTLs would cut DB load by 80%+. |
| **2** | **Aggressive polling: 7 hooks at 60-second intervals** | `useChores`, `useTasks`, `useMeals`, `useShoppingLists`, `useMessages` all default to 60s refresh in `src/lib/hooks/` | On the Dashboard alone, this generates ~7 API calls/minute = **3,360+ calls/day** for one idle browser tab. Increase to 5-10 minutes or use visibility-based refresh. |
| **3** | **Family members fetched independently in 4+ Views** | `ChoresView:85`, `TasksView:80`, `ShoppingView:76`, `SettingsView:117` — each has its own `fetch('/api/family')` in a `useEffect` | Navigating between sections makes 4 redundant requests for identical data. Move to a shared `FamilyContext` provider fetched once at app boot. |
| **4** | **Shopping lists waterfall: N+1 API calls** | `useShoppingLists.ts:69-86` — fetches all lists, then fetches items for each list in parallel | With 5 lists = 6 HTTP requests. Server should return lists with items in a single response. |
| **5** | **COUNT query bug breaks pagination** | `tasks/route.ts:90-97`, `messages/route.ts:125-128` — uses `countResult.length` (row count) instead of `sql\`count(*)\`` | Tasks and messages pagination shows incorrect totals. The photos route (`photos/route.ts:49-57`) has the correct pattern to follow. |

### P1 — Security Gaps

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| **6** | **Chore approval endpoint uses manual role check instead of `requireRole()`** | `chores/[id]/approve/route.ts:114-119` | Inconsistent with CLAUDE.md auth pattern. Functional but fragile. |
| **7** | **Messages PATCH missing author/parent authorization** | `messages/[id]/route.ts:98-204` | Any authenticated user can edit any message. Code comment at line 94 acknowledges this is TODO. |
| **8** | **Check-then-act race conditions without transactions** | `chores/[id]/complete:191-238`, `family/[id]:226-241`, `layouts:60-66` | Concurrent requests can create duplicate pending completions, delete the last parent, or create multiple default layouts. Wrap in `db.transaction()`. |
| **9** | **File uploads check MIME type but not magic bytes** | `photos/route.ts:79-107`, `family/[id]/avatar/route.ts:28-44` | MIME types are spoofable. Add `file-type` library validation of actual file content. |

### P2 — Data Integrity

| # | Issue | Location |
|---|-------|----------|
| **10** | **7+ missing database indexes** | `tasks.completed`, `choreCompletions.approvedBy`, `shoppingItems.checked`, `calendarSources.enabled`, `calendarGroups.type`, `familyMessages.expiresAt`, composite `choreCompletions(choreId, approvedBy)` |
| **11** | **16+ foreign key columns missing cascade/set-null rules** | `events.createdBy`, `tasks.assignedTo`, `tasks.completedBy`, `chores.assignedTo`, `familyMessages.authorId`, `meals.cookedBy`, and 10+ more — all missing `onDelete` behavior, which blocks user deletion |
| **12** | **Duplicate `calculateNextDue()` function** | Identically defined in both `chores/[id]/complete/route.ts:34-71` and `chores/[id]/approve/route.ts:25-62` — extract to `src/lib/utils/` |

---

## Refactoring Suggestions

### Component Size Violations

18 components exceed the 250-line limit set in CLAUDE.md. The worst offenders:

| Component | Lines | Recommended Split |
|-----------|-------|-------------------|
| `CalendarView.tsx` | 651 | Extract each sub-view (Day, Week, 2-Week, Month, 3-Month) into its own file |
| `LayoutGridEditor.tsx` | 521 | Split edit vs. display modes; extract ColorPicker, GridBackground, ScreenGuideLines |
| `ChoresView.tsx` | 521 | Extract filter bar, chore list, and modal orchestration |
| `MealsView.tsx` | 536 | Extract week navigation, meal card, and add/edit forms |
| `AddEventModal.tsx` | 491 | Extract form sections (date/time, recurrence, reminders) |
| `Dashboard.tsx` | 476 | Extract widget props builder and modal management into hooks |

### State Management Anti-Patterns

- **Dual state in ChoresView and TasksView**: Both sync API data into local `useState` via `useEffect`, then compute filtered lists with `useMemo`. Replace the intermediate state with a single `useMemo` that transforms API data directly.
- **MealsView bypasses useMeals hook**: Implements its own `fetch` logic inline (`MealsView.tsx:45-62`), missing the hook's auto-refresh and caching. Should use the existing `useMeals` hook.
- **No centralized data layer**: Every hook implements its own fetch/cache/refresh logic independently. Consider React Query or SWR to get automatic request deduplication, stale-while-revalidate, and focus-based refetching for free.

### Widget System

- **All 11 widgets eagerly loaded** in `widgetRegistry.ts:2-13` — even widgets not in the current layout are bundled and imported. Replace with `React.lazy()` for non-default widgets.
- **4 dashboard modals always mounted in DOM** (`Dashboard.tsx:444-472`) — even when `open={false}`, the Dialog components maintain hidden DOM nodes. Change to conditional rendering: `{showAddTask && <AddTaskModal />}`.
- **Barrel file over-pulling**: `@/components/modals` exports 5 modals; Dashboard uses 4 but bundles all 5. Use direct imports instead.

### Code Duplication

- `calculateNextDue()` duplicated across two chore routes
- Family member fetching duplicated across 4 View components
- Calendar group fetching duplicated between `useCalendarFilter` and `CalendarView`

---

## Performance Roadmap

### Phase 1: Quick Wins (Highest ROI)

1. **Activate Redis caching** — Wrap the 5 most-hit GET endpoints in `getCached()`:
   - `/api/events` (TTL: 120s)
   - `/api/chores` (TTL: 60s)
   - `/api/calendar-groups` (TTL: 600s)
   - `/api/meals` (TTL: 300s)
   - `/api/family` (TTL: 600s)

2. **Increase polling intervals** — Change defaults from 60s to:
   - Chores/Tasks/Meals/Shopping: 300s (5 min)
   - Messages: 120s (2 min)
   - Calendar events: 300s (5 min, already set)
   - Add `document.visibilitychange` listener to pause polling when tab is hidden

3. **Fix COUNT queries** — Replace `countResult.length` with `sql\`count(*)\`` in `tasks/route.ts` and `messages/route.ts`

4. **Create FamilyContext provider** — Fetch family members once in the root layout, share via React Context. Remove the 4 duplicate `useEffect` fetches.

### Phase 2: Server Optimization

5. **Add missing database indexes** — Create a migration adding the 7 indexes listed above. This is a zero-downtime change that will improve query performance across the board.

6. **Consolidate shopping API** — Add `?includeItems=true` parameter to `/api/shopping-lists` that returns items inline, eliminating the N+1 waterfall.

7. **Fix N+1 in calendar-groups seeding** — Replace the `for` loop with individual inserts (`seedDefaultGroups()` lines 88-98) with a single `db.insert().values([...])` batch insert. Pre-build a Map for the source migration loop.

8. **Fix N+1 in birthday sync** — Replace the per-event `findFirst` + `insert/update` loop (`birthdays/sync/route.ts:233-279`) with a batch upsert using `ON CONFLICT`.

9. **Add cascade rules to foreign keys** — Create a migration adding `onDelete: 'set null'` to the 16+ user-referencing FK columns, and `onDelete: 'cascade'` to `familyMessages.authorId`.

### Phase 3: Client Bundle & Architecture

10. **Lazy-load widgets** — Replace static imports in `widgetRegistry.ts` with `React.lazy()`. Keep Clock, Calendar, and Weather as eager loads (default layout); lazy-load the rest.

11. **Conditional modal rendering** — Change Dashboard modal pattern from always-mounted to `{showX && <Modal />}`.

12. **Split oversized components** — Target the 6 components over 400 lines first. Extract sub-components and custom hooks following the `useDashboardData.ts` pattern already in the codebase.

### Phase 4: Security Hardening

13. **Wrap concurrent mutation endpoints in `db.transaction()`** — chore completion, family deletion, layout default toggle.

14. **Add `requireRole()` to chore approval and author checks to message PATCH**.

15. **Add magic byte validation to file uploads** using the `file-type` package.

16. **Implement per-user rate limiting on mutation endpoints** using Redis (infrastructure already exists).

---

## Detailed Agent Reports

Full raw analysis from five parallel exploration agents is available at:
- API Routes: `C:\Users\User\AppData\Local\Temp\claude\C--projects-prism\tasks\a8ea152.output`
- Client Hooks/State: `C:\Users\User\AppData\Local\Temp\claude\C--projects-prism\tasks\a107286.output`
- DB Schema/Indexing: `C:\Users\User\AppData\Local\Temp\claude\C--projects-prism\tasks\a5b203e.output`
- Component Architecture: `C:\Users\User\AppData\Local\Temp\claude\C--projects-prism\tasks\a7644a5.output`
- Security/Edge Cases: `C:\Users\User\AppData\Local\Temp\claude\C--projects-prism\tasks\a30d6b8.output`
