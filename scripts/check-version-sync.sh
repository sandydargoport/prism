#!/usr/bin/env bash
# Verifies that package.json's version field matches the most recent
# versioned heading in docs/CHANGELOG.md (the "## [X.Y.Z] – ..." line that
# sits below "## Unreleased"). Fails CI if they drift.
#
# Run manually:   bash scripts/check-version-sync.sh
# Wired into CI:  .github/workflows/ci.yml (typecheck-lint job)
#
# Rationale for the check: every release lives in two files (package.json
# bumps the source of truth, CHANGELOG records the user-facing notes). If
# one is updated without the other, downstream surfaces drift — the GH
# Pages docs site shows old release notes, or the dashboard reports an
# old version. Single-pass check, no external deps beyond node.

set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
CHANGELOG_TOP=$(grep -E '^## \[[0-9]+\.[0-9]+\.[0-9]+\]' docs/CHANGELOG.md | head -1 \
  | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)

if [[ -z "$CHANGELOG_TOP" ]]; then
  echo "ERROR: docs/CHANGELOG.md has no versioned section heading."
  echo "       Expected a line matching '## [X.Y.Z] – ...' under '## Unreleased'."
  exit 1
fi

if [[ "$CHANGELOG_TOP" != "$VERSION" ]]; then
  echo "ERROR: version drift detected."
  echo "  package.json:        $VERSION"
  echo "  CHANGELOG.md (top):  $CHANGELOG_TOP"
  echo ""
  echo "Run 'bash scripts/release.sh <new-version>' to bump both in lockstep,"
  echo "or update the lagging file by hand and re-run this check."
  exit 1
fi

# Also gate against ha-app/config.yaml. The HA addon's `version:` field
# is what HA Supervisor uses to detect updates — if it drifts from
# package.json, the release pipeline pushes an image to the wrong tag
# and HA shows users a stale "Update available" badge that doesn't move.
HA_CONFIG=ha-app/config.yaml
if [[ -f "$HA_CONFIG" ]]; then
  HA_VERSION=$(grep -E '^version:' "$HA_CONFIG" | head -1 \
    | awk '{print $2}' | tr -d '"' | tr -d "'" || true)
  if [[ -z "$HA_VERSION" ]]; then
    echo "ERROR: ha-app/config.yaml has no parseable version: field."
    exit 1
  fi
  if [[ "$HA_VERSION" != "$VERSION" ]]; then
    echo "ERROR: version drift detected."
    echo "  package.json:           $VERSION"
    echo "  ha-app/config.yaml:     $HA_VERSION"
    echo ""
    echo "Run 'bash scripts/release.sh <new-version>' to bump all three in lockstep."
    exit 1
  fi
fi

echo "✓ package.json ($VERSION) matches CHANGELOG.md + ha-app/config.yaml"
