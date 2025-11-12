#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: update-tempus.sh [options]

Clones the configured Google Apps Script project, downloads the latest Tempus
sources from GitHub, and runs `clasp push`.

Options:
  -s, --script-id <id>   Apps Script project ID to update (required)
  -c, --clone-dir <path> Use a specific working directory (must be empty)
                         (defaults to a temp directory created beside where this script is run)
  -k, --keep             Do not delete the working directory when finished
  -h, --help             Show this message and exit
EOF
}

CALL_DIR="$(pwd)"

SCRIPT_ID=""
CLONE_DIR=""
KEEP_CLONE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--script-id)
      [[ $# -ge 2 ]] || { echo "Error: --script-id requires a value." >&2; usage; exit 1; }
      SCRIPT_ID="$2"
      shift 2
      ;;
    -c|--clone-dir)
      [[ $# -ge 2 ]] || { echo "Error: --clone-dir requires a path." >&2; usage; exit 1; }
      CLONE_DIR="$2"
      shift 2
      ;;
    -k|--keep)
      KEEP_CLONE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: Unknown option '$1'." >&2
      usage
      exit 1
      ;;
  esac
done

AUTO_CLONE_DIR=0
if [[ -z "$CLONE_DIR" ]]; then
  AUTO_CLONE_DIR=1
  base="${CALL_DIR%/}"
  timestamp="$(date +%Y%m%d-%H%M%S)"
  candidate="$base/tempus-clone-$timestamp"
  counter=0
  while [[ -e "$candidate" ]]; do
    counter=$((counter + 1))
    candidate="$base/tempus-clone-$timestamp-$counter"
  done
  CLONE_DIR="$candidate"
fi

mkdir -p "$CLONE_DIR"

CLONE_DIR="$(cd "$CLONE_DIR" && pwd)"

if find "$CLONE_DIR" -mindepth 1 -print -quit | grep -q .; then
  echo "Error: Clone directory '$CLONE_DIR' must be empty." >&2
  exit 1
fi

if ! command -v clasp >/dev/null 2>&1; then
  echo "Error: clasp is not installed or not on PATH." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required to download the Tempus sources." >&2
  exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
  echo "Error: tar is required to extract the Tempus sources." >&2
  exit 1
fi

if [[ -z "$SCRIPT_ID" ]]; then
  echo "Error: Provide the Apps Script project ID with --script-id." >&2
  exit 1
fi

DOWNLOAD_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t tempus-src)"

CLEANUP=0
if [[ $AUTO_CLONE_DIR -eq 1 && $KEEP_CLONE -eq 0 ]]; then
  CLEANUP=1
fi

cleanup() {
  if [[ ${CLEANUP:-0} -eq 1 && -n "${CLONE_DIR:-}" ]]; then
    rm -rf "$CLONE_DIR"
  fi
  if [[ -n "${DOWNLOAD_DIR:-}" && -d "${DOWNLOAD_DIR:-}" ]]; then
    rm -rf "$DOWNLOAD_DIR"
  fi
}
trap cleanup EXIT

echo "Cloning Apps Script project (ID: $SCRIPT_ID)..."
echo "Working directory: $CLONE_DIR"
pushd "$CLONE_DIR" >/dev/null
clasp clone "$SCRIPT_ID"
popd >/dev/null

echo "Preparing workspace..."
(
  shopt -s dotglob nullglob
  for entry in "$CLONE_DIR"/* "$CLONE_DIR"/.*; do
    name="$(basename "$entry")"
    if [[ "$name" == "." || "$name" == ".." || "$name" == ".clasp.json" ]]; then
      continue
    fi
    rm -rf "$entry"
  done
)

echo "Downloading latest Tempus sources from GitHub..."
curl -fsSL "https://codeload.github.com/brandonhinds/tempus/tar.gz/refs/heads/main" | tar -xz -C "$DOWNLOAD_DIR" --strip-components=1

echo "Copying repository sources..."
cp -R "$DOWNLOAD_DIR"/. "$CLONE_DIR"/

echo "Pushing updated files with clasp..."
pushd "$CLONE_DIR" >/dev/null
clasp push -f
popd >/dev/null

if [[ $CLEANUP -eq 1 ]]; then
  echo "Update complete. Cleaned up temporary directory."
else
  echo "Update complete. Working directory kept at: $CLONE_DIR"
fi
