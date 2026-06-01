#!/usr/bin/env bash
# One-command release helper. Bumps package.json and migrates the current
# "## Unreleased" CHANGELOG content under a new versioned section, then
# runs the sync check so we never ship a half-released state.
#
# Usage:  bash scripts/release.sh <new-version>
# e.g.   bash scripts/release.sh 1.8.3
#
# What this DOES:
#   - Edits package.json's "version" field
#   - Inserts a new "## [X.Y.Z] – YYYY-MM-DD" heading directly below
#     "## Unreleased" in docs/CHANGELOG.md and moves the Unreleased
#     entries underneath it (Unreleased itself becomes empty)
#   - Runs scripts/check-version-sync.sh to confirm both files now agree
#
# What this DOES NOT:
#   - Doesn't commit, branch, push, tag, or publish — those remain manual
#     so the human (or AI) can review the diff first. The script prints
#     the suggested next-step commands at the end.

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <new-version>"
  exit 1
fi

NEW_VERSION="$1"
if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: version must be N.N.N (got: $NEW_VERSION)"
  exit 1
fi

TODAY=$(date +%Y-%m-%d)

# --- Pre-flight: validate Unreleased has content + version isn't taken
# Both checks run BEFORE any file is mutated, so a failed pre-flight leaves
# the working tree untouched.
node - "$NEW_VERSION" <<'NODE'
const fs = require('fs');
const [version] = process.argv.slice(2);

const p = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
if (p.version === version) {
  console.error(`ERROR: package.json is already at ${version} — nothing to bump.`);
  process.exit(1);
}

const lines = fs.readFileSync('docs/CHANGELOG.md', 'utf8').split('\n');
const u = lines.findIndex(l => l.trim() === '## Unreleased');
if (u < 0) {
  console.error('ERROR: docs/CHANGELOG.md has no "## Unreleased" heading.');
  process.exit(1);
}
const n = lines.findIndex((l, i) => i > u && /^## \[[0-9]/.test(l));
if (n < 0) {
  console.error('ERROR: docs/CHANGELOG.md has no existing versioned section to anchor against.');
  process.exit(1);
}
const between = lines.slice(u + 1, n).filter(l => l.trim() !== '');
if (between.length === 0) {
  console.error('ERROR: "## Unreleased" section is empty — nothing to release.');
  console.error('       Add release notes there before running this script.');
  process.exit(1);
}
console.log(`✓ pre-flight: Unreleased has ${between.length} non-blank line(s), version ${version} is new`);
NODE

# --- Bump package.json ------------------------------------------------
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const previous = p.version;
p.version = '$NEW_VERSION';
fs.writeFileSync('./package.json', JSON.stringify(p, null, 2) + '\n');
console.log('✓ package.json: ' + previous + ' → $NEW_VERSION');
"

# --- Bump ha-app/config.yaml version field ---------------------------
# Single source of truth is package.json — this just keeps the HA addon
# manifest in lockstep so the release pipeline pushes images to the
# right tag.
if [[ -f ha-app/config.yaml ]]; then
  node -e "
const fs = require('fs');
const path = 'ha-app/config.yaml';
const text = fs.readFileSync(path, 'utf8');
const match = text.match(/^version:\\s*(.*)\$/m);
if (!match) {
  console.error('ERROR: ha-app/config.yaml has no version: field.');
  process.exit(1);
}
const previous = match[1].trim().replace(/^[\"']|[\"']\$/g, '');
const next = text.replace(/^version:.*\$/m, 'version: \"$NEW_VERSION\"');
fs.writeFileSync(path, next);
console.log('✓ ha-app/config.yaml: ' + previous + ' → $NEW_VERSION');
"
fi

# --- Migrate CHANGELOG Unreleased -> [NEW_VERSION] --------------------
node - "$NEW_VERSION" "$TODAY" <<'NODE'
const fs = require('fs');
const [version, today] = process.argv.slice(2);

const text = fs.readFileSync('docs/CHANGELOG.md', 'utf8');
const lines = text.split('\n');

const unreleasedIdx = lines.findIndex(l => l.trim() === '## Unreleased');
if (unreleasedIdx < 0) {
  console.error('ERROR: docs/CHANGELOG.md has no "## Unreleased" heading.');
  process.exit(1);
}

const nextVersionIdx = lines.findIndex((l, i) =>
  i > unreleasedIdx && /^## \[[0-9]/.test(l));
if (nextVersionIdx < 0) {
  console.error('ERROR: docs/CHANGELOG.md has no existing versioned section to anchor against.');
  process.exit(1);
}

// Extract everything between "## Unreleased" and the next "## [", trimmed.
const between = lines.slice(unreleasedIdx + 1, nextVersionIdx);
let start = 0;
while (start < between.length && between[start].trim() === '') start++;
let end = between.length;
while (end > start && between[end - 1].trim() === '') end--;
const moved = between.slice(start, end);

if (moved.length === 0) {
  console.error('ERROR: "## Unreleased" section is empty — nothing to release.');
  console.error('       Add release notes there before running this script.');
  process.exit(1);
}

const newLines = [
  ...lines.slice(0, unreleasedIdx + 1),
  '',
  `## [${version}] – ${today}`,
  '',
  ...moved,
  '',
  ...lines.slice(nextVersionIdx),
];

fs.writeFileSync('docs/CHANGELOG.md', newLines.join('\n'));
console.log(`✓ CHANGELOG.md: moved ${moved.length} lines from Unreleased to [${version}] – ${today}`);
NODE

# --- Verify everything agrees ----------------------------------------
bash scripts/check-version-sync.sh

cat <<MSG

Release prep complete. Suggested next steps:

  git checkout -b chore/release-$NEW_VERSION
  git add package.json docs/CHANGELOG.md
  git commit -m "chore(release): $NEW_VERSION"
  git push -u origin chore/release-$NEW_VERSION
  gh pr create --base master --head chore/release-$NEW_VERSION \\
       --title "chore(release): $NEW_VERSION"

After the PR merges to master:

  git checkout master && git pull
  git tag -a v$NEW_VERSION -m "Release $NEW_VERSION"
  git push origin v$NEW_VERSION
  gh release create v$NEW_VERSION --title "$NEW_VERSION" \\
       --notes-file <(awk '/^## \\[$NEW_VERSION\\]/{f=1;next} f&&/^## \\[/{exit} f' docs/CHANGELOG.md)

The tag push fires .github/workflows/release.yml, which builds the HA
addon for amd64 + aarch64 and publishes to ghcr.io. amd64 is fast
(~5 min), aarch64 runs via QEMU and takes 30-60 min. Both must complete
before HA users can pull the published image; until then HA Supervisor
falls back to building locally from the in-addon Dockerfile.

MSG
