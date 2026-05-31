#!/usr/bin/env bash
# ============================================================================
# Prism — Hostname-in-Comment Heuristic Scanner
# ============================================================================
# Catches the bug class where a real production hostname is written into a
# code comment as helpful documentation and quietly ships to public master.
# Complementary to scan-pii.sh: that one needs the maintainer to know what
# to put on the denylist, this one needs nothing and catches anything that
# looks like a real hostname in a place a hostname should not be.
#
# Heuristic, in two filters:
#   1. Match tokens of the shape label.label or label.label.label whose
#      *last label* is a known public TLD (com, net, org, io, etc.).
#      This eliminates the JavaScript-property-access false positives
#      (foo.bar.baz where baz is a method name) since those last labels
#      are not on the TLD list.
#   2. Drop tokens whose full hostname is on the project allowlist (the
#      project's own GitHub URL, vendor docs the comments may legitimately
#      reference, etc.).
#
# Anything that survives both filters is a real-looking hostname in a
# code comment, which is the bug shape we are catching.
#
# USAGE
# -----
#   bash scripts/scan-hostnames.sh
#
# Exits 0 if clean, 1 if any tracked file has a non-allowlisted hostname
# in a comment. False-positive rate is non-zero. If a legitimate hostname
# trips the scan, add it to the allowlist below rather than weakening
# the heuristic.
# ============================================================================

set -euo pipefail

# Public TLDs that real hostnames commonly use. This is intentionally
# narrow: covers what actually appears in production hostnames in code
# comments, ignores the long tail of country codes and gTLDs we are
# unlikely to ever see legitimately. Add entries if a real hit gets
# missed because of an unusual TLD.
PUBLIC_TLDS="com|net|org|io|co|ai|app|dev|gg|me|xyz|info|biz|us|uk|ca|de|fr|jp|cn|au|in|eu|tv|cloud|tech|edu|gov|mil|int"

# Hostnames that legitimately appear in code comments. One per line,
# fixed-string. Match is whole-token: a token must equal the entry
# exactly, OR end with .<entry> preceded by a label boundary.
ALLOWLIST=(
  # Reserved-for-documentation per RFC 2606
  "example.com"
  "example.net"
  "example.org"
  "example.edu"
  # Project repo / GitHub
  "github.com"
  "githubusercontent.com"
  "ghcr.io"
  "sandydargoport.github.io"
  # Common vendor docs the comments may legitimately reference
  "graph.microsoft.com"
  "googleapis.com"
  "openweathermap.org"
  "open-meteo.com"
  "pirateweather.net"
  "calendar.google.com"
  "console.cloud.google.com"
  "developers.google.com"
  "registry.npmjs.org"
  "nodejs.org"
  "npmjs.com"
  "drizzle.team"
  "tailwindcss.com"
  "nextjs.org"
  "vercel.com"
  "vercel.app"
  "anthropic.com"
  "claude.com"
  # Amazon / Alexa skill development
  "developer.amazon.com"
  "s3.amazonaws.com"
  "echo-api.amazon.com"
  # Kroger integration
  "developer.kroger.com"
  "api.kroger.com"
  "kroger.com"
  # IETF / spec / standards references
  "ietf.org"
  "w3.org"
  "wikipedia.org"
  "schema.org"
  # Library docs the comments reference
  "date-fns.org"
  "rclone.org"
  "playwright.dev"
  # Apple iCloud DAV endpoints (CalDAV calendars + CardDAV contacts)
  "caldav.icloud.com"
  "contacts.icloud.com"
  "appleid.apple.com"
  # Common public-suffix anchors that show up via vendor doc URLs
  "google.com"
  "microsoft.com"
  "apple.com"
)

# Build a single regex alternation for the allowlist.
allow_pattern=""
for entry in "${ALLOWLIST[@]}"; do
  escaped="${entry//./\\.}"
  if [ -z "$allow_pattern" ]; then
    allow_pattern="${escaped}"
  else
    allow_pattern="${allow_pattern}|${escaped}"
  fi
done

# Files we scan: source-shaped extensions only. Skip binaries, lockfiles,
# snapshots, and the scanners themselves.
SCAN_FILES_PATTERN='\.(ts|tsx|js|jsx|mjs|cjs|sh|py|md|yml|yaml|json|css|scss|sql)$'
TARGETS=$(git ls-files \
  | grep -E "$SCAN_FILES_PATTERN" \
  | grep -v -E '^(scripts/scan-(pii|examples|hostnames)\.sh|docs/code-review-modalities\.md|.*\.snap$|package-lock\.json|.*\.lock$)$' \
  || true)

if [ -z "$TARGETS" ]; then
  echo "[scan-hostnames] No matching files to scan."
  exit 0
fi

# Match comment lines (// or # or * leading after whitespace).
matches=$(echo "$TARGETS" | xargs -d '\n' grep -nHE \
  '^[[:space:]]*(\/\/|#|\*)' \
  2>/dev/null \
  || true)

if [ -z "$matches" ]; then
  echo "[scan-hostnames] Clean: no comment lines to scan."
  exit 0
fi

# Filter: extract hostname-shaped tokens from the line *content* (not
# the path:lineno: prefix). Keep only tokens whose last label is a
# public TLD. Drop tokens that match the allowlist.
violations=$(echo "$matches" | awk \
  -v allow="$allow_pattern" \
  -v public_tlds="$PUBLIC_TLDS" \
  '
  function strip_prefix(line) {
    # path:lineno:content. Split off the first two colons.
    p1 = index(line, ":")
    rest = substr(line, p1 + 1)
    p2 = index(rest, ":")
    return substr(rest, p2 + 1)
  }
  function get_prefix(line) {
    p1 = index(line, ":")
    rest = substr(line, p1 + 1)
    p2 = index(rest, ":")
    return substr(line, 1, p1 + p2)
  }
  BEGIN {
    n_tlds = split(public_tlds, tlds, "|")
    n_allow = split(allow, allowed, "|")
    for (i = 1; i <= n_allow; i++) gsub(/[\\][.]/, ".", allowed[i])
  }
  {
    prefix = get_prefix($0)
    content = strip_prefix($0)

    bad_count = 0
    bad_tokens = ""
    line = content
    while (match(line, /[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+/)) {
      token = substr(line, RSTART, RLENGTH)
      line = substr(line, RSTART + RLENGTH)

      n = split(token, parts, ".")
      tld_lc = tolower(parts[n])

      # Filter 1: last label must be a public TLD.
      is_tld = 0
      for (i = 1; i <= n_tlds; i++) {
        if (tld_lc == tlds[i]) { is_tld = 1; break }
      }
      if (!is_tld) continue

      # Filter 2: drop allowlisted hostnames. Match is exact equality OR
      # token ends with .<entry>.
      ok = 0
      tl = length(token)
      for (i = 1; i <= n_allow; i++) {
        suffix = allowed[i]
        sl = length(suffix)
        if (token == suffix) { ok = 1; break }
        if (tl > sl + 1 && substr(token, tl - sl + 1) == suffix && substr(token, tl - sl, 1) == ".") {
          ok = 1; break
        }
      }
      if (ok) continue

      if (bad_count > 0) bad_tokens = bad_tokens ", "
      bad_tokens = bad_tokens token
      bad_count++
    }
    if (bad_count > 0) {
      print prefix content "  [hostname(s): " bad_tokens "]"
    }
  }
' || true)

if [ -z "$violations" ]; then
  echo "[scan-hostnames] Clean: no non-allowlisted hostnames in comments."
  exit 0
fi

count=$(printf '%s\n' "$violations" | wc -l)

echo "[scan-hostnames] NON-ALLOWLISTED HOSTNAMES IN COMMENTS:"
printf '%s\n' "$violations" | sed 's/^/  /'
echo ""
echo "[scan-hostnames] FAIL: $count line(s) with potentially-real hostnames in comments."
echo "If a hit is legitimate, add it to the ALLOWLIST in scripts/scan-hostnames.sh."
echo "Otherwise, scrub the hostname from the comment before pushing."
exit 1
