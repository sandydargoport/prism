#!/usr/bin/env bash
# Fails unless the version ha-app/config.yaml offers has a published image
# for every architecture the add-on lists.
#
# Home Assistant reads ha-app/config.yaml from master and pulls
# ghcr.io/sandydargoport/prism-ha-<arch>:<version>. A version on master with
# no image means every install and update fails with a 404 (#751). This
# runs in CI's required "Type-check & lint" job, so a release PR cannot
# merge until its tag has been pushed and the images are built (#757).
#
# Run manually:   bash scripts/check-ha-image.sh
# Needs network access to ghcr.io; reads anonymously, as HA does.

set -euo pipefail

cd "$(dirname "$0")/.."

CONFIG=ha-app/config.yaml
REGISTRY=${PRISM_HA_REGISTRY:-https://ghcr.io}
REPO_PREFIX=sandydargoport/prism-ha

VERSION=$(grep -E '^version:' "$CONFIG" | head -1 | awk '{print $2}' | tr -d '"' | tr -d "'")
if [[ -z "$VERSION" ]]; then
  echo "ERROR: $CONFIG has no parseable version: field."
  exit 1
fi

# The arch: list, one "  - name" line per architecture.
ARCHES=$(awk '/^arch:/{f=1;next} f&&/^[[:space:]]*-/{print $2;next} f{exit}' "$CONFIG")
if [[ -z "$ARCHES" ]]; then
  echo "ERROR: $CONFIG lists no arch: entries."
  exit 1
fi

ACCEPT='application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json'

missing=()
for arch in $ARCHES; do
  repo="$REPO_PREFIX-$arch"
  token=$(curl -fsS "$REGISTRY/token?scope=repository:$repo:pull" | sed -E 's/.*"token":"([^"]+)".*/\1/') || {
    echo "ERROR: could not reach $REGISTRY to check $repo:$VERSION."
    exit 2
  }
  status=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" -H "Accept: $ACCEPT" \
    "$REGISTRY/v2/$repo/manifests/$VERSION")
  case "$status" in
    200) ;;
    404) missing+=("$repo:$VERSION") ;;
    *) echo "ERROR: $REGISTRY answered $status for $repo:$VERSION."; exit 2 ;;
  esac
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: $CONFIG offers $VERSION, but these images are not published:"
  printf '  %s\n' "${missing[@]}"
  echo ""
  echo "Home Assistant would fail every install and update with a 404."
  echo "For a release PR: tag its head commit (git tag -a v$VERSION), push the tag,"
  echo "wait for the 'Release HA addon' workflow, then re-run this check."
  exit 1
fi

echo "✓ ha-app/config.yaml $VERSION is published for: $(echo $ARCHES | tr '\n' ' ')"
