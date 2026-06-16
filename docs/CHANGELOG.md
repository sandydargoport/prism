# Changelog

All notable changes to Prism are documented in this file.

## Unreleased

### Fixed — Security / Login
- **5–6 digit PINs can now actually be used.** PIN length is now a uniform family-wide setting (4–6 digits, like an iPhone passcode) — chosen in the setup wizard and changeable in Settings → Security. Previously PIN *creation* allowed up to 6 digits while every login/unlock pad was hard-coded to 4 and auto-submitted at 4, so any 5–6 digit PIN could never be entered and the member was locked out. All five PIN surfaces (login, settings gate, quick-switch, away-exit, babysitter-exit), `PinEditModal`, and the family API now read and enforce the configured length. Added `scripts/reset-pin.js` for offline recovery of a locked-out member. Closes [#123](https://github.com/sandydargoport/prism/issues/123).

## [1.8.8] – 2026-06-16

### Changed — Mobile
- **Per-person list views become a swipeable carousel on phones**: Chores, Tasks (flat + nested), Wishes, and Gift Ideas all switch to a CSS scroll-snap carousel when viewed on mobile with more than one group — each profile takes the full viewport width and the user swipes left/right between people while still scrolling vertically inside the active profile's list. Desktop / tablet behavior unchanged (min-width columns + horizontal scroll). Cleaner than the previous "1.5 profiles visible at 220 px each" feel on phones.

### Fixed — List views
- **Chores person filter now actually filters the rendered columns**: `ChoresView`'s `choresByUser` memo iterated every family member when building columns, so selecting a single-person filter under Group:Person still showed empty columns for everyone else. Tasks and Wishes already filtered correctly; Chores now matches. Unassigned column also hides when a person filter is active (the user explicitly asked to see only those people).
- **Per-person grids no longer squeeze when the family is large**: Chores, Tasks (flat + nested), Wishes, and Gift Ideas all used `grid-cols-2 md:grid-cols-3` which crammed 7 people (5 kids + 2 adults) into 3 narrow columns × 3 rows on a portrait tablet. Switched all five views to `gridTemplateColumns: repeat(N, minmax(220px, 1fr))` + `overflow-x-auto`. Each column gets at least 220px; if the viewport can't fit every column comfortably, the grid scrolls horizontally — same shape across all list views. Closes [#105](https://github.com/sandydargoport/prism/issues/105).
- **Desktop carousel reveal**: per-person carousels on Chores, Tasks (flat + nested), Wishes, and Gift Ideas now render left/right chevron buttons over the column area when more profiles exist than fit on screen — mouse users were otherwise stuck with no obvious affordance (touch users already had the snap-swipe gesture). New `CarouselArrows` component scrolls 85 % of the visible width per click and fades at the edges.
- **Tasks PersonFilter now hides unselected columns**: under Group:Person, picking a subset in the filter chip-bar dropped the unselected people's empty columns (and the Unassigned bucket) entirely, matching Chores/Wishes. `useTaskGrouping` takes a new `filterPerson` param and the column list is filtered before the grid renders.
- **Gift Ideas intermittent "Something went wrong" on refresh**: `useRef` for the carousel scroll container was placed after three conditional early returns (`!activeUser` / `loading` / `error`), so the hook count changed between renders depending on data state and React threw on roughly half of mounts. Moved the ref to the top of the component.
- **Wishes per-member cards now fill row height**: `WishesView` was missing the `h-screen flex flex-col` wrapper that Chores/Tasks/Shopping use, so `flex-1` on the content area never engaged and the columns collapsed to natural content height. Wrapper added and `MemberWishCard` root now stretches with `h-full` so the inner body's `flex-1 overflow-y-auto` engages.
- **Gift Ideas tab shares the PersonFilter with Wishes**: the filter chip-bar now also renders on the Ideas tab and the selection drives which member columns appear there. Previously Ideas always showed every member regardless of filter.

### Changed — Shopping
- **Mobile list switcher is now a swipe carousel**: on phones with more than one shopping list (Groceries / Costco / Home Depot / …), the horizontal pill bar collapses into a compact prev / dots / next indicator and swiping left/right inside the content area switches between lists. Single-list households see no affordance. Desktop 3-column category grid is unchanged — categories aren't peer entities (it's nice to see the whole list at once), but lists are, which is what makes the swipe metaphor fit only at the list level.

### Added — Triage
- **`needs-reply` auto-label workflow**: new `.github/workflows/needs-reply.yml` adds the `needs-reply` label to any issue/PR when a non-owner non-bot comments (or opens it), and removes the label when the owner replies. Triage view lives at [/labels/needs-reply](https://github.com/sandydargoport/prism/labels/needs-reply) — one navigable place to see everything an external user is waiting on.

### Fixed — Uploads
- **Photo and avatar uploads no longer 500**: the app container runs as uid 1001 (`nextjs`) but `scripts/install.sh` created the bind-mounted `data/` directory owned by the host user, so `fs.mkdir` under `/app/data/photos` (and `/app/data/avatars`) hit `EACCES` and every photo upload, 30-minute photo sync, and avatar upload failed with a 500. `install.sh` now `chown`s `data/` and `uploads/` to `1001:1001` via a throwaway root container (no host `sudo` needed), with a fallback warning and a troubleshooting note in the install docs for existing deployments. [#130](https://github.com/sandydargoport/prism/pull/130)

### Fixed — Backups
- **Photos, avatars and recipe images are now backed up off-site**: the backup container synced an empty `uploads/` directory while all user assets actually live under `data/` (`src/lib/config/runtime.ts`), so they never reached cloud storage. It now syncs `data/` (regenerable `photos/cache` excluded). The app container also only bind-mounted `data/photos`, leaving avatars and recipe images in the container's writable layer where they were lost on rebuild — the whole `data/` directory is now persisted. [#127](https://github.com/sandydargoport/prism/pull/127)
- **Backups verify the off-site copy before reporting success**: `rclone copy`/`sync` can exit 0 on a partial or silently-dropped upload, so a green healthcheck didn't prove the data actually landed. Added an `rclone check --one-way` pass before the success ping; any mismatch pings `/fail` instead. Also consolidated the duplicate cron + in-container database-dump jobs into the single container job (porting over the cron's healthcheck ping and dump size check), and fixed an rclone OAuth token-refresh error caused by mounting `rclone.conf` as a single file (which can't be rename-replaced — now seeded to a writable path at startup). [#127](https://github.com/sandydargoport/prism/pull/127), [#128](https://github.com/sandydargoport/prism/pull/128), [#129](https://github.com/sandydargoport/prism/pull/129)

### Fixed — Calendar
- **Task-only CalDAV sources no longer show a false "stale / failed" status**: iCloud reminder lists (no event component) never run the event-sync path, which was the only code that advanced `last_synced` and cleared `sync_errors` — so they appeared stuck on an old date with a stale error even while task sync ran cleanly every cycle. `syncCalDAVTasks` now refreshes those fields itself (and records task-sync errors for task-only sources), leaving event-capable sources' `sync_errors` owned by the event path. [#131](https://github.com/sandydargoport/prism/pull/131)

## [1.8.7] – 2026-06-01

### Fixed — Distribution
- **HA addon arm64 build now succeeds**: v1.8.6's release workflow shipped amd64 cleanly but the aarch64 matrix job died with `qemu: uncaught target signal 4 (Illegal instruction)` during `npm run build` — SWC (Next.js's Rust-based compiler) emits ARM NEON / SIMD instructions that QEMU TCG can't translate when running an arm64 binary on x86 host. Switched the arm64 matrix entry from `ubuntu-latest + setup-qemu-action` to GitHub's free public-repo native `ubuntu-24.04-arm` runner. Real ARM hardware, no emulation, no instruction-set gap. arm64 build time should now match amd64 (~5 min) instead of 30-60 min QEMU. Both `ghcr.io/sandydargoport/prism-ha-amd64` and `ghcr.io/sandydargoport/prism-ha-aarch64` should publish on tag pushes from this version onward.

## [1.8.6] – 2026-06-01

### Fixed — Distribution
- **HA addon release pipeline now builds successfully**: v1.8.5's tagged release was the first run of the release pipeline and exposed two compounding bugs — the addon `Dockerfile` used `apt-get` (Debian) against HA's Alpine-based supervisor base images, and even with `apk add` HA's base ships Node 20 while `package.json` requires Node ≥24. Switching the addon base from `ghcr.io/home-assistant/<arch>-base` to `node:24-alpine` resolves both: it's a published multi-arch image with the guaranteed Node version and lets HA Supervisor run the container as-is (Supervisor doesn't care which base the addon uses). `apt-get` block rewritten as `apk add` with Alpine package names; `run.sh` switched from Debian-style `/usr/lib/postgresql/15/bin/` paths to bare `initdb` / `pg_ctl` on PATH. Surfaced by @joe-cole1 in [#81](https://github.com/sandydargoport/prism/issues/81).

### Added — SEO / Docs
- **`SoftwareApplication` JSON-LD in the docs site**: structured-data entity card crawlers + LLM trainers can scrape without parsing prose — `applicationCategory`, `offers.price: 0`, `operatingSystem`, `alternateName` (de-disambiguates from GraphPad Prism / LaTeX Prism), `featureList` with 13 capabilities. Plus a `<meta name="keywords">` cluster with `glassmorphism dashboard`, `Skylight alternative`, `Dakboard alternative`, `MagicMirror alternative`, etc. Hidden from human readers (lives in `<head>` + the already-hidden `alternatives.md`) — respects the PR #87 walk-back of marketing-toned prose in user-facing surfaces.

## [1.8.5] – 2026-06-01

### Added — Distribution
- **Home Assistant addon** (`ha-app/`): Prism can now be installed as a one-click HA addon via custom repository. Bundled Postgres + Redis run inside the addon container; all state lives under HA's `/data` volume and survives addon updates. New `src/lib/config/runtime.ts` adds `isHaMode()` plus `getDataRoot()` / `getPhotosRoot()` / `getAvatarsRoot()` helpers so photo and avatar storage automatically use `/data/{photos,avatars}` in HA mode; `PRISM_HA_MODE`, `PRISM_DATA_ROOT`, `PRISM_PHOTO_ROOT`, and `PRISM_AVATAR_ROOT` env vars are respected. Standard tier (single all-in-one container, no nginx/cert work) — matches the install-friction constraint surfaced in [#81](https://github.com/sandydargoport/prism/issues/81).
- **HA addon release pipeline** (`.github/workflows/release.yml`): tag-push (`vX.Y.Z`) triggers a multi-arch build (amd64 + aarch64 via QEMU) and publishes to `ghcr.io/sandydargoport/prism-ha-<arch>:<version>` + `:latest`. `ha-app/config.yaml` now references `image: ghcr.io/sandydargoport/prism-ha-{arch}` so HA Supervisor pulls the pre-built image (~30 s install) instead of building from source on the user's host (~10 min). `scripts/check-version-sync.sh` extended to fail if `ha-app/config.yaml` drifts from `package.json`; `scripts/release.sh` bumps all three (package.json, CHANGELOG, ha-app/config.yaml) in lockstep. Closes [#104](https://github.com/sandydargoport/prism/issues/104). Also unblocks the install failure surfaced on issue #81 — the original addon Dockerfile used multi-stage paths that don't work under HA Supervisor's `ha-app/`-scoped build context; the Dockerfile is now self-contained (clones source via git at build time) and only used as a fallback when the published image isn't available.

### Added — Settings
- **Consolidated Integrations page** (`/settings?section=integrations`): one card per provider brand — Google (Calendars + Tasks), Microsoft (incl. OneDrive), Bus tracking (Gmail), Apple/CalDAV, Kroger — plus a cross-provider Photo Sources card. Each card has a connection status badge and collapsible sub-sections for per-feature wiring; the Account row sits at the top of each card so disconnect / re-auth controls are reachable in one expand. URL anchors (`#microsoft-onedrive`, `#gmail-bus`, `#caldav-calendars`, etc.) deep-link straight to a sub-section. Ships alongside the legacy Connected Accounts / Task Sync / Shopping Sync / Wish List Sync / Photos sections; cleanup pass removing the legacy sections will follow once parity is verified on real accounts. Closes phase 1 of [#52](https://github.com/sandydargoport/prism/issues/52).

### Fixed — Settings
- **Sub-section links inside Integrations cards now navigate**: `SettingsView` read the `?section=` query param only at mount, so when an Integrations card's "Open Calendars settings" link changed the URL the content panel stayed put. Added a `useEffect` that syncs `activeSection` with the live URL.

### Changed — Integrations
- **OAuth callbacks land on the Integrations page when initiated from it**: Google, Google Tasks (errors), Microsoft (OneDrive), and Microsoft Tasks (errors) callbacks now honor a `returnSection=integrations` flag bubbled through OAuth state, redirecting to `?section=integrations#<provider>` with the right sub-section auto-expanded. Legacy callers (the still-mounted Connected Accounts section, etc.) keep their existing destinations. Step toward removing the legacy sections — phase 2A of [#52](https://github.com/sandydargoport/prism/issues/52).

### Removed — Settings
- **Connected Accounts section retired**: fully replaced by the Integrations page in phase 1. The legacy `?section=connections` URL still works — `SettingsView` redirects it to `?section=integrations` so OAuth callbacks in flight at deploy time, bookmarks, and the few remaining cross-links (Calendars page, Task Sync page) all land somewhere sensible. Sidebar nav entry gone; section file deleted. Phase 2B-1 of [#52](https://github.com/sandydargoport/prism/issues/52).
- **Task Sync / Shopping Sync / Wish List Sync nav entries retired**: per-list wiring UI is now embedded directly inside the Microsoft and Google provider cards on the Integrations page — no more page-jump to manage which Prism list maps to which Microsoft To-Do / Google Tasks list. Sections still exist as embedded components, no longer reachable as standalone pages. `?section=tasks` / `shopping` / `wish` URLs (bookmarks, in-flight OAuth callbacks) redirect to Integrations. OAuth callbacks update to land on `?section=integrations#microsoft-tasks` etc. when initiated from the new cards (legacy `?section=tasks&selectMsList=true` flows still work via redirect). Phase 2B-2 of [#52](https://github.com/sandydargoport/prism/issues/52).

### Fixed — Mobile
- **/settings now reachable on iPhone PWA**: `MobileNav` had no Settings entry, so a Prism installed as a home-screen PWA on iPhone had zero path to settings (the original "PWA can't reach Photos settings" report turned out to be the entire route being unreachable, not a Photos-specific link). The More menu now includes Settings, and the desktop sidebar collapses to a section selector on `<md` viewports so every section remains reachable after landing.

### Fixed — Dashboard
- **Grid no longer locks to interim cold-boot viewport on slow-launching kiosks**: `LayoutGridEditor` computed `visibleRows` and `cellSize` from `window.innerHeight` inside a `useMemo` with no resize listener, so the values were frozen at mount time. On a Wyse thin client booting before its window manager finalized the work area, the dashboard rendered against the smaller interim viewport and stayed that way until the user manually refreshed. New `useViewportSize` hook subscribes to `resize` + `orientationchange` and feeds both memos so the grid re-measures when the viewport settles. Closes [#73](https://github.com/sandydargoport/prism/issues/73).

### Added — Docs
- **Apple iCloud integration overview** (`docs/features/ICLOUD.md`): single-page summary of which iCloud surfaces Prism can integrate and which it can't, with the structural rule (open IETF standards work, CloudKit dead-ends don't). Covers Calendars, Contacts, Reminders, Notes, Photos (shared + library), Find My, Health, iMessage, Apple Music. Cross-linked from Calendar and Photos guides. Saves prospective users from "wait, can't we just pull X from iCloud?" investigations that always hit the same wall.

### Changed — Docs
- **Photos guide drops the "iCloud Shared Album coming in a follow-up" hint**: Phase B of the photo sources work was abandoned in late May after Apple migrated public share URLs to a CloudKit-only backend with no public API. The Photos doc now points at OneDrive + the iOS Shortcut as the canonical iPhone path and links to ICLOUD.md for the explanation.

## [1.8.4] – 2026-05-23

### Added — Integrations
- **CalDAV / Apple iCloud (read-only)**: Connect any CalDAV server — Apple iCloud (`https://caldav.icloud.com`), Nextcloud, Radicale, Baikal, Synology — from *Settings → Connected Accounts → CalDAV*. Username + app-specific password, encrypted at rest. Discovery picks calendars + Reminders lists; events sync into the same `events` table as Google/iCal, VTODO items into `tasks`. New API surface: `POST /api/caldav/{test,discover,connect}`. Documented in `docs/features/CALENDAR.md`. Validated against a real iCloud account during the shakedown — known Apple-side limitation: Reminders lists migrated to CloudKit (most modern iCloud accounts) return placeholder VTODOs only, not actual reminders. The integration filters those placeholders so they don't pollute Tasks, and doesn't materialize a Prism task list for any CalDAV source that returns only placeholders.
- **iCloud Contacts → birthdays via CardDAV**: Optional checkbox on the CalDAV connect dialog ("Also import birthdays from contacts"). Same login, CardDAV protocol, auto-swaps the iCloud hostname from `caldav.icloud.com` to `contacts.icloud.com`. Every vCard with a `BDAY` field feeds the birthdays table. Handles Apple's quirky "no year given" sentinel (literal year `1604`) by mapping it to the 1904 year-omitted convention. Manual re-sync via `POST /api/caldav/sync-birthdays`; otherwise rides the existing 10-minute calendar sync cron.
- **Cross-source birthday dedup**: A calendar event titled "Alex's birthday" (regex-stripped to "Alex" by the Google sync) and an iCloud vCard with FN "Alex Doe" no longer create two birthday rows for the same person. The `upsertBirthday` helper merges by token-prefix + same month/day, keeps the longer name, and prefers the non-1904 year when one source has a real birth year. Conservative: same first name + different last names ("Jordan Smith" vs "Jordan Doe") are treated as distinct people.

### Added — Dashboard
- **Save As → overwrite existing dashboard**: The Save-As flow no longer just creates a new dashboard via a name prompt. The new dialog lists every existing dashboard with an "Overwrite [name]" button (with a confirm step) and a separate "Save as new" input. Overwrite preserves the target's name, slug, and default flag — only widgets + screensaver + orientation are swapped.

### Changed — Dashboard
- **Default dashboard `/` honors Display Settings → Font Scale**: The zoom wrapper that scales a dashboard up or down lived only at `/d/[slug]/layout.tsx`, so the slider had no visible effect on the main dashboard. `src/app/page.tsx` now fetches the default layout's `fontScale` and applies the same wrapper.
- **Dashboard-switch flash eliminated**: When activating or switching dashboards, the brief loading window used to render `DEFAULT_TEMPLATE` (weather UL, clock UR, meals bottom) under the page chrome before the saved layout fetched. Established users perceived this as "Prism flashed a different dashboard." During the API-fetch window the dashboard now renders empty for the same fraction of a second; the `DEFAULT_TEMPLATE` fallback fires only when no saved layout exists at all (genuine first-run).
- **Per-widget text scale (S/M/L/XL) works on the dashboard, not just the screensaver**: The `zoom: textScale` CSS lived on the grid-cell wrapper, which interacts inconsistently with CSS grid layout. Moved onto the inner content wrapper so the dashboard renders apply it the same way screensaver does.
- **Widget picker alphabetized on both sides**: The visible-widgets table in the Widgets popover followed `WIDGET_REGISTRY` insertion order while the "+ Add widget" picker was sorted alphabetically — so Birthdays and Bus Tracker showed up in arbitrary positions on the left and alpha-positioned on the right. Both views now sort by widget label.
- **Clock widget can shrink to a slim strip**: `minH` lowered from 8 to 4 grid rows. Defaults unchanged.

### Changed — Widgets / Weather
- **Forecast pill track stays visible under any custom text color**: The 7-day forecast row uses a pill background that previously read `bg-muted-foreground/25`. `WidgetContainer` overrides `--muted-foreground` to match the user-chosen text color (so headings inherit), which turned the pill into white-on-white when white text was picked and into a faded tint of any other chosen color. The pill bg + ring now use `bg-black/10 dark:bg-white/15`, decoupled from the text-color override.

### Changed — Auth
- **Settings PIN gate modal tightened**: Mirrors the spacing pass applied to QuickPinModal — smaller padding, tighter avatars, smaller PIN dots and number-pad buttons. Touch targets stay at 48px (above the 44px Apple HIG minimum).
- **Sign-in toast fires for every blocked mutation**: When a signed-out viewer edits a field, ticks a chore, adds a shopping item, or otherwise attempts any `/api/*` mutation, the call returned 401 and the UI silently failed to update — no signal that auth was the cause. A global `window.fetch` interceptor in `AuthProvider` now catches mutation 401s and toasts "Sign in to make changes — Enter your PIN to save edits." Debounced 2.5s so a save burst fires one toast, not ten. Suppressed while the PIN modal is already open. Limited to `/api/*` paths and POST/PUT/PATCH/DELETE so third-party fetches and the initial session-check GET aren't affected.

### Changed — Integrations
- **Gmail/bus "Token expired" false alarm removed**: The integration status surface used to warn whenever the stored `expires_at` was in the past. Gmail access tokens have a 1-hour TTL, so the warning fired for hours after every reconnect even though `bus-tracking-sync.ts` was auto-refreshing silently on the next tick via the stored refresh token. Genuine refresh failures (TokenRevokedError) delete the credential row outright, flipping the badge to "Not Connected" — that's the only user-actionable failure. Stopped exposing `expiresAt` from `/api/integrations/status` and dropped the warning UI.
- **Task provider picker no longer lists Todoist + Apple Reminders as "Coming soon"**: Both were hardcoded `disabledProviders` entries with no roadmap behind them. Apple Reminders is permanently impossible (CloudKit-only). Todoist isn't on the build list.

### Changed — Weather
- **Sun + moon info now in the header row**: Sunrise (lucide `Sunrise` icon, amber) and sunset (`Sunset`, orange) times sit alongside Feels Like / Humidity / Wind in the upper-right of the weather widget. A moon-phase glyph + phase name (e.g. "Waning Gibbous") sits on its own line above the sun row.
- **Daylight arc still carries its anchor strip**: sunrise / "Xh Ym" duration / sunset under the curve.

## [1.8.3] – 2026-05-22

### Added — Dashboard
- **Double-tap any widget to magnify it** (interactive Dashboard only). The widget snaps to a centered ~84vw × 84vh modal with the rest of the dashboard dimmed behind. Auto-collapses after 8 seconds of inactivity (timer resets on any tap or scroll inside the magnified widget), or immediately on Escape / backdrop tap. Re-renders the widget at the larger size so any compact-mode threshold (e.g., Weather widget's `gridW < 12` mode) unwinds into the full layout. Gated to the interactive render path only — Screensaver, Away Mode, and Babysitter Mode don't wrap their widgets in the provider, so the handler isn't attached there.

## [1.8.2] – 2026-05-22

> Adds an MCP server (`.mcp/`) that exposes Prism's REST API as Model Context Protocol tools, so AI clients (Claude Desktop, Claude Code, Cursor, Gemini CLI, Gemini Code Assist, VS Code Copilot Chat) can read and write family data through natural-language chat.

### Added — Integrations
- **MCP server for Prism (`.mcp/`)**: Self-contained Model Context Protocol server that exposes the Prism REST API as MCP tools, so AI clients (Claude Desktop, Claude Code, Cursor, Gemini CLI, Gemini Code Assist, VS Code Copilot Chat) can read and write chores, tasks, events, shopping, messages, meals, goals, recipes, maintenance, points, weather, and family data directly from a chat window. Uses the existing API-token auth (Settings → Security → API Tokens) via env vars in the client config. Built on `@modelcontextprotocol/sdk` v1.29+ with stdio transport. Returns both legacy `content` text and modern `structuredContent` objects (2025-06-18 spec) so parsed-object-aware clients can skip a JSON parse step. Future remote/hosted variant would use Streamable HTTP + OAuth 2.1 per spec 2025-11-25 — current build is local-subprocess only. See [the `.mcp/` README on GitHub](https://github.com/sandydargoport/prism/tree/master/.mcp) for setup.

## [1.8.1] – 2026-05-21

> Weather widget overhaul (sun + moon on one altitude arc, red→orange→amber gradient by altitude, per-day moon phase glyphs, Apple-style temperature pill tracks), bus tracker fixes for the duplicate AM school stop and PM route ordering, and a round of layout editor polish (smarter widget placement, alphabetized add menu, sign-in gate, edit-mode click protection).

### Added — Weather
- **Sun + moon altitude arc**: The daylight chart plots both bodies on the same 24-hour timeline, with peak heights driven by true celestial altitudes from `suncalc` (zenith = full arc height, sub-zenith proportionally smaller). Summer sun visibly arcs higher than winter sun, and the moon arc varies with declination. Sun arc is colored by altitude via an SVG `linearGradient` — red at the horizon, orange at low altitude (~25°), amber at zenith — matching the atmospheric-scattering color shift you'd see in the sky. Sun dot's fill follows the same altitude bucketing so a low sun glows red/orange. Moon arc is blue when above horizon, muted slate below; the moon glyph at the current position renders the actual phase shape (full = filled circle, new = outlined empty circle, crescents and gibbous show only the lit fraction). `WeatherData` now carries `moonrise`, `moonset`, `moonPhase`, `moonIllumination`, `moonPhaseName`, `lat`, `lon` from all three providers (Open-Meteo, OpenWeatherMap, Pirate Weather) via a shared `src/lib/integrations/moon.ts` helper. `suncalc` is purely local — no API key or network call.
- **Per-day moon phase glyphs**: A small phase glyph sits next to the weather icon on every multi-day forecast row. Phase is computed locally via `suncalc.getMoonIllumination` at the day's local noon (phase angle is global, no lat/lon needed).
- **Apple-style unified temperature pill track**: Each forecast day's temperature range now sits inside a full-width pill track that's the same width across every row, so the colored bars align visually instead of starting at different X positions. The day's range within the week's min/max is shown by the position and width of the inner colored bar. Track background uses `bg-muted-foreground/25` plus a thin 1px inset ring so the container reads as a defined edge.
- **Daylight duration tinted amber**: The "Xh Ym" label between sunrise and sunset is now amber to match the sun arc instead of muted gray.

### Added — Layout Editor
- **Smarter widget placement**: New widgets land in the first free slot — scan top-to-bottom, then left-to-right inside each row — instead of stacking at the bottom. Top-row gaps get filled first; if a row has horizontal room, the widget slots in next to existing ones. Six-case jest suite covers empty grid, side-by-side fit, full-row fallthrough, top-row-gap fill, hidden-widget skip, and custom grid width.
- **Alphabetized Add Widget dropdown**: Hidden widgets in the dropdown sort by display label so "Bus Tracker" lands under B rather than its internal `busTracking` id.
- **"Mini-map" rename**: The left toolbar's popover button (mini-map thumbnail + screen-size toggles + validation issues) is now labeled "Mini-map", distinct from the right toolbar's "Preview" (which toggles the measure-mode render at a target screen's actual dimensions). Two buttons named "Preview" had been doing different things.
- **Sign-in gate for edit mode**: Clicking the Edit button while signed out now toasts "Sign in to edit — log in as a parent to edit the dashboard layout" rather than silently doing nothing. The button stays hidden for children (signed in as a non-parent role). The sessionStorage edit-flag re-entry now requires `activeUser.role === 'parent'` so a stale flag can't re-engage edit mode after a logout.
- **No accidental navigation in edit mode**: Internal widget links and buttons (e.g. the Travel widget's "Open the map →") can't navigate away mid-edit and discard unsaved layout changes. `pointer-events: none` on the widget content swallows clicks while drag + widget select still work because both bubble up to the outer wrapper's `onClick` and dnd-kit listeners.

### Bug Fixes
- **Bus tracker — duplicate school stop on AM, PM ending at school instead of home**: The train map rendered both a "School" checkpoint (placeholder name from FirstView email ingestion) and a separate `schoolName` diamond, producing a duplicate node at the end of AM routes. PM routes ended visually at the school checkpoint instead of the family's home stop. `buildNodes` now recognizes "Home"/"School" checkpoints (case-insensitive, and matches against the route's `stopName`/`schoolName` proper noun) as the same semantic terminals, then arranges them by direction: AM = [intermediates, home, school-diamond], PM = [school-diamond, intermediates, home]. The PM school diamond carries an `isOrigin` flag so it lights up the moment any PM event has fired — guard for legacy routes where the school checkpoint sortOrder doesn't match the chronological start.
- **Weather widget Date hydration**: Moonrise and moonset Date objects were lost in the JSON round-trip from `/api/weather` to the client; `SunriseSunsetArc` then threw `"moonrise.getTime is not a function"` on the string forms. `transformWeather` now hydrates moonrise/moonset alongside the existing sunrise/sunset, forecast.date, and hourly.time fields.
- **Mobile dashboard data never populated**: Cards stayed on "No tasks" / "No upcoming events" / "Lists are clear" even though `/api/*` returned real data. Both `Dashboard.tsx` and `MobileDashboard.tsx` were independently calling `useDashboardData()`, causing every domain hook to fire twice in parallel against the same URL. The duplicate inside StrictMode's dev double-mount left MobileDashboard's `useFetch` permanently stuck at `loading:true, data:[]`. Fix: lift the data hook to a single call in `Dashboard.tsx` and pass it to `MobileDashboard` as a prop — halves the network traffic on dashboard load and eliminates the race.

### GitHub / Docs
- **Stale bot + issue templates**: Added `.github/workflows/stale.yml` to auto-close inactive issues / PRs and `.github/ISSUE_TEMPLATE/` for structured bug and feature submissions.
- **README — install commands collapsed by default**: Both Quick Start options are now wrapped in `<details>` blocks so the README narrative ("Behind the project", contributing, roadmap voting) sits closer to the top of the page.

### Internal
- **Screenshot capture: detect Unicode ellipsis in loading states**: `waitForContentReady` regex now matches both `...` and `…` so the weekend page (which renders "Loading…") no longer gets captured mid-fetch. Bumped `weekend` `settleMs` 1000 → 3000 as a safety margin.

## [1.8.0] – 2026-05-17

> Send-to-Kroger cart push (every Kroger banner, OAuth per-user, SKU picker with normalized unit prices and per-item caching), recipe import from pasted OCR text with section-aware ingredients and ½×–4× scaling pills, server-side calendar sync cron with a ±90/365-day window, mobile PWA becomes agenda-only, plus the foundation Voice API for the upcoming Alexa / Home Assistant integration. Same `git pull && docker-compose up -d --build` upgrade.

### Added — Shopping
- **Send to Kroger (and every Kroger banner: Mariano's, Ralphs, King Soopers, Fred Meyer, QFC, Smith's, Fry's, Harris Teeter, Pick 'n Save, Metro Market, Pay Less, Food 4 Less, Foods Co., Bakers' Plus, City Market, Copps, Dillons, Gerbes, Jay C, Ruler Foods)**: Push your Prism shopping list straight into your online Kroger cart for pickup or delivery. Per-user OAuth 2.0 with encrypted token storage in a new `user_kroger_connections` table. A picker walks you through each item with up to 5 SKU candidates, image, price, and a normalized unit price (lb / fl oz / ct) so candidates within a page are directly comparable. Quantity controls let you bump cart count, "search again" lets you refine when the parser strips too much, and the chosen SKU is cached per shopping item (`shopping_items.kroger_product_id`) so weekly staples become one-tap after first pick. Per-user store picker via Kroger's Locations API binds location-aware pricing to your preferred Mariano's (or any banner). Settings → Shopping has the connect/disconnect flow plus inline credentials entry — no setup-wizard re-run needed. Dynamic OAuth redirect URI so a WAN https hostname and a LAN `192.168.x.x:3000` URL both work if both URIs are registered on the Kroger dev app.
- **Recipe ingredients can carry section headings**: Lines like `Fries:` or `Meatballs:` inside an ingredient list are now stored as `{ heading }` entries alongside the existing `{ text }` entries. Rendered bolded in the recipe detail; filtered out of the add-to-shopping-list payload (they're visual grouping, not items).

### Added — Recipes
- **Import recipe from pasted text**: New "Paste recipe text" entry in the Recipes Add menu. Heuristic parser splits OCR'd / clipboard text into title (AP-style title-cased, with `a / an / the / and / or / for / of / with` and friends staying lowercase mid-title), prep/cook/total time, servings, ingredients, and instructions. Recognises `Ingredients:` / `Instructions:` section headers, "Step N:" prefixes, comma modifiers ("seeded and sliced", "peeled and deveined"), `" or "` alternatives, parentheticals, and inline step markers ("1. Preheat. 2. Mix." gets line-broken). Pre-fills the existing recipe form so the user reviews before saving. Designed for iOS Live Text from a photo of a recipe card.
- **Per-recipe photo upload**: Each recipe can carry its own image. Phone camera or photo library (no `capture` attribute — iOS shows the native sheet), saved at `data/recipe-images/<recipeId>.jpg`, served via `GET /api/recipes/<id>/image`, sharp pipeline (auto-rotate from EXIF, resize to ≤1200px, JPEG quality 85). Replace / Remove controls inline in the form. ≤10MB, magic-byte validated, rate-limited.
- **Recipe scaling — quick ½× / 1× / 2× / 3× / 4× pills**: Detail modal shows pill buttons next to the +/- servings adjuster. Active multiplier highlights. ½× rounds up to the nearest whole serving so a 3-serving recipe lands on 2.
- **Recipe shopping items scale on add**: `scaleIngredient` applies the active multiplier to the ingredient text when sending to the shopping list, not just visually in the modal.

### Added — Calendar
- **Server-side calendar sync cron**: A 10-minute `setInterval` in `instrumentation.ts` (delegated to a node-only `lib/server/calendarSyncCron.ts` so the edge bundle isn't dragged into node-ical / node:crypto chains) keeps Google + iCal calendars in sync without depending on anyone having the dashboard or calendar page open. Sync window expanded from ±30 days to −90 / +365 so far-future school-year, sports-season, and holiday-card events actually show up. Events outside the window stay in the DB forever — the delete-on-remove pass only operates inside the window. Disable with `PRISM_DISABLE_CALENDAR_CRON=true`.
- **Mobile PWA: calendar is agenda-only**: Mobile viewport no longer renders the Agenda/Day toggle, prev/next chevrons (no-op for agenda), or Today button. Header reads "Upcoming Events". useEffect forces agenda on mobile.

### Added — Voice / API tokens (carried from earlier work in this Unreleased block)
- **Voice API foundation (`/api/v1/voice/*`)**: New versioned, token-authenticated API surface for voice and home-automation integrations. First endpoint: `GET /api/v1/voice/calendar/today` returns today's events with a pre-formatted natural-language `spoken` field (`"Today you have Soccer Practice at 4 PM."`) so callers don't need their own templating. Reuses the existing `apiTokens` Bearer-token system; per-token rate-limited at 60 req/min. Documented in `docs/voice-api.md`. Phase 1 of the Alexa + HA distribution plan — additional intents (shopping/add, chore/complete, calendar/upcoming, etc.) coming in follow-ups.
- **Voice token scope (`voice`)**: `withAuth` now supports a `tokenScope` option that rejects session-cookie callers and requires an API token whose scopes include either the named scope or `*`. The Voice API uses `tokenScope: 'voice'` so a leaked browser session cannot reach it, and Voice tokens issued with `scopes: ['voice']` are confined to `/api/v1/voice/*` (vs. the legacy `['*']` default which grants full account access). Token-creation validator now restricts scopes to the known set `['*', 'voice']`.
- **Voice API endpoints**: Six new endpoints filling out the `/api/v1/voice/*` surface — `GET /family`, `GET /calendar/upcoming`, `GET /tasks/today`, `POST /shopping/add`, `POST /chore/complete`, `POST /message/post`. Each returns the shared `{ ok, spoken, data }` shape. `chore/complete` enforces the documented security rules: completions inherit the chore's `assignedTo`, voice cannot bypass `requiresApproval` (pending completions stay pending until a parent approves in-app), and ambiguous chore names (e.g. both children have "Feed the dog") return an `ok:false` disambiguation prompt with `data.candidates` for the caller to resend with `assignee`. Phrase-builder tests grew from 7 to 18 cases covering the new spoken templates.
- **API token scope picker in Settings**: The Security section's token issuer now shows a scope dropdown ("Voice API only" / "Full access (legacy)") and the issued-token list shows each token's scopes as a colored badge (Voice = blue, `*` = amber). Voice is the default — picking the smallest scope that works means a leaked token can't reach data outside its surface.

### Bug Fixes
- **Shopping items — rate limit raised 30/min → 120/min**: Recipe imports add ingredients one-by-one in a sequential loop; long lists were hitting the cap with "Failed to add item: too many requests". Proper fix (a batch endpoint) is a follow-up.
- **Mobile calendar header overflow**: Picker modal now fits an iPhone in portrait by trimming dialog padding, gap, image size, and price-column fixed width. Product names wrap to 2 lines instead of truncating. Review-screen items break-words.
- **Calendar — recipe form / shopping list error visibility**: "Failed to save recipe" / "Failed to add ingredients" / "Failed to remove photo" now propagate the actual server error so a stuck user can self-diagnose.
- **Shopping list — assigning to a family member**: Members whose `id` wasn't exposed (unauthenticated `/api/family` returns `id=''`) are filtered out of the assign-to picker so selecting them can't silently set `assignedTo=''` and fail validation.
- **Recipe photo — iOS file input**: Removed `capture="environment"` so iOS shows Photo Library / Take Photo / Files instead of forcing the back camera.
- **Meal page order**: Snack now appears between lunch and dinner (matching `CalendarView.sortMealsByType`) instead of after dinner.

### Internal
- **Kroger picker — modifier-aware ingredient stripping for product search**: `parseShoppingQuantity` strips leading quantity + unit, then drops everything from the first comma, `" or "`, parenthetical, or `" to taste"` onwards, so `"1 Fresno pepper, seeded and sliced, or ½ teaspoon crushed red pepper flakes"` searches Kroger for `"Fresno pepper"`. Original text stays visible in the picker title; "Searching Kroger for X" subtitle shows the cleaned query. Manual override input lets the user refine without skipping the item.
- **Kroger picker — canonical unit per page**: For each item, detect the dominant dimension (weight/volume/count) across all candidates and show every same-dimension candidate's unit price in one canonical unit (lb / fl oz / ct) instead of mixing $/oz against $/lb. Mismatched-dimension outliers keep their native unit.
- **Kroger — Cloudflare-tunnel-safe redirect**: OAuth redirect URI is now derived from the incoming request's `X-Forwarded-Host` / `X-Forwarded-Proto` and persisted in Redis with the state token so the callback's `/token` exchange uses the byte-exact URI Kroger requires.

## [1.7.2] – 2026-05-02

> Same-day patch follow-up: forecast past-day filter across all weather providers + a developer-experience fix for `npx jest`.

### Bug Fixes
- **Weather — forecast skips stale past-day entries (OWM, Pirate, Open-Meteo)**: When a cached weather response was generated before local midnight, the 7-day forecast would open with the **previous** local day (e.g. "Thu" on a Friday) until the cache TTL expired. Affected all three providers via three different mechanisms: OWM 3-hour intervals starting on non-zero UTC boundaries, Pirate Weather's pre-aggregated `daily.data[0]` carrying yesterday, and Open-Meteo's `daily.time[0]` doing the same. Each provider now filters past-day buckets server-side, and `WeatherWidget` adds a defense-in-depth client-side filter so a still-warm cache can't leak yesterday into the UI. The "N-Day Forecast" heading now matches the actual visible day count. Thanks to **@iann** for the diagnosis and the OWM/Pirate fix in PR #27 (merged via #31).

### Internal
- **Local jest no longer fails on integration tests**: `src/lib/db/__tests__/integration.test.ts` now self-skips when `E2E_HAS_TEST_DB !== '1'` so `npx jest` runs clean on a dev machine that doesn't expose Postgres on localhost:5433. CI keeps the same shape (no real DB → suite skips → unit-tests job stays green).

## [1.7.1] – 2026-05-02

> Patch follow-up to v1.7.0. Three small fixes surfaced by post-release verification: a stale-cache trap when switching weather providers, three tables missing from the fresh-install schema snapshot, and an e2e-test chicken-and-egg around the public `/api/family` response.

### Bug Fixes
- **Weather — provider in cache key**: Switching `WEATHER_PROVIDER` (e.g. `openweather` → `meteo`) used to serve a stale response shaped by the previous provider until the 10-minute TTL expired (manual mitigation: `redis-cli DEL weather:<location>`). Cache key now embeds the active provider, so a switch produces a non-colliding key automatically.
- **Fresh-install schema — travel_trips + weekend_***: `src/lib/db/init/02-schema.sql` was 3 tables behind master. `travel_trips` (v1.4 — Travel Map), `weekend_places` and `weekend_visits` (v1.5 — Weekend Ideas) are now created cleanly on first init. `test-fresh-install.sh` reflects the full v1.7 surface.

### Internal
- **e2e helpers — test DB isolation + auth fallback**: `helpers/reset.ts` and `visual-regression.spec.ts` now respect `E2E_DB_NAME` (default `prism`) so suites can target a synthetic test database. `helpers/auth.ts` `loginViaAPI` falls back to `memberIndex` when `/api/family` returns the redacted public response (id `''`, loginIndex set) — needed for any spec that logs in from a fresh page.
- **Weather — Open-Meteo provider, now the default** (carried over from the v1.7.0 unreleased section, shipped here): `WEATHER_PROVIDER=meteo` is the new zero-config default. No API key required. Tests cover lat/lon plumbing, env fallback, TZ-aware day labels, network error wrapping, and the no-API-key path.

## [1.7.0] – 2026-05-02

> Major calendar refactor (widget toolbar parity with the subpage, drag-and-drop in cards mode, ten view modes including 1W–4W and Schedule, click-to-edit on widget items) and a multi-provider weather system. The `/week` page is retired — the calendar subpage is now a strict superset.

### Added
- **Calendar — drag-and-drop everywhere**: Drag meals, chores, tasks, and events between days in cards mode across all calendar views (Day, List, Week, 1W–4W, Month, 3 Months, Agenda) and inside the dashboard CalendarWidget. Uses a 5px PointerSensor activation distance so drag and click-to-edit coexist on the same card. Drop targets in every cell via `DroppableOverlayCell`; `moveError` surfaces inline if the API rejects the move.
- **Calendar — click-to-edit from the widget**: Tasks, Chores, and Meals widget items open the same edit modals as the calendar subpage. Modals are lazy-loaded via `React.lazy` + `Suspense` so the dashboard's first paint isn't taxed.
- **Calendar — cards display mode**: New per-day card view (alongside the existing inline list view) renders meals at top, events in the middle, chores+tasks at bottom, with a dynamic per-cell capacity probe (`useCardCapacity`) that respects the current font scale and viewport. Overflow folds into a "+N more" popover so nothing is silently clipped. Toggle in the View Options gear; persists per surface (subpage and widget).
- **Calendar — view modes**: Subpage and widget now expose Agenda, Day, List, Schedule (week vertical), 1W, 2W, 3W, 4W, Month, and 3 Months. View dropdown gains stacked ▲▼ triangles for one-click cycling. Multi-week navigation now advances/retreats by `weekCount` weeks (was 1).
- **Calendar — view options**: Hide weekends (multi-week views), merge calendars into one column, show notes column (Day/Schedule), and overlay toggles for events/meals/chores/tasks. Settings persist to localStorage and the View Options trigger shows a badge when any toggle is non-default.
- **Calendar — meal/chore/task overlays**: Cards mode renders these alongside events on every view; bucket data comes from a shared `useDayBucketsForRange` so the subpage and widget see the same data with the same TZ handling.
- **Weather — multi-provider system**: `WEATHER_PROVIDER` env var (`meteo` | `pirate` | `openweather`) selects the active provider via a factory in `src/lib/integrations/weather.ts`. Default is `meteo` (Open-Meteo) — no API key required. `LocationParam` (string display name OR `{lat, lon}`) is the provider-neutral input.
- **Weather — Open-Meteo** (new default, zero config): WMO weather-code mapping, `timezone=auto` so day-of-week labels respect the response's local timezone, °F + mph units. No API key required. Activated automatically when `WEATHER_PROVIDER` is unset or `meteo`.
- **Weather — Pirate Weather** (Dark Sky-compatible, opt-in): sunrise/sunset arc, minutely precipitation forecast, hourly timeline rendered via `merry-timeline`. New `PIRATE_WEATHER_API_KEY` and `WEATHER_LAT`/`WEATHER_LON` env vars (see `.env.example`). Thanks to **@iann** for the original PR.

### Improved
- **Calendar widget — toolbar parity**: Layout now mirrors the subpage: Today | < > | View dropdown | View Options gear | Add Event. Today button gets explicit contrast classes for transparent vs normal mode (no more white-on-white). Calendar pill chips, view-mode persistence, and notes column all match.
- **Calendar — TZ correctness**: Forecast day-of-week labels now use `Intl.DateTimeFormat` keyed off the response's IANA timezone (was `getUTCDay()`, which rolled past midnight for late-evening users). Chore overdue stripes parse `nextDue` (a YYYY-MM-DD DATE column) as a local date instead of UTC, so today's chore isn't flagged overdue in negative-UTC zones. Same fix applied in `DayColumn`, `useDayBucketsForRange`, and the drag preview.
- **Calendar — month view bucket range**: CalendarWidget month view now spans the full 6-week rendered grid (start-of-week containing month start through end-of-week containing month end), so overlay items on leading/trailing days from neighboring months are no longer missing.
- **Calendar — meal sort order**: Aligned across `useDayBucketsForRange`, `useWeekViewData`, and CalendarView's `sortMealsByType` to chronological order (breakfast → lunch → snack → dinner), matching `MEAL_TIME_DEFAULTS` in `cells/itemTime.ts`. Previously the widget rendered a 3pm snack below a 6pm dinner.

### Bug Fixes
- **Calendar drag — task time-of-day preserved**: `moveTask` now accepts the original `dueDate` and preserves its hour/minute on the target date instead of hardcoding 23:59:59 (a 9am task no longer becomes 11:59pm after drag).
- **Calendar drag — multi-week capacity**: `MultiWeekView` cards-mode capacity now reserves space for the always-rendered overlay rows (meals at top, chores+tasks at bottom) in BOTH overflow branches via `useCardCapacity({ headerHeight, popoverHeight })`. Previously the no-overflow branch ignored overlay rows and dense days silently clipped chores/tasks with no `+N more` indicator.
- **ChoreModal / TaskModal — clearable due dates**: Both modals now allow explicitly clearing a previously-set due date. `ChoreModal` no longer falls back to `chore?.nextDue` when the input is empty; `TaskModal`'s `onSave` widens `dueDate` to `Date | null` and the API consumers (TasksView, CalendarView, Dashboard) forward `null` so the server's clear branch fires.
- **POST /api/meals — `mealTime` persisted**: `mealTime` field was destructured-then-not-inserted on creation, so meal time-of-day silently dropped on first save. Now persisted on both insert and the response payload.
- **CalendarWidget DndContext — `onDragCancel`**: Escape during a drag now clears `activeDragId` and any prior `moveError` (was leaving stale state).
- **CalendarWidget AgendaView — overlay props**: Widget's agenda view now receives `bucketsByDate`, `displayMode`, and `enableDnd` like the other six views — meals/chores/tasks no longer silently disappear in agenda mode.
- **WeekVerticalView merged-view**: Recognizes the synthetic `all` group the same way DayViewSideBySide does — meals/chores/tasks no longer drop in the merged column.
- **MonthView popover height**: Per-overlay-row reservation bumped from 20px to 26px (matches the actual sm-card + gap-1 height) so dense days don't push overlay items into clipped territory.
- **`displayMode` default**: Aligned across state initializers, ViewOptionsMenu's non-default-count badge, and both Reset-to-defaults handlers — `inline` is the first-load default everywhere. Eliminates the spurious `1` badge on first load and the "Reset to defaults flips the calendar layout" surprise.
- **`hideWeekends` toggle scope**: Tightened to multi-week only (the only view that honored it). Previously the toggle appeared in week / list / month view options and silently did nothing.
- **Cookie `Secure` flag (logout)**: `/api/auth/logout` now derives HTTPS from `x-forwarded-proto` like the rest of the auth path, so cookies cleared during logout match the `Secure` flag they were set with behind a TLS-terminating proxy.

### Internal
- **Code review modalities — multi-agent cloud review (`/ultrareview`)**: This release was reviewed in three rounds (24 candidate findings → 16 confirmed → all addressed) — caught wiring/units/TZ regressions on weather, drag-and-drop time-of-day loss, capacity miscalculations, default-state divergence, and several silent-clipping bugs that text-only review structurally misses. See `docs/code-review-modalities.md`.
- **`OverlayFlags` consolidated**: Single canonical definition in `useDayBucketsForRange`; cells/`DayColumn` re-exports.
- **Dead code cleanup**: `src/app/calendar/OverlaysToolbar.tsx` (created but never imported) removed; duplicate `format as fmt` import in AgendaView removed.
- **`/week` page retired**: `src/app/week/*` deleted, `useWeekMutations` moved to `src/lib/hooks/`. The calendar subpage is a strict superset.

## [1.6.0] – 2026-04-29

> Consolidates the previously-prepared (but never tagged) v1.5.2 PWA fixes with substantial reverse-proxy / install-flow reliability work, Performance Mode polish, and new CI gating.

### Improved
- **Performance Mode — extended scope**: Existing Performance Mode toggle now also stretches polling intervals (×2.5) and renders the Photo widget as a single static image instead of a slideshow. Auto-enabled on first load when the device reports ≤2 GB RAM or ≤4 CPU cores (`navigator.deviceMemory` / `hardwareConcurrency`); your explicit choice in Settings is always respected on subsequent loads. A subtle lightning-bolt badge appears in the dashboard header while active so you know what you're seeing. Existing `?perf=1` URL param continues to work for kiosk URLs.
- **Performance pass**: Polling now does a structural-shared compare on each fetch — when the new payload is byte-identical to current state (the common case), the existing reference is reused so React skips re-renders downstream. Wraps `useFetch` so every consumer benefits without any callsite changes. `prefers-reduced-motion` is now honored site-wide via standard accessibility CSS; full-screen celebrations (plane fly-by, seasonal goal scenes) skip their motion entirely under either reduced-motion or Performance Mode and fire their `onComplete` callback immediately. Lite-mode photo widget now requests the `?thumb=1` thumbnail variant instead of the full image. TravelWidget gained the `React.memo` wrapper its peers already had.
- **Default dashboard — set in app**: The layout editor's More menu now exposes "Set as Default" (becomes "Default Dashboard ✓" when active). The `/api/layouts/[id]/default` endpoint already existed; this wires the UI consumer.
- **Reverse-proxy install — fewer surprises**: Fresh installs behind nginx / Cloudflare / Caddy now Just Work. `install.sh` generates a missing `ENCRYPTION_KEY` (was a fresh-install setup-wizard failure); `verify-pin` and `logout` derive HTTPS from the per-request `x-forwarded-proto` header instead of a module-level constant, so the session cookie carries the `Secure` flag whether you're behind a TLS-terminating proxy or not.
- **Setup-wizard recovery**: `/api/family POST` now permits unauthenticated calls during setup (when no `setupComplete` row exists) and re-locks the moment setup finishes — fixes the chicken-and-egg "log in to set up your account" trap on fresh installs.
- **Migration reliability**: `scripts/migrate.js` now detects first-run by checking whether `0000_upgrade.sql` has been applied (not by table existence) and wraps each migration in a transaction. Recovers cleanly from partially-applied migration state instead of throwing.
- **Crypto key compatibility**: AES key derivation now falls back to `PIN_ENCRYPTION_KEY` when `ENCRYPTION_KEY` is unset — older installs that only had the PIN key continue to work without manual `.env` surgery.
- **About-page version**: Settings → About now shows the actual `package.json` version (was a hardcoded `1.1.0` for several releases). Health endpoints (`/api/health`, `/api/health/deep`) report the same source of truth.

### Bug Fixes
- **Performance Mode — light-mode widget white-out**: An `opacity: 1 !important` override on translucent surfaces forced widget bodies to solid `hsl(var(--card))`, which resolves to white in light mode — making muted/secondary content blend into the background while only chrome (titles, icons) stayed visible. Dropped the override; surfaces now show their original 85–95% translucency over the wallpaper, which reads correctly with or without backdrop-blur.
- **PWA tiles — weather blank**: Weather tile was reading a flat data shape; fixed to use the correct nested `WeatherData.current.temperature/condition/description` structure.
- **PWA tiles — meals wrong**: Meals tile (and rows-mode meals card) matched any meal with today's day name across all historical weeks. Now filters to the current week before looking up today's meal.
- **PWA tiles — bus 404**: Bus tile linked to `/bus` which does not exist. Removed the link; tile now shows status inline with no navigation chevron.

### Internal
- **CI gates**: New `.github/workflows/ci.yml` runs type-check + lint + jest + a gated reverse-proxy e2e suite + migration-replay on every push and PR to master. Catches the bug classes that text-only review structurally misses (deployment-shape, schema idempotency, cookie handling behind a proxy). See `docs/code-review-modalities.md` for the rationale.
- **Test debt**: Stale unit tests aligned with current code — session TTL constants moved to 7d/1d for the "stays logged in" UX; OneDrive test suite rewritten for the async credentialStore-based API.
- **PII denylist scanner** (`scripts/scan-pii.sh`): pre-push hook that fails if tracked files match a maintainer-curated personal denylist read from outside the repo. Closes the gap that text-only LLM review can't cover.

## [1.5.1] – 2026-04-19

### Bug Fixes
- **Shopping — category colors missing**: Grocery categories (produce, bakery, meat, dairy, frozen, pantry) were silently stripped from saved settings, causing list cards to render grey with no color and no Add Item button. Restored full category list in DB and made the hook backfill any missing defaults on load so this can't recur.
- **Shopping — category validation**: API rejected items added to general lists (Target, etc.) with non-grocery categories (clothes, housewares, etc.) because the Zod schema used a closed enum. Changed to `z.string()` to match the open-ended category system.
- **Shopping — duplicate New List button**: Removed the redundant New List button from the list tabs toolbar; the one in the top-right header is sufficient.

## [1.5.0] – 2026-04-19

### Features
- **Weekend Ideas**: New `/weekend` page — a family activity board for local places to visit. Add places to a backlog, mark them visited with a 1–5 star rating, flag favorites, and tag them (outdoor, nature, hike, food, museum, farm, etc.). Visit frequency shown as pip dots grouped in 5s. Filters for status, favorites, tags, and search. Side-panel detail view with edit, mark-visited, and favorite actions. Phase 2 (POI search + map) coming next.
- **Weekend Ideas — group by tag**: Place cards are grouped into tag-category sections (emoji header + count) so you can scan by activity type at a glance. Untagged items fall into an "Other" bucket.
- **Travel Map — GPS photo linking**: Geotagged OneDrive photos are automatically matched to nearby travel pins. The pin detail panel shows a photo strip of matching shots within a configurable radius (default 50 km). Photos can be browsed via a lightbox.
- **Travel Map — re-locate pin**: Pencil icon next to a pin's coordinates opens an inline geocode search — search for a new location and pick a result to update the pin's lat/lng and place name in place (fixes pins dropped in the wrong location).

### Bug Fixes
- **Travel Map — globe longitude drift**: Rotation formula now normalizes center longitude to −180..180 — fixes pins appearing in wrong ocean locations (e.g., Gulf of Mexico instead of Sanibel Island) due to accumulated coordinate drift.
- **Travel Map — far-side pin culling**: Hidden pins now use a CSS class with `!important` flags so MapLibre styles can't override visibility — fixes pins remaining visible behind the Earth.
- **Weekend — side nav missing**: WeekendView was missing its `<PageWrapper>` wrapper, causing the side nav to disappear when navigating to the Weekend page.

### Improved
- **Nav icons**: Chores icon changed to `ListChecks` (multi-check) to better differentiate from Tasks (`CheckSquare`); Weekend icon changed to `Trees`.
- **Travel Map — globe initial zoom**: Default zoom adjusted so the Earth nearly fills the screen on load.

## [1.4.0] – 2026-04-18

### Features
- **Travel Map — Trips**: Multi-stop trip system with three styles — **Route** (A→B→C polyline), **Loop** (closed polyline returning to start), and **Hub** (home base + day-trip spokes). Trips are a first-class object separate from standalone place pins.
- **Travel Map — trip globe rendering**: All trips are always visible on the globe. Inactive trips render as small faded colored dots + thin low-opacity connecting lines. The active (selected) trip shows full numbered markers and a bright dashed line. Clicking any faint dot selects that trip.
- **Travel Map — national parks in trips**: Trips support national park stops alongside regular stops. NP stops display a green tree icon in the stop list instead of a number badge.
- **Travel Map — Place/Trip toggle**: The slide-out panel now shows a segmented Place/Trip toggle when adding something new, so you can switch between adding a standalone place and creating a trip without leaving the panel.
- **OneDrive photo sync — folder picker**: Settings now includes a folder picker so you can select which OneDrive folder to sync photos from, rather than defaulting to the root.
- **Photos — GPS backfill**: New `/api/photos/backfill-gps` endpoint reads GPS EXIF from already-synced photos and writes coordinates back to the database without re-downloading files.

### Bug Fixes
- **OneDrive OAuth callback**: Fixed "fetch failed" error caused by Docker's bridge network not routing IPv6. A `undici` global dispatcher now forces IPv4 for all `fetch()` calls inside the container.

## [1.3.0] – 2026-04-16

### Features
- **Travel Map — Phase 1**: Interactive globe (MapLibre GL + OpenFreeMap tiles, globe projection) for tracking family travel. Pins use a drop-pin SVG marker anchored at the coordinate tip; root locations use colored drop pins (green checkmark = visited, white dot = want-to-go, amber star badge = bucket list, green tree badge = has national parks); child stops use purple circles, national parks use green circles.
- **Travel Map — pin management**: Full inline editing in the detail panel — name, trip label, status toggle (auto-saves), bucket list star (auto-saves), visit dates, description, and tags. No separate edit modal.
- **Travel Map — stops & parks**: Add stops via Nominatim geocode search or add national parks from a curated NPS list; sub-locations displayed as a combined drag-to-reorder list; connecting lines drawn from parent pin to selected children on the globe.
- **Travel Map — Places tab**: Sortable list with stats bar, text search, filter pills (All / Been There / Want to Go / Bucket List / Has NP), and group-by (Year / Country / None) with country flag emoji. Selecting a place switches to the globe and opens its detail panel.
- **Travel Map — dark map mode**: Moon/sun toggle button on the globe applies a CSS filter (`brightness · saturate · contrast · hue-rotate`) only to the map canvas — tiles darken while all markers stay at full brightness, and no tile reload is required.
- **Travel Map — geocoding**: Nominatim proxy at `/api/travel/geocode` with Hawaiian island aliases, special-character normalization, and national park search scoring (boundary/park results ranked above natural features like volcano summits).
- **Tasks**: Person→List and List→Person nested group modes — primary group cards with sub-group sections inside (colored left-border dividers, per-sub-group badge counts). Available in the Group dropdown when task lists exist.
- **Undo Stack**: Global undo across shopping, tasks, wishes, and chores — undo button in the nav bar reverses the most recent mutation.
- **Dashboard Editor**: Transparent background mode — widget cards can render over the grid background image without a double-card effect.
- **Dashboard Editor**: Per-widget text color and opacity controls.
- **Dashboard Editor**: Custom color picker for theme palette swatches.
- **Dashboard Editor**: Grid line opacity and cell background color/opacity controls for calendar and weather widgets.
- **Camera Scanner**: Scan product barcodes with phone/tablet camera on the Shopping page — camera icon in header opens full-screen scanner overlay; automatically looks up product on Open Food Facts and adds it to the active list.
- **Docker**: Multi-arch builds (amd64 + arm64) — Raspberry Pi support via pre-built GHCR image.
- **Health check**: `GET /api/health` now probes PostgreSQL and Redis — returns 503 with `status: "degraded"` if either is down (previously always returned 200).
- **Calendar**: Profile columns now follow family member sort order from Settings; Family calendar group always sorts first before person columns.

### Improved
- **Tasks**: Group control split into a "Group" primary select and a "Then by" secondary select — the nested `Person → List` / `List → Person` arrow-notation options are replaced by two independent dropdowns.
- **Chores**: "Group by Person" toggle replaced with a consistent "Group" dropdown (None / Person) matching Tasks' style.
- **Calendar**: Day view and week view hourly rows now expand to fill available widget/subpage height — `1fr` grid rows scale proportionally instead of using a fixed minimum.
- **Bus Tracker**: Train map switches to 2-row snake layout when 6+ nodes — top row left→right, bottom row right→left, connected by a right-side vertical segment.
- **Bus Tracker**: PM route at-school status now shows "Bus at school — en route" instead of a bogus 0-minute ETA.
- **Bus Tracker**: Route dialog "Scheduled" field renamed to "Home ETA" with helper text clarifying it is the expected arrival time at your stop.
- **Bus Tracker**: Large minute values now display as hours and minutes (e.g., "15h 25m" instead of "925m").
- **README**: Replaced GIF demos with static screenshots for faster loading.

### Bug Fixes
- **Auth cookie secure flag**: Login route now detects HTTPS per-request via `X-Forwarded-Proto` header instead of a global `isSecure` flag derived from `APP_URL` — fixes "Log in to make changes" errors when accessing via `http://localhost:3000` while `APP_URL` pointed at the HTTPS public domain.
- **Travel Map — pin creation validation**: Zod schema now accepts `null` (not just `undefined`) for all optional fields — fixes "Something went wrong" when creating a new place.
- **Hawaii Volcanoes location**: Nominatim search for national parks now prefers boundary/park-type results over natural features — fixes Hawaii Volcanoes appearing at the volcano summit rather than the park centroid.
- **Bucket list unstar persistence**: Star and status toggles now auto-save immediately on click rather than requiring the Save button — fixes unstar/status changes being lost on navigation.
- **Microsoft OAuth callback**: Removed `requireAuth` requirement on the callback route — Microsoft redirects without a Prism session cookie, causing the connection flow to fail silently. Success/error toasts now display in Settings → Connected Accounts.
- **Performance mode**: Removed animation stripping (transitions run on the compositor thread and don't cause CPU overhead); caps transitions at 150ms so the UI remains responsive without looking broken. Fixes washed-out surfaces when backdrop-blur is disabled.
- **Virtual Keyboard**: Tapping a key no longer dismisses the keyboard after one character — `preventDefault` on `pointerDown` keeps focus in the active input field.
- **Virtual Keyboard**: Toggle button now appears correctly on touchscreen laptops where Windows converts touch events to mouse events (uses `navigator.maxTouchPoints` instead of pointer type tracking).
- **Virtual Keyboard**: Reduced height from 38vh to 32vh — less intrusive on 1080p displays.
- **Virtual Keyboard**: Scroll position no longer jumps after voice input adds a new list item — scroll restore is skipped when text was injected while the keyboard was open.
- **Camera Scanner**: Overlay now self-dismisses immediately after a successful scan; haptic feedback on successful scan; iOS AudioContext unlocked synchronously on "Open Camera" tap.
- **UI**: Desktop/laptop font size reduced to 14px base (via `pointer: fine` media query) — previously used the same 16px as touch displays.
- **Calendar**: Day name headers rotate correctly when week starts on Monday.
- **Mobile**: Navigation no longer causes flash/slide animation on page transitions.
- **Docker**: App health check uses node instead of curl; fresh install schema fixed; `VirtualKeyboard` and `CameraScannerOverlay` loaded via `next/dynamic` with `ssr: false`.
- **Database**: Truncate operation now includes all tables (gift_ideas, calendar_notes, wish_items, bus_tracking, audit_logs).
- **CI**: GitHub Actions upgraded from Node.js 20 to 22; layout validation size constraints downgraded to warnings.

### Infrastructure
- **Automatic database migrations**: Schema changes now apply automatically on container startup via `scripts/migrate.js`. Users update by running `./scripts/update.sh` (or `git pull && docker-compose up -d --build`) — no manual database commands required. `drizzle/0000_upgrade.sql` brings any existing installation (regardless of age) to the current schema; future changes go in numbered `drizzle/NNNN_description.sql` files.

### Security
- **CSRF**: Next.js middleware validates `Origin` header on all API mutations — cross-origin requests blocked at the edge (away-mode auto-activation exempt).
- **WiFi config**: Password now stored AES-256-GCM encrypted in the database; decrypted on read with backward-compat for existing plaintext rows.
- **Backups**: `PGPASSWORD` moved from inline shell string to process env — prevents credential leakage in process listings.
- **Babysitter info**: Sensitive section content now requires authentication (`includeSensitive=true` requests gated behind `requireAuth`).
- **Paprika import**: HTML payload capped at 5 MB — prevents memory exhaustion from oversized uploads.
- **Centralized cache invalidation**: New `invalidateEntity(entity)` helper in `src/lib/cache/cacheKeys.ts` replaces 166 ad-hoc `invalidateCache('entity:*')` calls across 65 files; cross-entity dependency graph ensures chore completions also clear points/goals cache.
- **Redis-down 503**: `validateSession` now returns a discriminated union `{ ok, reason }` — Redis unavailability returns 503 ("service unavailable") instead of 401 ("please log in"), preventing confusing auth errors during infra outages.
- **Request ID middleware**: All API responses include `x-request-id` header (24-char hex UUID); propagated into `logError()` for log correlation across distributed traces.
- **`/api/health/deep`** (parent-auth): Deep health check verifying DB, Redis, last backup recency, and OAuth token expiry; triggers optional `ALERT_WEBHOOK_URL` notification on degradation.
- **`apiError()` helper**: Standardized error responses via `src/lib/api/apiResponse.ts` — `{ error: { code, message } }` shape with typed codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.
- **withAuth migration**: birthdays, calendar-notes routes migrated from raw `requireAuth` boilerplate to `withAuth` wrapper.
- **API token scopes**: `scopes` JSONB column added to `api_tokens` table (default `["*"]` = full access); `withAuth` now enforces scope on API token requests; existing tokens unaffected.
- **Rate limiting**: In-memory fallback limiter — rate limits now enforced even when Redis is unavailable (previously all requests passed through).
- **Backups API**: `POST /api/admin/backups` rate-limited to 5 per hour per user.
- **API**: `GET /api/settings`, `GET /api/settings/wifi`, and `POST /api/shopping/scan` now require display/full auth — previously exposed unauthenticated.

### Performance
- **FamilyProvider**: Equality check on polling results before calling `setMembers` — prevents unnecessary re-renders across all consumers on every 10-minute poll when data is unchanged.
- **CLS fix**: `AppShell` no longer removes `ml-16` from `<main>` when auto-hide fires — SideNav is `position:fixed` so layout should never shift; eliminates CLS spike caused by the 10-second auto-hide timer (CLS 0.337 → 0.07).
- **Caching**: Messages, Tasks, and Photos GET endpoints now cache responses in Redis (60s / 60s / 300s TTLs) — reduces DB load on frequently-polled dashboard data.
- **Visibility polling**: `useCalendarEvents` and `usePhotos` now use `useVisibilityPolling` — polling pauses when the browser tab is hidden.
- **Images**: Replaced raw `<img>` tags with `next/image` (lazy loading, layout stability) in RecipeCard, RecipeDetailModal, and all four nav components.

### Quality
- **BabysitterModeOverlay**: `useBabysitterInfo` and `useWifiConfig` now skip authenticated endpoints when babysitter mode is inactive — eliminates 401 console errors and network failures in Lighthouse best-practices audit (best-practices 96 → 100).

### Tests
- **API error shape** (19 tests): every error code maps to correct HTTP status; `{ error: { code, message } }` shape enforced; `apiSuccess` coverage.
- **Cache cross-dependency** (14 tests): `invalidateEntity('chores')` cascades to points/goals; visited-set prevents double-invalidation; `invalidateEntities` shares visited set across entities.
- **Middleware request ID** (8 tests): `x-request-id` generated and propagated; CSRF blocks mismatched origin; exempt paths pass through; 403 responses still carry the ID.
- **Redis-down degradation** (7 tests): `validateSession` returns `unavailable` vs `invalid`; `requireAuth` returns 503 not 401 on Redis outage; `optionalAuth` degrades to null.
- **PinPad behavioral** (21 tests): member selection, digit entry, backspace, auto-submit, wrong PIN error, keyboard input, cancel, demo mode.
- **Shopping widget behavioral** (10 tests): check/uncheck items, optimistic update, progress bar ratio, list switching, all-checked, empty state.
- **OAuth token expiry** (10 tests): calendar/photo tokens expiring soon → warn; stale/missing backup → warn; Redis/DB down → degraded 503; auth enforcement.
- **Integration tests** (8 tests, `jest.integration.config.js`): events CRUD, chore completion flow with cascade, auth session create/validate/invalidate against real `prism_test` database.
- **Auth enumeration**: Jest tests verify requireAuth routes return 401 and getDisplayAuth routes are correctly guest-accessible (`src/app/api/__tests__/authEnumeration.test.ts`).
- **Widget smoke tests**: 14 render tests for ChoresWidget, TasksWidget, ShoppingWidget covering empty state, data display, and filtering (`src/components/widgets/__tests__/widgetRender.test.tsx`).
- **Jest config**: Added `.test.tsx` to testMatch; ts-jest now overrides `jsx: react-jsx` for component test files.

### Refactored
- **TasksView** (943→235 lines): extracted `TaskRow`, `GroupedTaskGrid`, `NestedGroupedTaskGrid`, `TaskContentArea`, `useTaskGrouping`, `taskGroupTypes` — all files under 250 lines.
- **ChoresView** (632→213 lines): extracted `ChoreGroupCard`, `ChoreGroupGrid`, `ChoreCompletionsList`, `useChoreModals`.
- **LayoutEditor** (901→228 lines): extracted 10 sub-components and hooks — toolbar sections, dashboard manager, measure mode, popover wrapper, shared types.
- **PinPad** (648→164 lines): extracted `usePinPad`, `NumberPad`, `MemberSelection`, `PinDisplay`.
- **Days**: Consolidated 8 inline day-of-week arrays across calendar views, chore modals, WeatherWidget, and the OpenWeather integration into shared `DAYS_SHORT_ARRAY`, `DAYS_LONG_ARRAY`, and `DAYS_SINGLE_ARRAY` constants in `src/lib/constants/days.ts`.
- **CalendarWidget**: Extracted `useCalendarWidgetPrefs` hook (view state, navigation, localStorage persistence) and `CalendarWidgetControls` sub-component — main component reduced from ~357 to ~200 lines.
- **Widgets**: Added `useMemo` for filter/sort chains and `useCallback` for event handlers in ChoresWidget, TasksWidget, ShoppingWidget, and MealsWidget.

### Docs
- **CLAUDE.md**: Added API error standardization, cache invalidation, auth degradation, testing, and request ID guidelines.
- **API auth levels**: Added `docs/api-auth-levels.md` documenting the auth requirement (Public / Display / Auth / Parent) for every API route.

---

## [1.2.0] - 2026-03-29

### Added
- **Google Tasks**: Bidirectional sync with Google Tasks — OAuth flow, list selection, task sync provider
- **Google Tasks**: Google Tasks option in Settings → Task Sync provider picker alongside Microsoft To-Do
- **Google Tasks**: Connected Accounts page dynamically shows "Used for: Calendars, Tasks" when Google Tasks connected
- **Mobile PWA**: Floating action button (FAB) replaces bottom nav bar — Home, Reorder, Settings, Login
- **Mobile PWA**: Dashboard card reorder mode (FAB → Reorder) with drag pills and amber indicator
- **Mobile PWA**: Card visibility settings (FAB → Settings) to show/hide dashboard cards
- **Mobile PWA**: All widget cards available — bus tracker, goals, wishes, photos, clock
- **Mobile PWA**: Screensaver and away mode auto-disabled on PWA (useIsPWA hook)
- **Mobile PWA**: Meals touch-drag between days on mobile
- **Mobile PWA**: Light/dark PWA icon variants, apple-touch-icon support

### Improved
- **Mobile PWA**: All grouped list pages (Tasks, Chores, Shopping, Wishes, Gift Ideas) use single-column on mobile
- **Mobile PWA**: Calendar simplified — short date, Day/Agenda toggle, no filter pills, read-only
- **Mobile PWA**: Messages important/expires badges on own line, edit/delete buttons visible on mobile
- **Mobile PWA**: Shopping extra bottom padding so FAB doesn't overlap last item
- **Mobile PWA**: GripVertical drag icons hidden on mobile across all list pages
- **Mobile PWA**: Card-level drag disabled on mobile to prevent scroll interference
- **Mobile PWA**: Body overflow-hidden changed to md:overflow-hidden for mobile scrolling

## [1.1.0] - 2026-03-16

### Added
- **Gift Ideas**: New "Gift Ideas" tab on the Wishes page — private per-user gift tracking for other family members
- **Gift Ideas**: Per-person columns with quick-add, edit, delete, and purchased toggle
- **Gift Ideas**: Privacy-enforced — only the idea creator can see their ideas; recipients never see them
- **Mobile PWA**: Compact subpage headers on mobile (reduced height, smaller text, hidden icons)
- **Mobile PWA**: Collapsible filter bars on mobile — tap "Filters" to expand/collapse
- **Mobile PWA**: Mobile dashboard — summary card layout with weather, calendar, chores, tasks, shopping, meals, messages, birthdays
- **Settings**: "Week Starts On" toggle (Sunday/Monday) in Settings → Display — controls calendar week boundaries, weekly goal resets, point counters, and meal planning weeks
- **Chores**: Reset Day picker in Add/Edit Chore modals — set which day weekly chores reset (Sun-Sat), day-of-month for monthly, or MM-DD for annual
- **Goals**: Seasonal celebration animations when a goal is fully achieved — week-based holidays: Valentine's, St. Patrick's, Easter, Spring, Memorial Day, July 4th, Halloween, Thanksgiving, Christmas, New Year's (plus default trophy)
- **Messages**: Inline edit support — pencil icon on hover, click to edit in place, Ctrl+Enter to save
- **Calendar Notes**: Day-tied notes panel on calendar widget list and day views — click the sticky note icon to toggle
- **Calendar Notes**: Inline contentEditable editing with auto-save (2s debounce + save on blur)
- **Calendar Notes**: Formatting shortcuts: Ctrl+B bold, Ctrl+I italic, Ctrl+U underline, Ctrl+Shift+S strikethrough, Ctrl+Shift+L bullet list, `- ` auto-converts to list
- **Calendar Notes**: Notes column aligns row-by-row with calendar day grid in list view
- **Calendar Notes**: Read-only when not logged in; shared across all family members
- **Calendar Widget**: Agenda view available on dashboard widget; List (vertical week) view also available on widget
- **Calendar Widget**: Merge/Split toggle for day and list views when multiple calendar groups exist
- **Calendar Widget**: Month view grid toggle (bordered/borderless cells)
- **Calendar**: Agenda view added to calendar subpage
- **Dashboard Editor**: Single-row properties toolbar (widget name + Fill/Outline/Text/Grid + close)
- **Dashboard Editor**: Text size (S/M/L/XL) moved inside the Text color popover alongside swatches

### Changed
- **Auto-Hide UI**: Only wakes on mouse click, keyboard press, or touch — mouse movement/drag no longer triggers reappear

### Improved
- **Away Mode**: Header layout matches babysitter mode — clock top-left, weather top-right in a compact bar
- **Calendar**: Multi-week 3W/4W event text size increased to match month view
- **Calendar**: Today cell border in multi-week view uses standard grid line instead of separate white line
- **Dashboard Editor**: Color popover z-index raised above widgets so dropdowns appear on top
- **Auth**: Settings PIN login now carries over to main app session (eliminates double-login)
- **SideNav**: Logo background made transparent to match nav toolbar color in both themes

### Fixed
- **Calendar**: Events from shared calendars (e.g. Family) no longer duplicate across person columns — matching by groupId instead of color
- **Calendar**: Day widget notes column no longer shows redundant date header when viewing a single day
- **Calendar**: Notes column integrated into DayViewSideBySide with matching header bar and grid line alignment
- **Calendar**: Week view fills available height on calendar subpage
- **Calendar**: Events now span their full duration in week and day views (previously showed as ~30min blocks)
- **Calendar**: Event text top-aligned with start–end time byline below title
- **Calendar**: All-day events fully opaque (no transparency)
- **Calendar**: Event backgrounds fully opaque in week/day views
- **Chores**: Grouped view now shows pending approval state (amber bg, hourglass icon, "Pending" badge)
- **Chores**: Recently completed chores remain visible for 24h after parent auto-approval
- **Chores**: Points input max raised from 100 to 1000
- **Gift Ideas**: Data refreshes immediately on user switch (no stale cache from previous user)
- **Navigation**: Removed border lines from nav, header, and editor toolbars for cleaner appearance
- **Tasks**: Scrolling works correctly on mobile PWA

## [1.0.4] - 2026-03-09

### Added
- **Calendar**: Multi-week view replaces the fixed 2-week view — configurable from 1 to 4 weeks on both the calendar page and dashboard widget
- **Calendar**: Bordered/borderless toggle for multi-week cell outlines; rows auto-size to content
- **Dashboard Editor**: Frosted glass background option with variable blur intensity (Light/Med/Heavy/Max)
- **Dashboard Editor**: Default swatch (reset icon) to return any color target to theme defaults
- **Dashboard Editor**: Harvey ball indicators on Fill/Outline/Text target buttons show color state at a glance
- **Dashboard Editor**: Two-mode touch editing — tap widget to select (move mode), tap again for resize mode, tap again to deselect
- **Auto-Hide UI**: Nav bar and toolbar auto-hide after 10 seconds of inactivity, reappear on mouse/touch (configurable in Settings)
- **Auto-Hide UI**: Staggered animation — header hides first, then nav; nav reappears first, then header
- **Settings**: Location card wired to weather API — supports zip code or city/state, stored in database
- **CONTRIBUTING.md**: Quality standards requiring 95% minimum Lighthouse score across all categories
- **Drag Reorder**: Tasks, chores, goals, and family profile cards can now be reordered by drag-and-drop (touch + mouse supported)
- **Drag Reorder**: Family profile sort order persists to database via `/api/family/reorder`; task/chore group order persists to localStorage
- **Undo**: Tasks, chores, shopping items, and wish claims now show an "Undo" toast button when completed/checked off
- **Wishes**: Self-purchase — cross off items on your own wish list; if someone else already secretly bought it, shows "Someone already got this for you!"
- **Wishes**: Quick-add input moved to top of list (consistent with tasks/chores pattern)
- **Messages**: "Group by Person" toggle groups messages into person-colored cards

### Improved
- **Settings**: Consolidated Screensaver Timeout, Auto-Hide Navigation, and Away Mode Auto-Activation into single "Timers & Auto-Activation" card
- **Calendar**: Multi-week toolbar no longer resizes when switching views — grid icon doubles as border toggle
- **Calendar**: Multi-week today highlight preserved in screensaver mode (data-keep-bg attribute)
- **SideNav**: Tap-to-expand drawer replaces hover-based expansion — works reliably on touch devices, collapses on outside tap or navigation
- **Weather**: Location resolved from DB settings with fallback chain (query param → DB → env var → default)
- **Screensaver**: Fixed `--primary` CSS variable override that turned today highlight bar white
- **Accessibility**: Dashboard editor uses dashed border for move mode, solid for resize — distinguishable without color

### Fixed
- **Navigation**: Fixed nav bar appearing behind page content on iPad — removed wrapper divs that created CSS containing blocks breaking `position: fixed`
- **Navigation**: Fixed auto-hide SSR hydration mismatch — localStorage read deferred to useEffect
- **Navigation**: Auto-hide now limited to dashboard pages only — no more jarring nav animations on subpages
- **Google Calendar**: Fixed events beyond 250-event page being silently dropped — added pagination loop following `nextPageToken`
- **Google Calendar**: Cancelled recurring event instances now filtered out during sync instead of appearing as active events
- **Bus Tracking**: Fixed token mismatch between discover and sync — stale Gmail credentials now deleted on `TokenRevokedError`
- **Layout Editor**: Added `busTracking` to widget validation constraints (fixes "unknown widget ID" error)
- **Layout Editor**: Fixed dashboard save showing "Saved!" but not actually persisting — save button now awaits the API call and shows error on failure
- **Safe Zones**: Shortened default label from "Example safe zone (edit me)" to "1080p" to prevent preview cutoff
- **Calendar**: Multi-day all-day events now span all their days instead of only appearing on the start date (affected all calendar views + widget)

### Improved
- **Performance**: Split RecipesView into RecipeCard, RecipeDetailModal, RecipeFormModal, ImportUrlModal, and ImportPaprikaModal sub-components
- **Performance**: Split ShoppingView into ShoppingCategoryCard and extracted useShoppingCelebration, useShoppingDragReorder, useShoppingInlineInput hooks
- **Performance**: Lazy-load layout editor and dnd-kit (only loaded in edit mode) — LCP improved from 7.2s to 3.9s, TBT from 2.4s to 1.4s
- **Performance**: Bundle analyzer added to build config (`ANALYZE=true npx next build`)
- **Bus Tracking**: Sync lock changed from 60s cooldown to mutex (release on completion) — updates arrive within seconds
- **Bus Tracking**: Response cache reduced to 5s, polling ramps to 5s when ETA ≤ 3 min

### Fixed
- **Recipes**: Fixed crash when opening "Add Recipe" form (missing optional chain on ingredients)
- **Layout Editor (iPad)**: Fix scrolling stopping too early — grid now extends 20+ rows (or half a screen) below the last widget
- **Layout Editor (iPad)**: Fix touch drag not working — tap to select a widget, then drag to move (selected widgets disable browser scroll so dnd-kit receives the gesture)
- **Layout Editor (iPad)**: Enforce minimum 16px cell size so grid remains usable on narrow screens
- **Layout Editor**: Add "Move" grip indicator on selected widgets for touch discoverability
- **Bus Tracking**: Fix arrival event timestamps off by 6 hours in UTC Docker containers — arrival parsers now use the email Date header (timezone-correct) instead of parsing body text times as naive UTC

### Changed
- **Dashboard Grid**: Migrated from 12-column to 48-column grid for finer widget positioning (~20px increments vs ~80px)
  - All existing layouts auto-migrate on load (coordinates scaled 4x)
  - Shared `GRID_COLS` constant as single source of truth
  - Widget constraints, templates, breakpoints, and validation all updated

- **Dashboard Grid**: Replaced react-grid-layout with native CSS Grid + dnd-kit
  - Display mode uses pure CSS Grid (SSR-safe, zero JS layout overhead)
  - Edit mode uses dnd-kit for drag-to-move with grid snapping, pointer events for resize
  - Custom snap modifier adapts to dynamic cell sizes across screen resolutions
  - Touch support via dnd-kit TouchSensor
  - Removes 5 packages from bundle (react-grid-layout and dependencies)
- **Performance**: Lighthouse optimization pass (desktop score: 52 → 96)
  - Lazy-load overlays (Screensaver, AwayMode, BabysitterMode) — broke transitive import chain that pulled entire widget registry into root layout
  - Extract screensaver storage utilities to break circular dependency between Screensaver and useDashboardLayout
  - Lazy-load Add modals (task, message, chore, shopping) — deferred from critical path
  - Add React.memo to eager-loaded widgets (Clock, Weather, Calendar) to prevent unnecessary re-renders
- **Accessibility**: Lighthouse accessibility score 92 → 100
  - Fix WCAG color contrast: rewrite `isLightColor` with proper sRGB linearization and WCAG contrast ratio calculation
  - Fix calendar "Today" badge using white text on yellow seasonal highlight background
  - Add `aria-label` to all sidebar nav links (text hidden when collapsed)
  - Add `aria-label` to logo home link
- **Bus Tracking**: Auto-sync emails on status poll (60s Redis debounce lock)
- **Bus Tracking**: Switch from `is:unread` to label+date Gmail filtering for email sync
  - Supports Gmail filters that skip inbox and route to a label (e.g. "bus")
  - Configurable Gmail label in Settings → Bus Tracking
  - Uses DB dedup (gmailMessageId) instead of marking emails as read
  - Date-windowed search (last 24h) keeps queries efficient

### Added
- **Bus Tracking**: Track school bus arrivals via FirstView email notifications
  - Gmail OAuth integration for polling FirstView geofence notification emails
  - Email parser for 3 notification types: distance-based, arrived-at-stop, arrived-at-school
  - Route discovery: auto-create routes by scanning existing emails in Gmail
  - Bus routes configuration with ordered geofence checkpoints, stop, and school
  - Historical arrival time prediction using rolling median transit times (30-day window)
  - Dashboard widget with progress dots, status colors (gray/amber/green/red), and ETA display
  - Screensaver widget support
  - Settings UI for Gmail connection, route management, checkpoint editing, and auto-discovery
  - Adaptive polling: scales from 60s down to 10s as bus approaches
  - Active days awareness: no false "overdue" status on weekends/non-school days
  - Fuzzy location matching for stop/school name abbreviations
  - API routes for status, sync, routes CRUD, connection management, history, and discovery

## [1.0.3] - 2026-03-01

### Added
- **Wish Lists**: New wish list feature with per-family-member lists, UI page, dashboard widget, and bidirectional sync with Microsoft To-Do
- **Feature Toggles**: Hide/show individual pages from navigation via Settings
- **Message Expiration**: Preset duration options for auto-expiring messages
- **Audit Log**: Activity audit log with settings PIN gate for parent access
- **Connected Accounts**: New settings section showing integration status with disconnect capability
- **Chore Management**: Delete button and enabled toggle added to chore modal and list view

### Changed
- **Calendar Event Layout**: Improved overlap handling and simplified AddEventModal
- **Calendar Deduplication**: Runtime deduplication for cross-calendar and widget events
- **Code Quality**: Deduplicated code, extracted shared utilities, and decomposed large components
- **Shopping Categories**: Moved to Shopping page; renamed Settings sections

### Fixed
- **CI Lint**: Fixed unescaped apostrophe in WishListIntegrationsSection that broke the build-only CI job
- **Calendar Sync**: Fixed settings getting wiped during sync and re-auth; fixed multi-account sync
- **Calendar Toggle Styling**: Fixed toggle styling, screensaver interactivity, and shopping modal issues
- **E2E Test Cleanup**: Added global Playwright teardown to sweep stale test data; fixed per-test cleanup deleting only the first match instead of all duplicates
- **Architecture Review**: Fixed 5 bugs found during architecture review

## [1.0.2] - 2026-02-26

### Added
- **Calendar Merge Toggle**: List view now has a "Merge/Split" button to collapse multi-calendar columns into a single chronological stream
- **Past Time Dimming**: Day view dims past hour cells with grey background and highlights current hour in blue; List view dims past timed events with reduced opacity
- **Per-List Category Visibility**: Each shopping list can now show/hide categories independently via the category manager
- **General List Type**: New "General" shopping list type with preset categories (Clothes, Housewares, Gardening, Electronics, Office, Gifts)
- **General Categories**: Added 6 general-purpose shopping categories alongside grocery categories
- **Shopping Categories Settings**: New Settings section for global category management (add, remove, reorder, reset to defaults)
- **Inline Category Editing in List Modal**: Category chips in the create/edit list dialog are now interactive toggles — select a preset (Grocery, General, All, Custom) then fine-tune by toggling individual categories on/off. Replaces the separate "Categories" button.
- **Tasks Group by List**: Tasks view now supports grouping by Person, List, or None (flat list)
- **Tasks Show/Hide Completed**: Quick eye toggle in the Tasks header to show/hide completed tasks
- **Tasks Click-to-Complete**: All task view modes (flat list, grouped) now support clicking a row to toggle completion (like shopping)
- **Tasks Inline Add with List**: Inline task creation now auto-assigns the active list filter or group list
- **Headless Browser Recipe Import**: Recipes from Cloudflare-protected sites (AllRecipes, Serious Eats) now fetched via Puppeteer headless browser fallback
- **Meal Type Multi-Select Filter**: Meal type filter pills now support multi-select (like calendar profile pills)
- **Recipe Link from Meals**: Meals linked to a Prism recipe show a direct link to open the recipe modal

### Fixed
- **Session Expiry Ghost Avatar**: Users no longer appear logged in after session expiry. Sliding window extends active sessions, 5-minute periodic checks detect stale sessions, and 401 responses immediately clear the avatar
- **Shopping List/Item Creation**: Fixed "Failed to add item" error caused by importing client-only module in server API route
- **Recipe Modal Close Loop**: Fixed recipe modal reopening immediately after closing when navigated via URL param
- **Past Day Dimming**: Increased opacity of past-day dimming across all calendar views for better contrast

## [1.0.1] - 2026-02-25

### Added
- **Shopping Categories**: Custom categories for all list types — add, remove, and reorder via "Manage Categories" modal. Stored in settings with auto-assigned emoji and color. Removed "hardware" list type
- **Gallery Mode**: Full-screen photo slideshow from the Photos page. Respects active filters (orientation, usage, favorites). Tap to exit
- **Inline Task Add**: Quick task creation via inline text input (type + ENTER) in Tasks view. Available in both grouped and flat list modes
- **Babysitter Mode Toggle**: Activate Babysitter Mode directly from the /babysitter page header
- **Vertical Week View**: New "List" calendar view — planner-style vertical layout with days as rows and color-coded events. Profile grouping columns when multiple calendars configured. Today highlighted, past days dimmed
- **Calendar Re-auth Flow**: Detect expired/revoked Google Calendar tokens, show warning in Settings with "Re-authenticate" button that updates existing calendar source tokens

### Fixed
- **Calendar Sync**: Token refresh failures now detect `invalid_grant` errors specifically and mark calendars as needing re-authentication instead of showing generic errors
- **Task Creation**: Fixed "Failed to create task" error when using + button with list filter set to "none"
- **Day View Hidden Hours**: Hour rows now expand to fill available space when hidden hours are enabled, instead of leaving blank space at the bottom

## [1.0.2] - 2026-02-22

### Added
- **Transparent widget background**: New "Transparent" swatch (checkerboard icon) in Fill palette strips the Card background entirely, letting wallpaper show through
- **Widget text color**: New "Text" section in properties bar lets you override text/icon color per widget (Auto mode uses luminance detection or theme default)
- **Calendar transparent mode**: When calendar widget has custom/transparent background, day cell backgrounds are removed so wallpaper shows through the entire widget

### Fixed
- **Text color persistence**: Widget text color now saves to database (was being stripped by API validation)
- **Text color coverage**: Overrides CSS custom properties (`--foreground`, `--card-foreground`, `--muted-foreground`, `--primary`, `--seasonal-accent`) so all text, icons, and accents in the widget pick up the chosen color
- **Day view transparency**: DayViewSideBySide calendar now strips `bg-card/85` in transparent widget mode
- **Calendar dropdown**: Select trigger and filter chips go transparent with the widget
- **iPad properties bar**: Added `onPointerDown` + `touch-manipulation` to all swatch buttons for reliable iPad touch

### Added
- **Custom color picker**: Rainbow swatch in Fill, Outline, and Text sections opens native color picker for full color gamut

### Improved
- **Calendar dark mode**: Replaced hardcoded `bg-gray-200` past-day backgrounds with theme-aware `bg-muted` variants that adapt to light/dark mode
- **Properties bar UX**: Opacity buttons only appear when a color fill is selected (not for None or Transparent); Fill palette uses 9-column grid to accommodate Transparent swatch

## [1.0.1] - 2026-02-22

### Fixed
- **Background opacity**: Widget background opacity no longer makes text/icons transparent — uses rgba background color instead of CSS opacity
- **Color picker touch targets**: Increased button sizes to meet 44px HIG minimum, prevented RGL drag from intercepting touch events on color picker
- **Pencil icon**: Edit icon in dashboard toolbar now opens rename dialog on click
- **Rename dialog**: Replaced browser `window.prompt()` with styled modal dialog (consistent with v1.0 polish)

## [1.0.0] - 2026-02-22

### Changed
- **Toast Notifications**: Replaced all 55 browser `alert()` calls with styled toast notifications (success/warning/destructive variants) using shadcn/Radix toast system
- **Confirm Dialogs**: Replaced all 18 browser `confirm()` calls with styled AlertDialog modals via reusable `useConfirmDialog` hook
- **Optimistic UI**: Task toggle, task delete, shopping item toggle, and shopping item delete now update instantly with automatic rollback on failure

### Added
- **Error Pages**: App-level `error.tsx` and `not-found.tsx` with route-level error boundaries for calendar and settings
- **Accessibility**: Added ~60 `aria-label` attributes to icon-only buttons across all views, widgets, modals, and settings sections
- **Stack trace protection**: Error boundaries gate error details behind `NODE_ENV === 'development'`
- **SSRF Protection**: Recipe URL import validates against private IP ranges, localhost, and internal hostnames
- **Rate Limiting**: Recipe URL import limited to 10 requests per 60 seconds per user
- **Docker Resource Limits**: Container memory and CPU caps (app: 2GB/2CPU, db: 2GB/2CPU, redis: 512MB/1CPU) with Redis LRU eviction policy

### Fixed
- **Console cleanup**: Removed 28 debug `console.log` calls from production code (birthday sync, calendar sync, calendar settings, backup utils)
- **TypeScript**: Replaced `as any` cast in maintenance route with proper type validation
- **Chore authorization**: Added missing `requireRole` check on POST /api/chores
- **Portrait grid overlap**: Bottom widgets no longer render behind the portrait navigation bar on iPads and vertical monitors

## [0.9.5] - 2026-02-21

### Added
- **Comprehensive Test Suite**: 635 unit tests (39 suites) + 76 E2E tests
  - Core utilities: cn, color, crypto, formatters, backup, security headers, recipeParser, paprikaParser, validateFileType, calculateNextDue, pointWaterfall
  - Auth & cache: session management, requireAuth cascade, API tokens, rate limiting, Redis cache layer (all with graceful fallback testing)
  - Hooks (renderHook): useIdleDetection, useAwayModeTimeout, useCalendarFilter, useVisibilityPolling, useHiddenHours, useSwipeNavigation, useScreenSafeZones
  - Integrations: OpenWeather, OneDrive, Google Calendar, MS To-Do (tasks + shopping), calendar sync
  - Services: photo-storage, photo-sync, avatar-storage
  - API routes: chore complete/approve workflow, family member deletion, recipe URL import, withAuth middleware
  - E2E (Playwright): auth flows, dashboard, tasks/chores/shopping/calendar/settings navigation, CRUD mutations for all 5 modules, away/babysitter mode
- **Extracted calculateNextDue**: DRY refactor — shared utility used by both chore complete and approve routes
- **CI Type Check Fix**: All test files pass strict `tsc --noEmit`
- **API Tokens**: Long-lived bearer tokens for machine-to-machine access
  - Generate tokens in Settings → Security → API Tokens
  - Tokens grant parent-level access to all API endpoints
  - SHA-256 hashed storage — raw token shown only once at creation
  - Revoke tokens at any time; `lastUsedAt` tracked per token
  - All existing API routes automatically support `Authorization: Bearer <token>`
- **Iframe Embedding**: Configurable `ALLOWED_FRAME_ANCESTORS` env var for embedding Prism in Home Assistant, Node-RED dashboards, or any iframe consumer
  - Defaults to `SAMEORIGIN` when unset; supports comma-separated origins or `*`
  - Security headers extracted to dedicated module with unit tests
- **Home Assistant Integration Guide** (`docs/home-assistant.md`)
  - Iframe embedding via `ALLOWED_FRAME_ANCESTORS` + `panel_iframe`
  - REST sensor examples for calendar events, chores, shopping, meals
  - Automation examples for TTS announcements and notifications

## [0.9.4] - 2026-02-21

### Added
- **Multi-Dashboard Support**: Multiple named dashboards for different physical screens
  - Each dashboard has its own widget layout, screensaver, and orientation
  - URL routing via `/d/[slug]` (e.g. `/d/kitchen`, `/d/hallway`)
  - `/` continues to show the default dashboard
  - Devices bookmark their dashboard URL for persistent per-screen layouts
- **Dashboard Management** in layout designer toolbar:
  - Dashboard name is now a dropdown listing all dashboards
  - "New Dashboard..." creation dialog with Blank, Default Template, or Copy Current options
  - "Rename Dashboard..." and "Delete Dashboard" in the More menu
  - Switching dashboards navigates to `/d/[slug]`
- **Per-Dashboard Screensaver**: Each dashboard stores its own screensaver layout in the database
  - Screensaver bridge writes active dashboard's screensaver to localStorage on mount
  - Global screensaver component works without changes
- **Per-Dashboard Orientation**: Screen orientation (landscape/portrait) saved per-dashboard in DB instead of localStorage

### Changed
- **Away Mode Icon**: Moon icon replaced with palm tree (`TreePalm`) — more intuitive "vacation/away" meaning, avoids confusion with dark mode
- **Screensaver Icon**: Monitor-with-play icon replaced with lamp/nightlight — better represents ambient display mode

### Improved
- **Auto-Slug Migration**: Existing layouts automatically receive URL slugs on first API fetch
- **Last Dashboard Protection**: API prevents deleting the last remaining dashboard; default reassigned if the current default is deleted

## [0.9.3] - 2026-02-11

### Added
- **Outline Color**: Widget designer now supports border/outline color in addition to background color
  - Same color palette as background picker
  - Persists with layout save (stored in JSONB, no migration needed)

### Improved
- **Widget Designer Touch Support**: All resize handles now meet Apple's 44px minimum touch target
  - Edge handles: 20px → 44px thick; corner handles: 32px → 48px
  - Visual indicators always visible in edit mode (not just on hover)
  - Larger visual dots (18px with white ring) and bars (56×6px)
- **Color Picker Touch Fix**: Picker no longer closes immediately on touch devices
  - Replaced `onMouseLeave` with click-outside-to-dismiss pattern
  - Larger color button (12px → 20px) and swatches (20px → 28px)
  - Wider picker panel (180px → 200px)

## [0.9.2] - 2026-02-10

### Added
- **Away Mode**: Privacy screen that hides sensitive info (calendar, tasks, chores, messages)
  - Shows only clock, weather, and photo slideshow
  - Parent PIN required to exit
  - Toggle via moon icon in dashboard header
  - Auto-activation after extended inactivity (configurable: 4 hours to 1 week)
- **Babysitter Mode**: Full-screen overlay showing babysitter info
  - Displays emergency contacts, house info, children details, house rules
  - Clock and weather in header
  - Blue/purple gradient background
  - Parent PIN required to exit
  - Toggle via baby icon in dashboard header
- **Babysitter Info**: Public info page for caregivers (`/babysitter`)
  - Emergency contacts with call links
  - House information (WiFi, address, etc.)
  - Children details (allergies, bedtimes, medications)
  - House rules with importance levels
  - Sensitive items can be PIN-protected
  - Print-friendly layout
- New nav item: "Babysitter" in sidebar and portrait nav
- New settings section: "Babysitter Info" for managing content
- New settings: "Away Mode Auto-Activation" timeout in Display settings

### Database
- Added `babysitter_info` table with section, sortOrder, content (jsonb), isSensitive fields

### Changed
- Plane celebration animation simplified: 5s duration, slows in middle for text visibility, no loop

### Fixed
- Plane celebration no longer triggers when login is cancelled (only celebrates on successful completion)
- PIN modal z-index issue - now uses React portal to escape stacking contexts created by backdrop-blur
- "Add Childre" typo in babysitter info settings (now correctly shows "Add Child")
- Away Mode and Babysitter Mode now activate immediately (previously required page refresh)
- Babysitter nav item now visible in portrait mode on iPad

## [0.9.1] - 2026-02-09

### Added
- **Calendar hidden hours**: Configure time blocks to hide (e.g., 12am-6am) in Settings → Display
- **Calendar toggle button**: Clock icon in day/week views to show/hide configured time block
- **Grocery category drag-to-reorder**: Drag categories by grip icon to rearrange
- **Non-grocery list layout**: 2-column "List 1"/"List 2" layout matching grocery card style
- **Dashboard swipe prevention**: Prevents scrolling beyond screen bounds while allowing widget internal scroll

### Fixed
- Shopping list type now persists correctly (grocery vs hardware)
- "All Done!" celebration animation properly auto-dismisses
- Two-week vertical view Saturday row no longer cut off
- Non-grocery lists now use consistent card styling

## [0.9.0] - 2026-02-07

### Added
- **Mobile PWA**: Installable app with service worker, manifest, and app icons
- **Bottom navigation**: Mobile and portrait tablet navigation bars
- **Swipe navigation**: Swipe left/right on calendar views to navigate
- **Responsive font sizing**: 16px phones, 18px desktop, 20-24px tablets
- **Shopping celebration**: Animation when all items checked off
- **Shopping mode**: Full-screen mobile shopping experience
- **Calendar auto-scaling**: Views fit available space without scrolling

### Changed
- Removed Chores and Goals from mobile navigation (kiosk-focused)
- Calendar forced to day view on mobile devices
- SideNav hidden on mobile (bottom nav only)

## [0.8.0] - 2026-02-06

### Added
- **Microsoft To-Do integration**: Bidirectional task sync with OAuth
- **Shopping list sync**: MS To-Do integration for shopping items
- **Recipe system**: Full CRUD, URL import, Paprika import
- **Recipe scaling**: Adjust servings with smart fraction handling
- **Add ingredients to shopping list**: From recipe detail modal
- **Meal-recipe linking**: Select recipes when planning meals
- **Background auto-sync**: Tasks sync every 5 minutes on dashboard/screensaver
- **SVG favicon**: New prism icon design
- **Task list management**: Edit names, delete lists, change external connections

### Changed
- Task integration UI redesigned with per-list connect buttons
- Recipe categories/cuisine filter dropdowns
- Ingredient strikethrough toggle in recipe modal

## [0.7.0] - 2026-02-06

### Added
- **Calendar event colors**: Color picker with user profile color default
- **Hide calendars from Add Event**: Configurable per calendar in settings
- **Calendar alias/rename**: Edit display names in settings
- **24-hour week view**: Shows all hours instead of 6am-10pm
- **Overlapping events**: Cycle through horizontal positions
- **Login prompts**: All create actions now require authentication first

### Changed
- Portrait navigation icons increased 1.4x
- Week view shows all-day events in scrollable header
- Removed "+n more" event truncation

## [0.6.0] - 2026-02-06

### Added
- **Wallpaper rotation**: Configurable interval with "never" option
- **Screensaver photo interval**: Configurable in settings
- **Auto-sync re-enabled**: Calendar syncs every 10 minutes
- **Wallpaper fallback**: Uses all photos if none tagged for wallpaper

### Fixed
- Wallpaper only shows on dashboard and screensaver
- Dashboard wallpaper no longer blocked by solid background
- Shopping cache invalidation on item changes
- Tasks cache invalidation on changes
- Points cache invalidation on chore changes

## [0.5.0] - 2026-02-05

### Added
- **Points & Goals system**: Full implementation with waterfall allocation
- **Goal redemption**: Parents can redeem goals for children
- **PointsWidget**: Dashboard widget with per-child progress
- **Goals page**: View, create, edit, delete goals with progress tracking
- **Chore completion history**: View recent completions with approval status
- **Layout import/export**: Share layouts via clipboard JSON

### Changed
- Logo in SideNav: Pixel dissolve design
- Screensaver templates repositioned to hug top borders
- Goals cache invalidation on chore complete/approve

### Fixed
- Chore period boundaries (weekly resets on Sundays)
- Pending chores display in dashboard
- Widget color settings now persist
- Completed goals visibility in light/dark modes

## [0.4.0] - 2026-02-05

### Added
- **Security hardening**: Transactions on concurrent mutations
- **Magic byte validation**: JPEG/PNG/WebP verification on uploads
- **Per-user rate limiting**: Redis-based with graceful fallback

### Fixed
- `requireRole()` authorization gaps in chores/messages/tasks
- Race condition in family member deletion
- Missing author ownership check in messages PATCH

## [0.3.0] - 2026-02-05

### Added
- **Lazy-loaded widgets**: 7 non-default widgets load on demand
- **Conditional modal rendering**: Modals only mount when open

### Changed
- Split 6 oversized components into custom hooks
- All component functions now under 250 lines
- Removed dead `getDemoEvents()` function

## [0.2.0] - 2026-02-05

### Added
- **Database indexes**: 7 new indexes for query performance
- **Consolidated shopping API**: `?includeItems=true` parameter
- **Unique birthday index**: For batch upsert operations

### Fixed
- N+1 query in calendar groups (batch insert)
- N+1 query in birthday sync (batch upsert)
- FK cascade rules on 16 nullable user columns

## [0.1.0] - 2026-02-05

### Added
- **Redis caching**: GET endpoints with mutation invalidation
- **FamilyContext**: Replaces 9 duplicate fetch calls
- **Visibility-based polling**: Pauses when tab hidden

### Fixed
- COUNT query bugs in tasks and messages routes
- Polling intervals reduced (60s→300s/120s)

### Changed
- Brand rename to "Prism"
