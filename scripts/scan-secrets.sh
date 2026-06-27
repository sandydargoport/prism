#!/usr/bin/env bash
# ============================================================================
# Prism — Secret / Personal-Endpoint Scanner
# ============================================================================
# Catches the bug class that scan-pii.sh and scan-hostnames.sh both miss:
# a *secret-shaped value* hardcoded into real config or code (NOT a comment,
# NOT a known denylist word). This is precisely how a personal healthchecks.io
# ping UUID once shipped baked into the public docker-compose.yml — every
# clone then pinged the maintainer's check. See backup HC_URL history.
#
# Unlike scan-pii (needs a curated denylist) and scan-hostnames (comment-only,
# allowlist of hostnames), this scanner is zero-config and pattern-based: it
# looks for value SHAPES that are almost never legitimate in a public repo —
# dead-man ping URLs carrying a real UUID, private LAN IPs with real octets,
# cloud-provider tokens, private keys, etc.
#
# Anything matching a placeholder shape (your-own-uuid-here, x.x, <...>,
# example.com, REDACTED) is deliberately NOT a secret and won't match the
# real-value patterns, so .env.example documentation stays clean.
#
# USAGE
# -----
#   bash scripts/scan-secrets.sh
#
# Exits 0 if clean, 1 if any tracked file contains a secret-shaped value.
# If a legitimate value trips the scan, anonymize it (move the real value to
# an uncommitted .env and reference it as ${VAR}) rather than weakening a
# pattern. Wire into .husky/pre-push so it runs before every push.
# ============================================================================

set -euo pipefail

# UUID fragment reused below. A real v4-ish UUID; placeholders like
# "your-own-uuid-here" do not match it, so example files stay clean.
UUID='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

# Each rule: a label and an ERE pattern. A match on any is a violation.
# Patterns are intentionally tight to keep the false-positive rate near zero.
PATTERNS=(
  # Dead-man / healthcheck ping URLs carrying a real UUID (the leak that
  # started all this). Placeholder forms have no UUID, so they don't match.
  "healthcheck-ping-url|(hc-ping\.com|healthchecks\.io/ping)/${UUID}"
  # Private LAN IPv4 with real octets (192.168.x.x docs use literal 'x.x'
  # which has no digits, so it won't match).
  "private-lan-ipv4|(\b192\.168\.[0-9]{1,3}\.[0-9]{1,3}\b|\b10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b|\b172\.(1[6-9]|2[0-9]|3[01])\.[0-9]{1,3}\.[0-9]{1,3}\b)"
  # Cloudflare tunnel token (base64 of {"a":"...}) — starts eyJhIjoi.
  "cloudflare-tunnel-token|eyJhIjoi[A-Za-z0-9_-]{40,}"
  # Cloud / service credential prefixes.
  "aws-access-key|\bAKIA[0-9A-Z]{16}\b"
  "github-token|\bgh[pousr]_[A-Za-z0-9]{36,}\b"
  "slack-token|\bxox[baprs]-[A-Za-z0-9-]{10,}\b"
  "google-api-key|\bAIza[0-9A-Za-z_-]{35}\b"
  "openai-key|\bsk-[A-Za-z0-9]{40,}\b"
  "private-key-block|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----"
)

# Files to scan: every tracked file except binaries, lockfiles, snapshots,
# and the scanners themselves (which contain these patterns as literals).
TARGETS=$(git ls-files \
  | grep -v -E '^(scripts/scan-(pii|examples|hostnames|secrets)\.sh|docs/code-review-modalities\.md|package-lock\.json|.*\.lock|.*\.snap)$' \
  || true)

if [ -z "$TARGETS" ]; then
  echo "[scan-secrets] No files to scan."
  exit 0
fi

violations=""
for rule in "${PATTERNS[@]}"; do
  label="${rule%%|*}"
  pat="${rule#*|}"
  files="$TARGETS"
  # Private-IP literals are legitimate — and required — under src/: the recipe
  # URL importer's SSRF guard (safeFetch.ts, recipeParser.ts) must name the
  # RFC1918 ranges it blocks, and tests exercise them with textbook addresses.
  # A real *personal* LAN IP leaks through config/deploy/docs, so scope there.
  if [ "$label" = "private-lan-ipv4" ]; then
    files=$(printf '%s\n' "$TARGETS" | grep -v -E '^src/' || true)
  fi
  [ -n "$files" ] || continue
  hits=$(printf '%s\n' "$files" | xargs -d '\n' grep -nHE -I "$pat" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    violations="${violations}${violations:+$'\n'}$(printf '%s\n' "$hits" | sed "s/^/  [$label] /")"
  fi
done

if [ -z "$violations" ]; then
  echo "[scan-secrets] Clean: no secret-shaped values in tracked files."
  exit 0
fi

count=$(printf '%s\n' "$violations" | wc -l)
echo "[scan-secrets] SECRET-SHAPED VALUES IN TRACKED FILES:"
printf '%s\n' "$violations"
echo ""
echo "[scan-secrets] FAIL: $count match(es)."
echo "Move the real value to an uncommitted .env and reference it as \${VAR}."
echo "Placeholders (your-own-uuid-here, x.x, example.com) are fine — use those in .env.example."
exit 1
