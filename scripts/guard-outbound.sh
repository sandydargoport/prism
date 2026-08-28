#!/usr/bin/env bash
# ============================================================================
# PreToolUse guard — blocks publishing PII or AI attribution to GitHub.
#
# WHY
# ---
# scripts/scan-pii.sh runs pre-commit over tracked files, so nothing reaches a
# *file* uncleaned. But `gh pr create`, `gh issue comment`, `gh pr edit`,
# `gh release create` and friends publish text that never touches the working
# tree, so they bypassed every check that existed.
#
# That gap published a real town and postal code, copied out of a live running
# instance, into a public PR body. The town was already in the denylist. The
# rule existed; nothing enforced it on this path.
#
# This hook reads the proposed Bash command, extracts whatever body text it
# would publish (--body, --body-file, --notes, --notes-file, --title), and
# refuses the call if scan-text.sh objects.
#
# It also blocks AI attribution ("Generated with Claude Code", Co-Authored-By
# trailers), which CLAUDE.md forbids and which kept reappearing because the
# harness default adds it.
#
# INPUT : hook JSON on stdin ({"tool_input":{"command":"..."}})
# OUTPUT: exit 0 allows; exit 2 blocks and returns the reason to the model.
# ============================================================================
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCANNER="$REPO_DIR/scripts/scan-text.sh"

payload=$(cat)
cmd=$(printf '%s' "$payload" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || echo "")
[ -n "$cmd" ] || exit 0

# Only guard commands that actually publish to GitHub.
grep -qE '\bgh\s+(pr|issue|release|api|gist)\b' <<<"$cmd" || exit 0
grep -qE '\-\-(body|body-file|notes|notes-file|title)\b|addDiscussionComment|createIssue|updateIssue' <<<"$cmd" || exit 0

tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT

# Inline --body / --title / --notes values.
python3 - "$cmd" >>"$tmp" <<'PY' 2>/dev/null || true
import re, sys
c = sys.argv[1]
for m in re.finditer(r'--(?:body|title|notes)[= ]\s*(["\'])(.*?)\1', c, re.S):
    print(m.group(2))
# GraphQL discussion/issue mutations carry the text inline too.
for m in re.finditer(r'body\s*:\s*(["\'])(.*?)\1', c, re.S):
    print(m.group(2))
PY

# Referenced --body-file / --notes-file contents.
while read -r f; do
  [ -r "$f" ] && cat "$f" >>"$tmp"
done < <(grep -oE '\-\-(body-file|notes-file)[= ]\s*[^ ]+' <<<"$cmd" | sed -E 's/.*(body-file|notes-file)[= ]\s*//' | tr -d '"'"'"'')

# Process substitution: --notes-file <(awk ... FILE)
while read -r f; do
  [ -r "$f" ] && cat "$f" >>"$tmp"
done < <(grep -oE '<\(.*?([A-Za-z0-9_./-]+\.md)' <<<"$cmd" | grep -oE '[A-Za-z0-9_./-]+\.md' || true)

[ -s "$tmp" ] || exit 0

# --- AI attribution (CLAUDE.md forbids it anywhere) -------------------------
if grep -qiE 'generated with \[?claude code|co-authored-by:.*claude|🤖 generated' "$tmp"; then
  echo "BLOCKED: this text contains AI attribution. CLAUDE.md forbids it in commits, PR bodies, issue and discussion comments, and release notes. Remove the line and retry." >&2
  exit 2
fi

# --- PII ---------------------------------------------------------------------
if ! out=$(bash "$SCANNER" "$tmp" 2>&1); then
  echo "BLOCKED: this text would publish maintainer PII to GitHub." >&2
  echo "$out" >&2
  echo "Replace the offending values with fictional stand-ins. Never paste values read from the live database, .env, or a running container into anything published." >&2
  exit 2
fi
exit 0
