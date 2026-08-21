#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
commit_sha="${TEMPUS_BUILD_COMMIT:-}"
published_at="${TEMPUS_BUILD_TIMESTAMP:-}"
output="${TEMPUS_MANIFEST_TARGET:-$repo_root/release-manifest.json}"
archive_url="${TEMPUS_RELEASE_ARCHIVE_URL:-https://github.com/brandonhinds/tempus/archive/refs/heads/release.zip}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --commit) commit_sha="${2:?--commit requires a value}"; shift 2 ;;
    --timestamp) published_at="${2:?--timestamp requires a value}"; shift 2 ;;
    --output) output="${2:?--output requires a value}"; shift 2 ;;
    --archive-url) archive_url="${2:?--archive-url requires a value}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

[[ "$commit_sha" =~ ^[0-9a-fA-F]{40}$ ]] || { echo 'Manifest commit must be a full 40-character SHA.' >&2; exit 2; }
[[ "$published_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || { echo 'Manifest timestamp must be UTC ISO-8601.' >&2; exit 2; }
commit_sha="${commit_sha,,}"
display_version="${published_at:0:10}+${commit_sha:0:12}"
temporary="$(mktemp "${output}.XXXXXX")"
trap 'rm -f "$temporary"' EXIT

printf '{\n  "schema_version": 1,\n  "channel": "stable",\n  "commit_sha": "%s",\n  "published_at": "%s",\n  "display_version": "%s",\n  "archive_url": "%s"\n}\n' \
  "$commit_sha" "$published_at" "$display_version" "$archive_url" > "$temporary"
mv "$temporary" "$output"
trap - EXIT
printf 'Wrote %s\n' "$output"
