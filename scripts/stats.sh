#!/usr/bin/env bash
# Print Prism telemetry install stats from the collector Worker's token-gated
# /stats endpoint, so you never have to paste the token on the command line.
#
# Token resolution order:
#   1. $STATS_TOKEN in the environment
#   2. STATS_TOKEN=... in collector/.dev.vars (gitignored; the same file
#      wrangler already uses for local secrets)
#
# Override the endpoint with $PRISM_STATS_URL if the Worker ever moves.
#
# Usage:  bash scripts/stats.sh    (or: npm run stats)
set -euo pipefail
cd "$(dirname "$0")/.."

URL="${PRISM_STATS_URL:-https://prism-telemetry.sandydargoport.workers.dev/stats}"

TOKEN="${STATS_TOKEN:-}"
if [[ -z "$TOKEN" && -f collector/.dev.vars ]]; then
  line="$(grep -E '^[[:space:]]*STATS_TOKEN[[:space:]]*=' collector/.dev.vars | head -1 || true)"
  TOKEN="${line#*=}"
  TOKEN="$(printf '%s' "$TOKEN" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
    -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//" -e 's/\r$//')"
fi

if [[ -z "$TOKEN" ]]; then
  cat >&2 <<'ERR'
No STATS_TOKEN found.
  - Put it in collector/.dev.vars (gitignored):  STATS_TOKEN=your-token
    (cp collector/.dev.vars.example collector/.dev.vars, then fill it in)
  - or export STATS_TOKEN before running.
ERR
  exit 1
fi

resp="$(curl -fsS "${URL}?token=${TOKEN}")" \
  || { echo "Request failed (check the token, network, or endpoint)." >&2; exit 1; }

if command -v jq >/dev/null 2>&1; then
  printf '%s' "$resp" | jq .
elif command -v python3 >/dev/null 2>&1; then
  printf '%s' "$resp" | python3 -m json.tool
else
  printf '%s\n' "$resp"
fi
