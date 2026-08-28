#!/usr/bin/env bash
# ============================================================================
# Prism — PII scanner for OUTBOUND TEXT (PR bodies, issue/discussion comments,
# release notes: anything published to GitHub that is not a tracked file).
#
# WHY THIS EXISTS
# ---------------
# scripts/scan-pii.sh runs pre-commit over `git ls-files`, so it only ever sees
# tracked files. A pull-request body, an issue comment and a discussion reply
# are GitHub metadata, never touch the working tree, and were therefore
# completely unscanned.
#
# That gap leaked a real town and postal code into a public PR body as
# before/after "evidence" pulled from the maintainer's live instance. The town
# was already in the denylist; nothing simply ever checked. Live data copied
# out of a running instance is the highest-risk text there is, because it is
# real by construction.
#
# USAGE
#   bash scripts/scan-text.sh <file>          # scan a drafted body
#   cat body.md | bash scripts/scan-text.sh   # or via stdin
#
# Exits 0 if clean, 1 on any match. Matched denylist entries are reported by
# position, never printed, so running this in a shared terminal cannot itself
# leak the list.
#
# DENYLIST: same file as scan-pii.sh —
#   $PRISM_PII_DENYLIST  OR  ~/.config/prism-pii-denylist.txt
# ============================================================================
set -uo pipefail

INPUT="${1:-/dev/stdin}"
[ -r "$INPUT" ] || { echo "[scan-text] cannot read: $INPUT" >&2; exit 2; }
TEXT=$(cat "$INPUT")
fail=0

# ── Layer 1: maintainer denylist (real names, town, address, IPs, domains) ──
DENYLIST="${PRISM_PII_DENYLIST:-$HOME/.config/prism-pii-denylist.txt}"
if [ -f "$DENYLIST" ]; then
  n=0
  while IFS= read -r entry; do
    case "$entry" in ''|\#*) continue ;; esac
    n=$((n + 1))
    # Word-boundary match, not substring. A short denylist entry (a first name,
    # a street) otherwise fires inside ordinary words — "install", "Locale" and
    # "milestone" all matched on an early version, and a scanner that cries wolf
    # is one people learn to ignore. Entries containing punctuation or spaces
    # (IPs, domains, addresses) fall back to a plain substring match, since word
    # boundaries behave badly around dots and dashes.
    if [[ "$entry" =~ ^[A-Za-z0-9]+$ ]]; then
      match_expr="\\b${entry}\\b"
      hit=$(grep -niE -- "$match_expr" <<<"$TEXT" | head -3)
    else
      hit=$(grep -niF -- "$entry" <<<"$TEXT" | head -3)
    fi
    if [ -n "$hit" ]; then
      echo "[scan-text] DENYLIST MATCH: entry #$n (value withheld)"
      sed 's/^/    line /' <<<"$hit"
      fail=1
    fi
  done < "$DENYLIST"
else
  echo "[scan-text] WARNING: no denylist at $DENYLIST — layer 1 skipped" >&2
fi

# ── Layer 2: built-in patterns ──────────────────────────────────────────────
check() {
  local label="$1" pattern="$2"
  if grep -qEi -- "$pattern" <<<"$TEXT"; then
    echo "[scan-text] $label:"
    grep -nEi -- "$pattern" <<<"$TEXT" | head -3 | sed 's/^/    /'
    fail=1
  fi
}

# Private / LAN / Tailscale addresses.
check "private IP" '\b(10\.[0-9]{1,3}|192\.168|172\.(1[6-9]|2[0-9]|3[01])|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7]))\.[0-9]{1,3}(\.[0-9]{1,3})?\b'
# Real-looking emails. grep -E has no lookahead, so match broadly then drop
# the addresses that are safe by definition (RFC2606 examples, GH noreply).
if grep -oEi -- '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b' <<<"$TEXT" \
     | grep -viE '@(example\.(com|org|net)|.*users\.noreply\.github\.com)$' | grep -q .; then
  echo "[scan-text] email address:"
  grep -nEi -- '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b' <<<"$TEXT" | head -3 | sed 's/^/    /'
  fail=1
fi
# US ZIP+state pairs, the shape that leaked.
check "US postal code" '\b[A-Z]{2},?\s+[0-9]{5}(-[0-9]{4})?\b'
# Lat/long pairs precise enough to locate a home.
check "GPS coordinates" '\b-?[0-9]{1,3}\.[0-9]{4,},\s*-?[0-9]{1,3}\.[0-9]{4,}\b'

if [ "$fail" -eq 0 ]; then
  echo "[scan-text] Clean: safe to publish."
else
  echo "[scan-text] Do NOT publish. Replace the offending values with fictional stand-ins." >&2
fi
exit "$fail"
