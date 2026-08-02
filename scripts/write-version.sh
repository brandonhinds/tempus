#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
build_date="$(date -u +%Y-%m-%d)"
build_commit="$(git -C "$repo_dir" rev-parse --short=12 HEAD 2>/dev/null || true)"
target="$repo_dir/backend/version.js"
temporary="$(mktemp "$repo_dir/backend/version.js.XXXXXX")"
trap 'rm -f "$temporary"' EXIT

{
  echo '// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.'
  echo '// Generated automatically by scripts/write-version.sh'
  echo 'var BUILD_META = {'
  printf "  buildDate: '%s',\n" "$build_date"
  printf "  buildCommit: '%s'\n" "$build_commit"
  echo '};'
  echo 'function api_getBuildMeta() {'
  echo '  return BUILD_META;'
  echo '}'
} > "$temporary"

mv "$temporary" "$target"
trap - EXIT
printf 'Updated %s (%s, %s)\n' "$target" "$build_date" "$build_commit"
