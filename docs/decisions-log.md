# Decisions & lessons log

A running record of work that was built but **not merged**, so the reasoning survives after the branch is deleted. When you delete a research / spike branch, leave its post-mortem here first.

Format per entry: what it was, why it's gone, and the specific lessons worth not re-learning.

---

## Publishing PII to GitHub metadata — the gap `scan-pii.sh` never covered (2026-08-28)

**What happened:** A real town and postal code, read out of the maintainer's live running instance, were published in the body of a public PR as before/after evidence. The value was **already in the PII denylist**. Nothing caught it, because `scan-pii.sh` is a pre-commit hook that walks `git ls-files` — and a pull-request body is GitHub metadata that never touches the working tree.

**Why it matters more than it looks:** PR and issue bodies are *not* git objects, so nothing propagated to any clone or fork. But GitHub retains **edit-history revisions**, and the pre-edit text stays readable through the `userContentEdits` GraphQL field long after the body is fixed. There is **no API to delete a revision** — it is UI-only, via the "edited" link on the body. Notification emails already delivered cannot be recalled at all.

**Lessons worth not re-learning:**

- The denylist was never the weak point. **Coverage was.** Any new publishing path (a `gh` subcommand, a bot, a webhook) needs to be added to the guard, or it is unprotected by default.
- Values read from the live DB, `.env`, container env or a running API response are **real by construction**. They are the highest-risk text there is, and "it's just a town" is exactly the reasoning that leaks a town.
- Denylist entries must match on **word boundaries**, not substrings. A first-pass substring matcher fired inside "install", "Locale" and "milestone". A scanner that cries wolf is one people learn to ignore, which is worse than no scanner.
- Verification has to sweep every surface, not just the one that leaked: PR/issue **bodies, comments, and edit histories**, discussions, releases, commit messages, file history across all refs, and private repos.

**What now enforces it:** `scripts/scan-text.sh` (scans arbitrary outbound text against the same denylist) and `scripts/guard-outbound.sh` (a `PreToolUse` hook that reads a proposed `gh` command, extracts what it would publish, and refuses the call). Rules alone had already failed once; the hook is the part that actually prevents.

---

## Birthday detection — why the "Friends & Family" magic name had to go (2026-08-28)

**What it was:** Birthdays could only enter Prism through two hardcoded Google calendars: Google's generated contacts calendar, and any source whose *name contained "friends"*. Shipped in #296 as content-based detection across every provider.

**Why the old design failed:** It worked for exactly one person — whoever happened to keep a calendar with that name. It was documented nowhere, so [discussion #292](https://github.com/sandydargoport/prism/discussions/292) had no answer to give. It also **under-collected by 25%** on the maintainer's own account, missing birthdays sitting on a shared calendar, a personal calendar and a "Family" calendar.

**Lessons worth not re-learning:**

- **Measure precision on real titles, not counts.** Counting regex hits said 99.4% precision. Reading the actual titles found a birthday party's prep task, a public holiday named after a person, and a teacher from a school feed — all of which a count-based check called clean.
- **Two filters did more than the keyword.** Requiring `allDay`, and skipping read-only subscription calendars, removed nearly all false positives. The second is what keeps holiday and school feeds out, and it generalises to users who subscribe to far more of them.
- **Do not require `recurring`.** It excludes local calendars entirely, since Prism cannot yet set recurrence on a locally-created event ([#59](https://github.com/sandydargoport/prism/issues/59)) — and local calendars are the whole point, because "put it on your own calendar" is how you add a birthday without a data-entry form.
- **Milestones have no keyword**, which is what forced the magic name originally. They are detected by shape instead: all-day, annually recurring, carrying a year. The heart character one user writes is deliberately *not* a signal.
- **English-only keyword matching is an invisible failure.** Prism ships a German UI; a German household writing "Omas Geburtstag" would have got nothing, with no error to explain it. Keywords cover English and German.
- Contributor-facing behaviour that depends on a magic string is a bug even when it works. If it can't be explained in a docs page, it can't be supported.

## `feat/photo-sources-icloud-shared` — iCloud Shared Album source (deleted 2026-06-16)

**What it was:** Phase B of [#57](https://github.com/sandydargoport/prism/issues/57) — pull photos from a public iCloud Shared Album by pasting its share link, no Apple Developer account. PR #92.

**Why it's gone:** Apple migrated public shared albums off the legacy `sharedstreams` web service onto a new "iCloud Links" CloudKit backend during 2024–2025. The legacy endpoint now returns **404 for any modern share**, and anonymous server-side access to the new backend appears to require CloudKit JS session tokens. No community library targets the new backend (`ghostops/icloud-shared-album` last updated 2024-10). The doctrine — why this is a structural wall, not a "try harder" — already lives in [ICLOUD.md](features/ICLOUD.md). The shipping path is Phase A: OneDrive folder + an iOS Shortcut, which doesn't touch Apple's private surface.

**Resolver-level lessons** (these were *only* in the branch code, captured here so they're not lost):

- The legacy protocol is: parse token after `#` in the share URL → POST to a starting partition → follow Apple's **HTTP 330** redirect, which names the canonical host in the `X-Apple-MMe-Host` header → POST `/{token}/sharedstreams/webstream` for photo metadata → POST `/{token}/sharedstreams/webasseturls` for download URLs.
- Use **`p23-sharedstreams.icloud.com`** as the starting partition. A made-up partition like `p123` has no host behind Apple's load balancer, so you get a `400` instead of the expected `330` redirect and the whole flow looks broken for the wrong reason.
- Signed asset URLs are **short-lived (~30 min)** — fetch them at the moment of download, never cache them.
- Derivatives come keyed by a per-byte **`checksum`**; that checksum is the key into the asset-URLs map. Pick the highest-resolution derivative before requesting its URL.
- Even with all of the above correct, it stops at the 404 wall above for modern shares — the lessons are for understanding the old path, not reviving it.

---

## `feat/mcp-server` — Prism MCP server (deleted 2026-06-16)

**What it was:** A self-contained Model Context Protocol server under `.mcp/` exposing the Prism REST API as MCP tools (chores, tasks, events, shopping, messages, meals, goals, recipes, maintenance, points, weather, family), so AI clients (Claude Desktop, Cursor / VS Code Copilot Chat, Gemini CLI / Code Assist) can read and write family data over natural-language chat. Cherry-picked from an external contribution (since closed) and modernized before adoption.

**Why it's gone:** Branch was stale (61 commits behind master) and never merged. Deleted during branch cleanup. **The work is worth resurrecting** if MCP access becomes a real ask — re-cut from commit `f870aeb` rather than from scratch.

**Lessons / decisions worth keeping:**

- Built on `@modelcontextprotocol/sdk` **v1.29+** (bumped from the contribution's `^1.12.0`), **stdio** transport (local subprocess launched by the client).
- Auth reuses the existing **Settings → Security → API Tokens** bearer tokens, passed via `PRISM_BASE_URL` / `PRISM_API_TOKEN` env vars in the client config — no new auth surface.
- Per the **2025-06-18** spec, every tool returns `structuredContent` alongside `content` so modern clients use parsed objects without re-parsing JSON (arrays wrapped under `items`, primitives under `value`, objects passed through).
- `outputSchema` declarations were **intentionally omitted** — they'd silently drift from the upstream REST shapes. Deliberate trade-off, not an oversight.
- Future direction (noted in the branch's `.mcp/README.md`): a remote/hosted variant using **Streamable HTTP + OAuth 2.1** per spec **2025-11-25**, so users plug Prism in without running a local Node process. Not built.
