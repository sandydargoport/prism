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
| A test fixture that read as fictional but wasn't | Cross-artifact (PII) |
| A scanner couldn't find its config file when run via npm-spawned bash on WSL | Cross-environment (path resolution) |
| A scanner ran 30+ seconds over a 50-entry list (per-entry loop instead of single-pass `grep -f`) | Performance / algorithmic |

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
| Reverse-proxy deployment | HTTPS detection, secure cookie handling, `x-forwarded-proto`-dependent code | `e2e/reverse-proxy.spec.ts` — runs in CI ("E2E modality suite") |
| Migration replay | Idempotency, recovery from partial failure | `npm run test:migration-replay` (`scripts/test-migration-replay.sh`) — runs in CI |
| Visual regression | Color contrast, layout regressions across themes, accidental rendering changes | `e2e/visual-regression.spec.ts` — spec runs in CI; **Linux baselines still needed** (see below) |
| Secret-shape scan | Committed API keys, tokens and private-key blocks | `npm run scan:secrets` (`scripts/scan-secrets.sh`) |

## Operational rules

- For any change touching **auth, cookies, env-var contracts, or schema migrations**, the relevant execution-modality test must run **before commit** — type-check alone is not sufficient.
- For any visual change, capture a Playwright screenshot in **both light and dark themes** and compare to baseline. If no baseline exists, capture one in the same commit.
- Bugs reported by users that match one of the modality patterns above must be **reproduced via that modality before fixing** — adding the test is the first commit of the fix.
- Text-only review (reading code, even adversarially) is **complementary**, not substitutable. Two LLM panels disagreeing about color contrast is still zero useful signal about color contrast.
- When in doubt about which modality applies, ask before declaring a change verified.

## Modality implementation status

Every execution modality in the table above is **implemented and wired into `.github/workflows/ci.yml`** (each runs on every PR), except for one remaining gap — Linux visual-regression baselines — called out at the end.

### Install flow — `scripts/test-fresh-install.sh`

Boots a clean install and asserts the fresh-install env / secret contracts hold. CI job: "Test Fresh Install".

### Reverse-proxy deployment — `e2e/reverse-proxy.spec.ts`

A Playwright suite that boots nginx in front of the app with a self-signed cert, hits `/api/auth/login` over HTTPS via the proxy, and asserts the response sets `Set-Cookie` with `Secure; HttpOnly`. Catches the `x-forwarded-proto` regression class. CI job: "E2E modality suite (reverse-proxy)" (also runs `e2e/mobile-pwa-settings.spec.ts`).

### Migration replay — `scripts/test-migration-replay.sh`

Boots a fresh DB container, applies all migrations, applies them a second time, and asserts both runs succeed without error. Catches non-idempotent `CREATE FUNCTION`, missing `IF NOT EXISTS`, and migration-recovery regressions. Run locally with `npm run test:migration-replay`; CI job: "Migration replay".

### Secret-shape scan — `scripts/scan-secrets.sh`

Fails if a tracked file contains something shaped like a credential: an AWS or
GitHub or Slack or OpenAI key, a private-key block, a connection string with a
password in it. Run `npm run scan:secrets`; it also runs pre-commit, pre-push
and in CI ("Repo hygiene").

Scanning for a project maintainer's own personal data is a different job with a
different owner, and it is not done here. It needs a list of that person's real
values, which is theirs to hold and not something a repository should carry on
their behalf, so it lives in their own tooling outside this repo.

### Remaining gap — Linux visual-regression baselines

`e2e/visual-regression.spec.ts` exists and its CI job runs ("Visual regression"), covering the dashboard (default + perf-mode), calendar, settings, login landing, and the PIN modal in light + dark themes. **But every committed baseline is `-chromium-win32.png` while CI runs on Linux** (`-chromium-linux.png`) — so no baseline matches, the comparison is silently skipped, and the modality is effectively a no-op until Linux baselines land. Two constraints gate that:

- **PII:** baselines from a live deployment capture real names, calendar events, photos, weather city, and other personal data — the `CLAUDE.md` PII policy forbids committing those.
- **Prerequisite:** a **synthetic-seed test database** with anonymized fixtures (`Alex/Jordan/Emma/Sophie` family members, fixture wallpaper, fictional events, fictional weather location). Baselines must be captured only against that seed (`e2e/seeds/synthetic.sql` or similar); until it exists, the spec auto-skips unless `E2E_HAS_TEST_DB=1`.

To (re)capture Linux baselines once the synthetic seed exists, run the CI workflow via `workflow_dispatch` with `update_visual_baselines=true`, download the artifact, and commit the resulting `*-chromium-linux.png` files.

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

Robust path discovery: try the script's own environment variable, then `$HOME/...`, then `$USERPROFILE/...` (if set), then ask `cmd.exe /c "echo %USERPROFILE%"` and try BOTH `/c/...` and `/mnt/c/...` derivations of the result.

### Scripts that loop over entries × files are O(N×M)

One scanner here began as a `grep -wF -- "$entry"` per list entry. With ~50 entries and ~1500 tracked files, that's 75,000 file scans and ran 30+ seconds. The fix is `grep -f tempfile` to read all patterns from a single file and do **one** Aho-Corasick pass. Same correctness, ~10× faster. Whenever a script's body is "for each entry, scan all files," look for the single-pass equivalent before shipping.
