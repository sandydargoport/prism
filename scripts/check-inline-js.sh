#!/usr/bin/env bash
# Extract every <script>…</script> body (excluding ones with a src= attr,
# which are external libraries) from the given HTML files and run
# `node --check` against each.
#
# Catches the class of bug PR #88 fixed: a duplicate `const` declaration
# in traffic/index.html that the browser refused to parse, breaking the
# whole page. The inline script doesn't go through the TS/Next.js
# pipeline so the existing CI doesn't see it.
#
# Usage:  bash scripts/check-inline-js.sh path/to/file.html [more.html …]
# Exits 0 on success, 1 if any block fails to parse.

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 file.html [more.html …]" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAIL=0

for html in "$@"; do
  if [ ! -f "$html" ]; then
    echo "WARN: $html not found, skipping" >&2
    continue
  fi

  # awk extracts each <script>…</script> body whose opening tag does NOT
  # carry src= (those are external libs, not our inline code). The src
  # check is INLINE in the open-tag rule so single-line external script
  # tags like `<script src="..."></script>` don't poison the skip state.
  awk '
    /<script[^>]*>/ {
      if ($0 ~ /<script[^>]*src=/) { next }    # external lib, ignore
      in_block = 1
      sub(/.*<script[^>]*>/, "")
      if ($0 != "") print
      if ($0 ~ /<\/script>/) {                  # entire script on one line
        sub(/<\/script>.*/, "")
        print "// ---END-BLOCK---"
        in_block = 0
      }
      next
    }
    /<\/script>/ {
      if (in_block) {
        sub(/<\/script>.*/, "")
        if ($0 != "") print
        print "// ---END-BLOCK---"
      }
      in_block = 0
      next
    }
    in_block { print }
  ' "$html" > "$TMP_DIR/raw.txt"

  # Split into one file per block.
  csplit -z -f "$TMP_DIR/block-" -b "%02d.mjs" "$TMP_DIR/raw.txt" '/^\/\/ ---END-BLOCK---$/' '{*}' > /dev/null 2>&1 || true

  for block in "$TMP_DIR"/block-*.mjs; do
    [ -f "$block" ] || continue
    # Strip the END-BLOCK sentinel line.
    sed -i '/^\/\/ ---END-BLOCK---$/d' "$block"
    # Skip empty files (artifact of csplit).
    if ! grep -q '[^[:space:]]' "$block"; then
      rm -f "$block"
      continue
    fi
    if ! node --check "$block" 2> "$TMP_DIR/err"; then
      echo "FAIL: $html — inline <script> failed to parse" >&2
      sed "s|$block|$html|g" "$TMP_DIR/err" >&2
      FAIL=1
    fi
    rm -f "$block"
  done
  rm -f "$TMP_DIR"/raw.txt
done

if [ "$FAIL" -ne 0 ]; then
  echo "scan-inline-js: one or more inline scripts failed to parse" >&2
  exit 1
fi

echo "scan-inline-js: clean (checked $# file(s))"
