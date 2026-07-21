# Code Review & Validation Modalities

> Why this exists: a class of bugs in Prism has shipped past careful code review and been caught only by users running the software. This document names that class, explains why it evades review, and prescribes the additional verification modalities required.

## The structural blind spot

LLM-based review (including adversarial multi-LLM panels) catches **code-shape** bugs but is structurally blind to:

- **Deployment-shape** bugs — wrong behavior under specific topologies (reverse proxy, multi-host, container vs bare metal)
- **State-shape** bugs — wrong behavior given prior failed runs, partial migrations, leftover data
- **Render-shape** bugs — visual contrast, stacking contexts, color resolution that requires actually painting pixels
- **User-flow-shape** bugs — paths through the system that exist in the user's experience but aren't obvious from any single file
- **Cross-artifact-shape** bugs — contracts between two files (e.g. `install.sh` generates secrets, `crypto.ts` requires them) that no single review pass spans

Real Prism bugs in this class that survived adversarial review and were caught by users running the software:

| Bug | Shape |
|---|---|
| HTTPS cookie handling broken behind reverse proxy | Deployment |
| `ENCRYPTION_KEY` missing from install.sh | Cross-artifact |
| `CREATE FUNCTION` not idempotent on schema re-apply | State |
| Migration recovery from interrupted prior runs | State |
| Dark-mode calendar text contrast unreadable | Render |
| Toolbar icons invisible under wallpaper z-index in perf mode | Render |
| `/api/family` POST blocked initial setup wizard | User-flow |
| Auto-hide UI making toolbar appear "broken" | User-flow |
| Real first names ("Eric"/"Kim") in `formatters.test.ts` fixtures | Cross-artifact (PII) |
| `scan-pii.sh` couldn't find the denylist when run via npm-spawned bash on WSL | Cross-environment (path resolution) |
| `scan-pii.sh` ran 30+ seconds on a 50-entry denylist (per-entry loop instead of single-pass `grep -f`) | Performance / algorithmic |

The fix is **not "more adversarial review."** A 50-LLM panel and a 5-LLM panel are reading the same input. Making reviewers stricter doesn't add modalities; it sharpens the one modality already in use. The structural blind spot remains.

## Required modalities

For any non-trivial change, the relevant modalities below must sign off before the change is considered verified.

| Modality | Catches | How |
|---|---|---|
| LLM review | Logic errors, edge cases in code path, type issues, missing error handling | Default — applied to every change |
| Build + type-check | Compile errors, type drift | `npx tsc --noEmit && npx next lint` |
| Unit / integration tests | Logic + state-machine bugs | `npx jest` against a real test DB; do not mock Drizzle |
| Headless browser execution | Render bugs, stacking-context bugs, hydration mismatches, dark-mode contrast | Playwright (`e2e/`) — capture screenshots in both themes for any visual change |
| Install flow | Missing env vars, install.sh gaps, fresh-install failures | `scripts/test-fresh-install.sh` |
| Reverse-proxy deployment | HTTPS detection, secure cookie handling, `x-forwarded-proto`-dependent code | `tests/e2e/reverse-proxy.spec.ts` *(to be added — see below)* |
| Migration replay | Idempotency, recovery from partial failure | `scripts/test-migration-replay.sh` *(to be added — see below)* |
| Visual regression | Color contrast, layout regressions across themes, accidental rendering changes | `tests/e2e/visual-regression.spec.ts` *(to be added — see below)* |
| PII denylist scan | Real names / addresses / phones in fixtures that look fictional but aren't | `scripts/scan-pii.sh` *(to be added — see below)* |
| Placeholder / example audit | Real-data-derived placeholders the maintainer didn't realize were specific to their life | Eyeballed grep across `placeholder=` and `e.g.` patterns *(see TODO #6)* |

## Operational rules

- For any change touching **auth, cookies, env-var contracts, or schema migrations**, the relevant execution-modality test must run **before commit** — type-check alone is not sufficient.
- For any visual change, capture a Playwright screenshot in **both light and dark themes** and compare to baseline. If no baseline exists, capture one in the same commit.
- Bugs reported by users that match one of the modality patterns above must be **reproduced via that modality before fixing** — adding the test is the first commit of the fix.
- Text-only review (reading code, even adversarially) is **complementary**, not substitutable. Two LLM panels disagreeing about color contrast is still zero useful signal about color contrast.
- When in doubt about which modality applies, ask before declaring a change verified.

## Coverage gaps (current TODOs)

These tests do not yet exist and should be added before security/deployment-sensitive work lands:

### 1. `tests/e2e/reverse-proxy.spec.ts`

A Playwright suite that boots nginx in front of the app with a self-signed cert, hits `/api/auth/login` over HTTPS via the proxy, and asserts that the response sets `Set-Cookie` with `Secure; HttpOnly`. Catches the `x-forwarded-proto` regression class.

Scaffolding pattern: extend `playwright.config.ts` with a project that uses the nginx fixture; provide an nginx config in `tests/fixtures/nginx/`; spin up via Docker before tests, tear down after.

### 2. `e2e/visual-regression.spec.ts` (scaffold landed; baselines TODO)

Spec exists. Covers dashboard (default + perf-mode), calendar, settings, login landing, and the PIN modal — all in light + dark themes. **No baselines committed yet** because of a hard PII constraint: visual baselines from a live deployment capture real names, calendar events, photos, weather city, and other personal data — `CLAUDE.md` PII policy forbids committing those.

**Hard requirement to enable**: a **synthetic-seed test database** with anonymized fixtures (`Alex/Jordan/Emma/Sophie` family members, fixture wallpaper, fictional events, fictional weather location). Capture baselines only against that. Until that synthetic seed exists, the entire spec auto-skips when run without the `E2E_HAS_TEST_DB=1` env flag.

Subtask: `e2e/seeds/synthetic.sql` (or similar) — fully anonymized DB seed for visual-regression baseline capture. Pairs with this spec.

### 3. `scripts/test-migration-replay.sh`

Boot a fresh DB container, apply all migrations, apply them a second time, assert both runs succeed without error. One-line CI step. Catches non-idempotent `CREATE FUNCTION`, missing `IF NOT EXISTS`, and migration-recovery regressions.

### 4. CI integration

Wire `scripts/test-fresh-install.sh`, `scripts/test-migration-replay.sh`, the reverse-proxy spec, the visual-regression spec, and the PII scan (#5 below) into `.github/workflows/` on every PR. Currently only `jest` and `playwright test` defaults run; the modality-specific suites need explicit invocations.

### 6. `scripts/scan-examples.sh` ✅ (script landed; recurring human review)

Surfaces every `placeholder="..."` and "e.g." / "for example" instance in the tracked codebase for human review. Maintainers naturally write these from their own real data ("e.g. Lincoln Park Zoo" because the maintainer lives in Chicago; "e.g., Grandma Helen" because their kid actually has a Grandma Helen). Even when the rest of the codebase is anonymized, these tend to drift toward real names / places.

**Run:** `npm run scan:examples`. Always exits 0 — this is a review tool, not a gate. Eyeball each line and ask: **does this string come from my real life?** If yes, swap to a generic alternative.

Suggested generic alternatives:
- Names → first names like "Alex", "Emma", "Jordan", "Sophie" (matches Prism's anonymized seed)
- Cities / landmarks → multi-region rotation: "Kauai, Rome, Banff" rather than one-city-only
- Schools / employers → never use a real one
- Phone numbers → `(555) 01xx-xxxx` (reserved-for-fiction range)
- Email addresses → `name@example.com` (reserved-for-documentation domain)

This audit is **complementary to `scan-pii.sh`**:
- `scan-pii.sh` — catches values explicitly on the maintainer's denylist (high-precision, low-recall — only finds what you knew to look for)
- `scan-examples.sh` — surfaces all candidate spots so the maintainer can review (low-precision, high-recall — finds things you didn't realize were specific to your life)

Run `scan-examples` before each release tag and after merging large feature work.

### 5. `scripts/scan-pii.sh` ✅ (script landed; denylist is per-maintainer setup)

Whole-word, fixed-string grep that fails if any tracked file contains items from a maintainer-curated personal denylist. Catches the class of leak that surfaced in `formatters.test.ts` (fictional-looking test fixture that actually used real first names from the maintainer's family).

**Setup per maintainer** (one-time):

1. Create `~/.config/prism-pii-denylist.txt` — one entry per line. Comments start with `#`. Categories to consider:
   - Real first / last names of household members
   - Street addresses, school names, employer names
   - Phone numbers (anything not in the `555-01xx` reserved-for-fiction range)
   - Email addresses other than the maintainer's public commit identity
   - Personal GPS coordinates (for the travel feature)
2. (Optional) Install the pre-push hook so it runs automatically before every `git push`:
   ```bash
   npm run scan:pii:install-hook
   ```
3. Run manually anytime: `npm run scan:pii`

The denylist file MUST live outside the repo and MUST NOT be committed. Each maintainer populates their own — committed values would defeat the purpose. The script exits cleanly (with a warning) if the denylist file doesn't exist, so contributors who haven't set it up don't have their pushes blocked.

Why this catches what LLM review misses: an LLM has no way of knowing whether `'Eric'` is fictional or refers to the maintainer's spouse. A maintainer-curated denylist closes that gap with one grep. Cheap, deterministic, and survives changes to who's reviewing.

## Background

This document was created after fork contributions (JD-Gonz, sevenlayercookie, iann) caught a number of bugs that LLM-only review had missed. The list of "shipped past panel review" bugs above came directly from those contributions plus issues uncovered during the perf-mode toolbar saga (April 2026). Documenting the failure mode, not just the fixes, is the durable improvement.

## Specific lessons worth re-stating

These are *not* one-time anecdotes; they're durable engineering rules that any future Prism work should respect. Worth re-reading whenever a new tool or script is being designed.

### Filesystem paths on Windows have THREE flavors

Any script that resolves a path under the user's home directory on Windows must support all three bash environments simultaneously:

| Bash flavor | `$HOME` | C: drive accessed at |
|---|---|---|
| Git Bash | `/c/Users/Foo` | `/c/Users/Foo/` |
| WSL (1 or 2) | `/home/<user>` | `/mnt/c/Users/Foo/` |
| Cygwin / msys2 | varies | `/cygdrive/c/Users/Foo/` |

Plus: `$USERPROFILE` may or may not be propagated into bash's environment depending on how bash was spawned (npm scripts on Windows often spawn bash *without* `USERPROFILE`).

Robust path discovery: try `$PRISM_PII_DENYLIST`, then `$HOME/...`, then `$USERPROFILE/...` (if set), then ask `cmd.exe /c "echo %USERPROFILE%"` and try BOTH `/c/...` and `/mnt/c/...` derivations of the result. See `scripts/scan-pii.sh` for a worked example.

### Scripts that loop over entries × files are O(N×M)

The first version of `scan-pii.sh` ran one `grep -wF -- "$entry"` per denylist entry. With ~50 entries and ~1500 tracked files, that's 75,000 file scans and ran 30+ seconds. The fix is `grep -f tempfile` to read all patterns from a single file and do **one** Aho-Corasick pass. Same correctness, ~10× faster. Whenever a script's body is "for each entry, scan all files," look for the single-pass equivalent before shipping.
