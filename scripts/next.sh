#!/usr/bin/env bash
# What to work on next, read straight from the issue tracker.
#
# The ranking lives on the issues themselves as P1/P2/P3 labels, so there is no
# second copy to go stale: closing an issue removes it from this list, and a new
# issue shows up under "unranked" until someone ranks it.
#
#   bash scripts/next.sh          # the whole ranked queue
#   bash scripts/next.sh 1        # just P1
#
# Requires the gh CLI, authenticated. Only needs the `repo` scope.

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "next: the gh CLI is not installed or not on PATH." >&2
  exit 1
fi

show() {
  local label="$1" heading="$2"
  local out
  out=$(gh issue list --state open --label "$label" --limit 100 \
        --json number,title -q '.[] | "  #\(.number)  \(.title)"' 2>/dev/null || true)
  if [[ -n "$out" ]]; then
    printf '\n%s\n%s\n' "$heading" "$out"
  fi
}

if [[ $# -gt 0 ]]; then
  case "$1" in
    1) show P1 "P1: do next" ;;
    2) show P2 "P2: after the P1 queue" ;;
    3) show P3 "P3: backlog, not scheduled" ;;
    *) echo "next: expected 1, 2 or 3 (got '$1')." >&2; exit 1 ;;
  esac
  echo
  exit 0
fi

show P1 "P1: do next"
show P2 "P2: after the P1 queue"
show P3 "P3: backlog, not scheduled"

# Anything open and unlabelled is the failure mode this script exists to catch:
# an issue that silently drops out of the ranking. Surface it loudly.
unranked=$(gh issue list --state open --limit 100 --json number,title,labels \
  -q '.[] | select([.labels[].name] | any(. == "P1" or . == "P2" or . == "P3") | not)
       | "  #\(.number)  \(.title)"' 2>/dev/null || true)

if [[ -n "$unranked" ]]; then
  printf '\nUNRANKED: needs a P1/P2/P3 label\n%s\n' "$unranked"
fi

echo
