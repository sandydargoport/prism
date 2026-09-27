#!/usr/bin/env bash
# ============================================================================
# Prism: run the whole jest suite once per time zone
# ============================================================================
# Jest reads TZ once, at process start, so a zone cannot be switched inside a
# test file. Every date bug that has reached users was invisible in UTC, which
# is where CI and the dev box both run, so the suite repeats in zones that
# break the usual assumptions:
#
#   UTC                 the baseline, and what a default server runs in
#   America/Chicago     west of UTC, with DST: evenings are already tomorrow
#                       in UTC
#   Asia/Tokyo          east of UTC, no DST: mornings are still yesterday
#                       in UTC
#   Pacific/Kiritimati  UTC+14: noon UTC is already the next local day, which
#                       catches the "UTC noon is safe everywhere" shortcut
#
# Runs every zone even after a failure, then exits non-zero if any failed.
# Extra arguments pass through to jest: `npm run test:tz -- --ci`.
# Override the list with TZ_ZONES="Asia/Kolkata Europe/Berlin".
# ============================================================================

set -u

zones=${TZ_ZONES:-"UTC America/Chicago Asia/Tokyo Pacific/Kiritimati"}
failed=()

for zone in $zones; do
  echo
  echo "=== jest in TZ=$zone ==="
  if ! TZ="$zone" npx jest "$@"; then
    failed+=("$zone")
  fi
done

echo
if [ ${#failed[@]} -gt 0 ]; then
  echo "Failed in: ${failed[*]}"
  exit 1
fi
echo "Passed in: $zones"
