# Planning &amp; project status

A single map of where Prism's planning lives. The roadmap itself is public and community-voted on GitHub — this page **indexes** the internal planning/reference docs and **gathers the backlog** that isn't yet tracked as an issue, so nothing gets lost.

_Last reviewed: 2026-07-27, after the recipe/meal **sync framework** shipped ([#58](https://github.com/sandydargoport/prism/issues/58))._

## Current focus (2026-07-28)

**Shipped in [v1.10.0](CHANGELOG.md):** the review-and-approve **sync framework** (recipes + meal plans for Tandoor & Mealie — [#58](https://github.com/sandydargoport/prism/issues/58)), the **calendar-sync overhaul** ([#171](https://github.com/sandydargoport/prism/issues/171) Stages 1–3: deletes-only review, tombstones, net-change counts, calendar-management-on-page), **weather-by-ZIP** ([#170](https://github.com/sandydargoport/prism/issues/170)), a household **timezone** setting, and the settings reshuffle (General section).

**Top of the backlog — revisit next:**

1. ⭐ **Easy self-serve hosting** ([#178](https://github.com/sandydargoport/prism/issues/178)) — let non-technical users (no Docker / HA) spin up their *own* cloud instance via a one-click deploy, so the maintainer hosts nothing (not a multi-tenant SaaS). The standout strategic item; not yet scoped.
2. **Write-back / two-way** ([#169](https://github.com/sandydargoport/prism/issues/169)) — push Prism edits back to Tandoor/Mealie (recipe/meal sync phase 2b).
3. **CalDAV upstream delete** ([#171](https://github.com/sandydargoport/prism/issues/171)) — deleting in Prism also removes it from iCloud (two-way parity with Google; deferred from the Stage 2/3 work).

Deliberately **deprioritized:** real RRULE recurrence builder ([#59](https://github.com/sandydargoport/prism/issues/59)) — valuable but heavy; revisit much later.

---

## Roadmap (live, on GitHub)

The authoritative roadmap is the **[Prism Roadmap project](https://github.com/users/sandydargoport/projects/3)** — every item is a [`roadmap`-labeled issue](https://github.com/sandydargoport/prism/issues?q=is%3Aissue+is%3Aopen+label%3Aroadmap+sort%3Areactions-desc), ranked by 👍/❤️/🚀 reaction count. React on an issue to vote for it.

This page **deliberately does not mirror the full list** (a copy would drift). The themed snapshot below is just orientation — GitHub is the source of truth.

**Open roadmap themes (2026-07-27):**

- **Sync framework** — recipe + meal-plan sync **shipped** for Tandoor & Mealie ([#58](https://github.com/sandydargoport/prism/issues/58)); next: write-back / two-way ([#169](https://github.com/sandydargoport/prism/issues/169)) and **calendar sync** on the same framework ([#171](https://github.com/sandydargoport/prism/issues/171)).
- **Layout / dashboard** — collapsible "expander" widgets ([#121](https://github.com/sandydargoport/prism/issues/121)), freeform pixel-layout mode ([#53](https://github.com/sandydargoport/prism/issues/53)), finish the consolidated Integrations page ([#52](https://github.com/sandydargoport/prism/issues/52) — Phase 1 shipped).
- **Meals / chores** — due-date-anchored chore recurrence + meal-prep reminders ([#51](https://github.com/sandydargoport/prism/issues/51)).
- **Settings / weather** — replace free-text weather location with a ZIP ([#170](https://github.com/sandydargoport/prism/issues/170)); household timezone setting **shipped**.
- **Calendar** — sync via the framework (above, [#171](https://github.com/sandydargoport/prism/issues/171)); real RRULE recurrence builder ([#59](https://github.com/sandydargoport/prism/issues/59)) **deprioritized** to later.
- **Photos** — auto-detect favorites from cloud/folder ([#57](https://github.com/sandydargoport/prism/issues/57)); "By Trip" grouping via travel pins ([#54](https://github.com/sandydargoport/prism/issues/54)).
- **Travel** — globe marker precision at low zoom ([#55](https://github.com/sandydargoport/prism/issues/55), bug).
- **Voice / Alexa** — remaining intent phases 2c/3/4 ([#56](https://github.com/sandydargoport/prism/issues/56)) — blocked on a remote MCP endpoint.
- **Contacts** — read-only iCloud contacts mirror ([#75](https://github.com/sandydargoport/prism/issues/75), low priority).

---

## Internal planning &amp; reference docs

These live in `docs/` but are kept out of the user-facing nav. What each is, and its current status:

| Doc | What it is | Status |
|---|---|---|
| [Architecture review v4](arch-review-v4.md) | April 2026 architecture/security review (meeting notes + graded findings) | **Historical** — its security findings were superseded by the July audit |
| [Codebase audit 2026-07](audit-2026-07.md) | July 2026 multi-agent security/correctness audit (67 findings) | ✅ **Fully remediated in [v1.9.0](CHANGELOG.md)** — kept as a record |
| [Decisions &amp; lessons log](decisions-log.md) | Post-mortems of built-but-unmerged spikes | Active (append-only) |
| [Voice API](voice-api.md) | `/api/v1/voice/*` endpoint reference + Alexa roadmap | Active reference |
| [Code-review modalities](code-review-modalities.md) | CI review-gate coverage matrix | Active |
| [Features at a glance](features-index.md) | One-line-per-feature catalog (SEO / AI-summary surface) | Active |
| [API auth levels](api-auth-levels.md) | Auth-tier reference for API routes | Active reference |
| [Calendar cards design](calendar-cards-design.md) | Design rationale for the calendar widget cards | Active reference |
| [Alternatives](alternatives.md) | Prism vs. Skylight / Dakboard / MagicMirror² | Active |

---

## Internal backlog (not yet tracked as issues)

Forward-looking work found in the docs that has **no GitHub issue** — candidates to file if/when prioritized, so they don't get lost in prose.

**Integrations &amp; sync**

- **Resurrect the MCP server** — a working Prism Model Context Protocol server (`.mcp/`, stdio transport, reuses Settings → API Tokens for auth) was built but never merged; re-cut from commit `f870aeb` rather than from scratch. Future direction: a remote/hosted variant (Streamable HTTP + OAuth 2.1). _(`decisions-log.md`)_
- **Two-way CalDAV calendar write** — Apple / CalDAV calendars are read-only today. _(`features/CALENDAR.md`)_ → now tracked as part of calendar sync ([#171](https://github.com/sandydargoport/prism/issues/171)).

**Features**

- **Recipe print stylesheet + shareable read-only link** _(`features/RECIPES.md`)_
- **PWA notification badges** for unapproved chores / unread messages — the badge infra is in place. _(`features/MOBILE.md`)_
- **Global font-scale override** — listed as planned; verify against the current build before filing. _(`features/MOBILE.md`)_
- **Weekend Ideas Phase 2+** — POI search, regional map view, weather/season "Suggest" mode, share/collaborate. _(`features/WEEKEND.md`)_
- **Wishes ↔ Gift-Ideas auto-claim** — marking a gift idea purchased could auto-claim the matching wish item. _(`features/WISHES.md`)_
- **Global-input-system v2** — camera barcode scanning (zxing + `getUserMedia`), interim-speech chip, voice-language setting, keyboard a11y roles, and more. _(`features/global-input-system.md`)_

**Engineering / tech-debt** (from the April arch review, still open)

- Split the oversized `TravelGlobe.tsx` into hooks (M1); nearby-photos SQL bounding-box + cache + `photos → travel` cross-invalidation (M2); pause auto-rotation on `visibilitychange` (M3); move the traffic workflow to a dedicated branch (M8); weekend a11y tab roles (L1). _(`arch-review-v4.md`)_

---

## Open decisions

Unresolved questions recorded in the review docs:

- **`weekend_visits` table — keep or drop.** It's currently unused (the UI increments a denormalized `visitCount` on the parent row). `arch-review-v4.md` and `features/WEEKEND.md` currently **contradict each other** on whether it's live — resolve, then update both.
- **Structural guardrail for display-auth on mutation routes** — a `getReadAuth()` / `getWriteAuth()` split vs. a lint rule. The underlying IDOR was fixed in v1.9.0; the guardrail decision is still open. _(`arch-review-v4.md`)_
- **Traffic bot** — PR vs. direct-push-to-master. _(`arch-review-v4.md`)_

---

## Recently shipped

- **Recipe & meal-plan sync framework** (2026-07-27, [#58](https://github.com/sandydargoport/prism/issues/58) via [#168](https://github.com/sandydargoport/prism/pull/168)) — reusable review-and-approve sync (entity-agnostic diff → review → apply + provider registry). One-way recipe + meal-plan pull for **Tandoor & Mealie**, with recipe auto-import, images, mass-delete guard, and idempotent re-sync. Also landed a household **timezone setting** and an ingredient **serving-scaling** fix. Not yet in a tagged release.
- **[v1.9.0](CHANGELOG.md)** (2026-07-24) — security-hardening release that closed the entire [2026-07 audit](audit-2026-07.md): item-level authorization sweep, SSRF guards (CalDAV / CardDAV / Immich), session absolute lifetime, OAuth state nonces, service-worker cache fix, path-traversal validation, dependency-advisory bumps, correctness fixes (rate-limit lockout, weather timezone buckets, Google 404 auto-disable, travel-globe deps), and an Immich v3 album-sync fix.
