#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf '%s\n' \
    'Usage: update-tempus.sh --script-id ID [options]' \
    '' \
    'Downloads the CI-built stable release, preserves .clasp.json, and runs clasp push.' \
    '' \
    'Options:' \
    '  -s, --script-id ID       Apps Script project ID (required for a new target)' \
    '  -c, --clone-dir PATH     Existing or empty target directory' \
    '  -k, --keep               Keep an automatically-created target directory' \
    '      --archive-file PATH  Use a local release .tar.gz or .zip (testing/offline)' \
    '      --dry-run            Prepare and validate files without clasp push' \
    '  -h, --help               Show this help'
}

script_id=''
target_dir=''
archive_file=''
keep_target=0
dry_run=0
auto_target=0
release_url="${TEMPUS_RELEASE_URL:-https://codeload.github.com/brandonhinds/tempus/tar.gz/refs/heads/release}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--script-id) script_id="${2:?--script-id requires a value}"; shift 2 ;;
    -c|--clone-dir) target_dir="${2:?--clone-dir requires a path}"; shift 2 ;;
    -k|--keep) keep_target=1; shift ;;
    --archive-file) archive_file="${2:?--archive-file requires a path}"; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "$target_dir" ]]; then
  target_dir="$(mktemp -d "${TMPDIR:-/tmp}/tempus-update.XXXXXX")"
  auto_target=1
else
  mkdir -p "$target_dir"
  target_dir="$(cd "$target_dir" && pwd)"
fi
[[ "$target_dir" != '/' ]] || { echo 'Refusing to use / as the target.' >&2; exit 2; }

download_dir="$(mktemp -d "${TMPDIR:-/tmp}/tempus-release.XXXXXX")"
cleanup() {
  rm -rf "$download_dir"
  if [[ $auto_target -eq 1 && $keep_target -eq 0 ]]; then rm -rf "$target_dir"; fi
}
trap cleanup EXIT

if [[ ! -f "$target_dir/.clasp.json" ]]; then
  [[ -n "$script_id" ]] || { echo 'Provide --script-id when the target has no .clasp.json.' >&2; exit 2; }
  if [[ $dry_run -eq 1 ]]; then
    printf '{"scriptId":"%s"}\n' "$script_id" > "$target_dir/.clasp.json"
  else
    command -v clasp >/dev/null 2>&1 || { echo 'clasp is not installed.' >&2; exit 1; }
    [[ -z "$(find "$target_dir" -mindepth 1 -print -quit)" ]] || { echo 'A target without .clasp.json must be empty.' >&2; exit 2; }
    (cd "$target_dir" && clasp clone "$script_id")
  fi
fi

clasp_backup="$download_dir/.clasp.json"
cp "$target_dir/.clasp.json" "$clasp_backup"
find "$target_dir" -mindepth 1 -maxdepth 1 ! -name '.clasp.json' -exec rm -rf -- {} +

if [[ -n "$archive_file" ]]; then
  [[ -f "$archive_file" ]] || { echo "Archive not found: $archive_file" >&2; exit 2; }
  case "$archive_file" in
    *.zip) command -v unzip >/dev/null 2>&1 || { echo 'unzip is required.' >&2; exit 1; }; unzip -q "$archive_file" -d "$download_dir/archive" ;;
    *) mkdir -p "$download_dir/archive"; tar -xzf "$archive_file" -C "$download_dir/archive" ;;
  esac
else
  command -v curl >/dev/null 2>&1 || { echo 'curl is required.' >&2; exit 1; }
  mkdir -p "$download_dir/archive"
  curl -fsSL "$release_url" | tar -xzf - -C "$download_dir/archive"
fi

release_root="$(find "$download_dir/archive" -mindepth 1 -maxdepth 1 -type d -print -quit)"
[[ -n "$release_root" && -f "$release_root/release-manifest.json" ]] || { echo 'Archive is not a built Tempus release (manifest missing).' >&2; exit 1; }
cp -R "$release_root"/. "$target_dir"/
cp "$clasp_backup" "$target_dir/.clasp.json"

if [[ $dry_run -eq 1 ]]; then
  echo "Dry run complete. Stable release prepared at: $target_dir"
  exit 0
fi

command -v clasp >/dev/null 2>&1 || { echo 'clasp is not installed.' >&2; exit 1; }
(cd "$target_dir" && clasp push -f)
echo 'Tempus stable release pushed successfully.'
