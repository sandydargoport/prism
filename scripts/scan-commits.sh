#!/usr/bin/env bash
# ============================================================================
# Prism — PII scanner for COMMIT MESSAGES AND COMMIT METADATA.
#
# WHY THIS EXISTS
# ---------------
# `.husky/commit-msg` already scans a message, but it is a local hook and local
# hooks are advisory: `--no-verify` skips it, and so does anything that never
# touches this machine. A commit authored in the github.com web editor, a bot
# commit, and a message typed into the squash-merge box all reach the default
# branch without that hook ever running.
#
# The server-side scan next to it (scripts/scan-pii.sh in CI) reads
# `git ls-files`, so it sees the tree and never the message. Between them,
# commit text had a local gate and no enforced one. An audit found personal
# data in published commit messages, including in the messages of the commits
# whose whole purpose was removing it from the files, so this is not a
# hypothetical surface.
#
# Author and committer identity are scanned for the same reason. They are
# published with every commit and nothing checked them. The repository's own
# identities are GitHub noreply addresses, which the email rule already treats
# as safe, so an ordinary commit passes and a real address, which is the thing
# worth catching, does not.
#
# USAGE
#   bash scripts/scan-commits.sh <git-range>     # e.g. origin/master..HEAD
#   bash scripts/scan-commits.sh --all           # every commit, every ref
#
# Exits 0 if clean, 1 on any match. In CI, set PRISM_SCAN_REDACT=1 so matches
# report a position and never the value: the log is public, and printing the
# line would republish exactly what is being caught.
# ============================================================================
set -uo pipefail

RANGE="${1:-}"
if [ -z "$RANGE" ]; then
  echo "[scan-commits] usage: scan-commits.sh <git-range>|--all" >&2
  exit 2
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "[scan-commits] not a git repository" >&2; exit 2; }
cd "$ROOT" || exit 2

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
TEXT="$WORK/commits.txt"

# One block per commit. The sha header means a reported line number can be
# traced back to a specific commit by whoever re-runs this locally, without the
# report itself having to quote anything.
if [ "$RANGE" = "--all" ]; then
  GIT_ARGS=(--all)
else
  GIT_ARGS=("$RANGE")
fi

git log "${GIT_ARGS[@]}" --format='--- commit %H%nauthor %an <%ae>%ncommitter %cn <%ce>%n%s%n%b' > "$TEXT" 2>/dev/null

if [ ! -s "$TEXT" ]; then
  echo "[scan-commits] No commits in range '$RANGE' — nothing to scan."
  exit 0
fi

COUNT=$(grep -c '^--- commit ' "$TEXT" || true)
echo "[scan-commits] Scanning $COUNT commit(s) from '$RANGE'."

fail=0

# Layer 1 + built-in pattern rules.
bash "$ROOT/scripts/scan-text.sh" "$TEXT" || fail=1

# Layer 2, the hashed denylist. Only runs where the salt is present; the caller
# decides whether a missing salt is tolerable, because CI must treat it as a
# failure while a local run legitimately has no salt at all.
if [ -n "${PRISM_PII_SALT:-}" ]; then
  python3 "$ROOT/scripts/pii-hashes.py" scan-text "$TEXT" || fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "[scan-commits] Clean: no matches in commit messages or metadata."
else
  echo "[scan-commits] Commit text matched. A pushed commit message cannot be" >&2
  echo "               edited afterwards, so fix this before it lands: rewrite" >&2
  echo "               the message (git rebase -i) rather than adding a new" >&2
  echo "               commit on top." >&2
fi
exit "$fail"
