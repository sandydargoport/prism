#!/usr/bin/env bash
# ============================================================================
# Prism — PII Scanner (built-in pattern rules + maintainer denylist)
# ============================================================================
# Two layers, both run on every push (and in CI):
#
#   1. BUILT-IN PATTERN RULES (committed, always on). Catch the classes of
#      maintainer-PII we know we care about, tuned against the tree so they do
#      NOT trip on legitimate security code (SSRF guards use private ranges) or
#      test fixtures (10.0.0.5, 169.254.169.254) or vendor/system emails.
#        - any email address other than an allowlisted one
#        - a specific private / Tailscale-CGNAT / link-local IP host in a
#          non-test, non-SSRF-guard file (the "real LAN IP in a comment" bug)
#
#   2. MAINTAINER DENYLIST (per-maintainer file, outside the repo). Fixed-string
#      list of the maintainer's REAL specifics — exact IPs, names, address,
#      phone, Tailscale IPs. This is the reliable catch for known PII anywhere,
#      with zero false positives. See "DENYLIST FILE" below.
#
# Exits 0 if clean. Exits 1 if either layer finds a match.
# ============================================================================
#
# DENYLIST FILE
# -------------
# Path: $PRISM_PII_DENYLIST (env var) OR ~/.config/prism-pii-denylist.txt
# Format: one fixed-string entry per line; '#' comments and blank lines ignored.
# MUST live outside the repo and MUST NOT be committed. Populate with:
#   - Real LAN / Tailscale IPs (e.g. 192.168.x.x, 10.x.x.x, 100.x.y.z)
#   - The real WAN/host DOMAIN(S) you use (this is the reliable catch for the
#     specific domain — it is intentionally NOT hardcoded in this public file)
#   - Real names of household members (first AND last)
#   - Street address, school name, employer name
#   - Phone numbers (anything not 555-01xx reserved-for-fiction)
#   - Personal GPS coordinates
# ============================================================================

set -uo pipefail

REPO_FILES=$(git ls-files | grep -vE '^(scripts/scan-(pii|examples|hostnames|secrets)\.sh|scripts/prism-pii-denylist\.example\.txt|docs/code-review-modalities\.md|package-lock\.json|.*\.lock)$' || true)

fail=0

# ── Layer 1: built-in pattern rules ─────────────────────────────────────────

# Files legitimately full of private-range IPs (SSRF guards + their tests) and
# security-audit prose. Private IPs there are generic examples, not PII.
IP_EXCLUDE='(/__tests__/|\.test\.|\.spec\.|^e2e/|src/app/api/recipes/import-url/route\.ts$|src/lib/integrations/(caldav|carddav|immich)\.ts$|src/lib/utils/safeFetch\.ts$|^docs/(audit-|code-review-modalities))'

# Emails that are NOT maintainer PII: the public commit identity, GitHub
# noreply, RFC2606 example domains, vendor/system addresses the integration code
# references, and obvious placeholder local-parts (you@, your-apple-id@, etc.).
EMAIL_ALLOW='(@example\.(com|org|net|edu)|@users\.noreply\.github\.com|sandydargoport@gmail\.com|contacts@group\.v\.calendar\.google\.com|@myfirstview\.com|noreply@|@sentry\.|(your-[a-z-]+|you|me|user|name|email|firstname|lastname|example|test)@)'

builtin=""

# NOTE: the maintainer's SPECIFIC domain/host literals are deliberately NOT
# hardcoded here — this file is public and must never itself carry that PII.
# The specific domain is caught by Layer 2 (the external denylist) everywhere,
# and by scan-hostnames.sh generically when it appears in a comment.

# 1. Any email not on the allowlist, anywhere.
m=$(printf '%s\n' "$REPO_FILES" | xargs -d '\n' grep -inHoE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' 2>/dev/null | grep -viE "$EMAIL_ALLOW" || true)
[ -n "$m" ] && builtin+="$m"$'\n'

# 2. A specific private / Tailscale / link-local IP HOST (not a /CIDR range, not
#    a .0.0 network) in a file that is not an SSRF guard or a test fixture.
#    The 100.x.x.x branch is intentionally the FULL /8 (not just the 100.64/10
#    CGNAT range) so any Tailscale host address is caught, per maintainer request.
m=$(printf '%s\n' "$REPO_FILES" | grep -vE "$IP_EXCLUDE" \
  | xargs -d '\n' grep -inHE '\b(192\.168|10\.[0-9]{1,3}|172\.(1[6-9]|2[0-9]|3[01])|100\.[0-9]{1,3}|169\.254)\.[0-9]{1,3}\.[0-9]{1,3}\b' 2>/dev/null \
  | grep -vE '\.0\.0([/. ]|$)' | grep -vE '/[0-9]{1,2}\b' || true)
[ -n "$m" ] && builtin+="$m"$'\n'

if [ -n "$builtin" ]; then
  echo "[scan-pii] BUILT-IN RULE MATCHES (maintainer domain / non-allowlisted email / private IP):"
  printf '%s' "$builtin" | grep -v '^$' | sed 's/^/  /'
  echo ""
  echo "[scan-pii] Scrub the value, or (if it is a legitimate example/vendor ref)"
  echo "add it to the allowlist near the top of scripts/scan-pii.sh."
  fail=1
fi

# ── Layer 2: maintainer denylist file ───────────────────────────────────────

DENYLIST=""
candidates=()
[ -n "${PRISM_PII_DENYLIST:-}" ] && candidates+=("$PRISM_PII_DENYLIST")
[ -n "${HOME:-}" ] && candidates+=("${HOME}/.config/prism-pii-denylist.txt")
if [ -n "${USERPROFILE:-}" ]; then
  win_home="${USERPROFILE//\\//}"; win_home="${win_home//C:/\/c}"; win_home="${win_home//D:/\/d}"
  candidates+=("${win_home}/.config/prism-pii-denylist.txt" "${USERPROFILE}/.config/prism-pii-denylist.txt")
fi
for path in "${candidates[@]:-}"; do
  [ -n "$path" ] && [ -f "$path" ] && { DENYLIST="$path"; break; }
done

if [ -z "$DENYLIST" ]; then
  echo "[scan-pii] NOTE: maintainer denylist not found (checked \$PRISM_PII_DENYLIST, ~/.config/prism-pii-denylist.txt)."
  echo "          Built-in rules still ran. For full coverage of your exact IPs/names/address,"
  echo "          create that file (one entry per line). Template: scripts/prism-pii-denylist.example.txt"
  [ "$fail" -eq 0 ] && echo "[scan-pii] Clean (built-in rules): no matches."
  exit "$fail"
fi

tmpfile=$(mktemp); trap 'rm -f "$tmpfile"' EXIT INT TERM
sed -e 's/\r$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' "$DENYLIST" | grep -v '^$' | grep -v '^#' > "$tmpfile"

if [ -s "$tmpfile" ]; then
  m=$(printf '%s\n' "$REPO_FILES" | xargs -d '\n' grep -iwn -H -F -I -f "$tmpfile" 2>/dev/null || true)
  if [ -n "$m" ]; then
    echo "[scan-pii] DENYLIST MATCHES:"
    printf '%s\n' "$m" | sed 's/^/  /'
    echo "[scan-pii] Anonymize the offending values before pushing."
    fail=1
  fi
fi

if [ "$fail" -eq 0 ]; then
  echo "[scan-pii] Clean: no built-in-rule or denylist matches."
fi
exit "$fail"
