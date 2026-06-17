#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

npm ci
npm run build

TARBALL="$(npm pack --silent | tail -n 1)"
trap 'rm -f "$TARBALL"' EXIT

npm install -g "./${TARBALL}"

echo "Installed cxs from ${ROOT}/${TARBALL}"
echo "Verify with: command -v cxs && npm list -g --depth=0 codex-switcher"
