#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
build_commit="${TEMPUS_BUILD_COMMIT:-}"
build_timestamp="${TEMPUS_BUILD_TIMESTAMP:-}"
target="${TEMPUS_VERSION_TARGET:-$repo_dir/backend/version.js}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --commit) build_commit="${2:?--commit requires a value}"; shift 2 ;;
    --timestamp) build_timestamp="${2:?--timestamp requires a value}"; shift 2 ;;
    --output) target="${2:?--output requires a value}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$build_commit" ]]; then
  build_commit="$(git -C "$repo_dir" rev-parse HEAD 2>/dev/null || true)"
fi
if [[ -z "$build_timestamp" ]]; then
  build_timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi
if [[ ! "$build_timestamp" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; then
  echo "Build timestamp must be UTC ISO-8601 (YYYY-MM-DDTHH:MM:SSZ)." >&2
  exit 2
fi
if [[ -n "$build_commit" && ! "$build_commit" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  echo "Build commit must be a 7-40 character hexadecimal SHA." >&2
  exit 2
fi
build_commit="${build_commit,,}"
build_date="${build_timestamp:0:10}"
temporary="$(mktemp "$repo_dir/backend/version.js.XXXXXX")"
trap 'rm -f "$temporary"' EXIT

{
  echo '// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.'
  echo '// Generated automatically by scripts/write-version.sh'
  echo 'var BUILD_META = {'
  printf "  buildDate: '%s',\n" "$build_date"
  printf "  buildTimestamp: '%s',\n" "$build_timestamp"
  printf "  buildCommit: '%s'\n" "$build_commit"
  echo '};'
  echo 'function api_getBuildMeta() {'
  echo '  return BUILD_META;'
  echo '}'
} > "$temporary"

mv "$temporary" "$target"
trap - EXIT
printf 'Updated %s (%s, %s)\n' "$target" "$build_timestamp" "$build_commit"
