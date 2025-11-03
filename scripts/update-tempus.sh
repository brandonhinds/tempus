#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: update-tempus.sh [options]

Clones the configured Google Apps Script project, replaces its contents with the
current repository, and runs `clasp push`.

Options:
  -s, --script-id <id>   Override the Apps Script project ID
  -c, --clone-dir <path> Use a specific working directory (must be empty)
                         (defaults to a temp directory created beside where this script is run)
  -k, --keep             Do not delete the working directory when finished
  -h, --help             Show this message and exit
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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

if ! command -v clasp >/dev/null 2>&1; then
  echo "Error: clasp is not installed or not on PATH." >&2
  exit 1
fi

if [[ -z "$SCRIPT_ID" && -f "$REPO_ROOT/.clasp.json" ]]; then
  SCRIPT_ID="$(grep -m1 '"scriptId"' "$REPO_ROOT/.clasp.json" | sed 's/.*"scriptId": *"//; s/".*//')"
fi

if [[ -z "$SCRIPT_ID" ]]; then
  echo "Error: Unable to determine Apps Script project ID. Provide one with --script-id." >&2
  exit 1
fi

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

CLEANUP=0
if [[ $AUTO_CLONE_DIR -eq 1 && $KEEP_CLONE -eq 0 ]]; then
  CLEANUP=1
fi

cleanup() {
  if [[ ${CLEANUP:-0} -eq 1 && -n "${CLONE_DIR:-}" ]]; then
    rm -rf "$CLONE_DIR"
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

echo "Copying repository sources..."
cp -R "$REPO_ROOT"/* "$CLONE_DIR"/
if [[ -f "$REPO_ROOT/.claspignore" ]]; then
  cp "$REPO_ROOT/.claspignore" "$CLONE_DIR"/
fi

echo "Pushing updated files with clasp..."
pushd "$CLONE_DIR" >/dev/null
clasp push
popd >/dev/null

if [[ $CLEANUP -eq 1 ]]; then
  echo "Update complete. Cleaned up temporary directory."
else
  echo "Update complete. Working directory kept at: $CLONE_DIR"
fi
