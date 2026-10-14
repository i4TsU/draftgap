#!/usr/bin/env bash
# Bootstrap the selected repository revisions; never fetch or switch branches.
set -euo pipefail
cloud_draftgap=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cloud_workspace=$(dirname -- "$cloud_draftgap")
export LOLMIX_REPO="${LOLMIX_REPO:-$cloud_workspace/lolmix}"
cloud_state="$cloud_workspace/.cloud-setup"
cloud_tools="$cloud_workspace/.cloud-tools"

for cloud_repo in "$cloud_draftgap" "$LOLMIX_REPO"; do
  git -C "$cloud_repo" rev-parse --is-inside-work-tree
  git -C "$cloud_repo" rev-parse HEAD
  git -C "$cloud_repo" status --short --branch
done
if [ ! -f "$LOLMIX_REPO/uv.lock" ] || [ ! -f "$LOLMIX_REPO/.python-version" ]; then
  echo 'Selected LoLMix revision lacks locked setup. Select its reviewed setup branch.' >&2
  exit 1
fi
command -v uv >/dev/null
mkdir -p "$cloud_state" "$cloud_tools"
export UV_CACHE_DIR="$cloud_state/uv-cache"
export npm_config_cache="$cloud_state/npm-cache"
export XDG_CACHE_HOME="$cloud_state/cache"
export MPLCONFIGDIR="$cloud_state/matplotlib"
export BUN_INSTALL_CACHE_DIR="$cloud_state/bun-cache"
cloud_bun="$cloud_tools/node_modules/.bin/bun"
if [ ! -x "$cloud_bun" ] || [ "$("$cloud_bun" --version)" != '1.3.6' ]; then
  npm install --prefix "$cloud_tools" --no-audit --no-fund --save-exact bun@1.3.6
fi
# Persist only non-secret paths. Source this file in subsequent Bash shells.
{
  printf 'export PATH=%q:"$PATH"\n' "$cloud_tools/node_modules/.bin"
  for cloud_key in LOLMIX_REPO UV_CACHE_DIR npm_config_cache XDG_CACHE_HOME MPLCONFIGDIR BUN_INSTALL_CACHE_DIR; do
    printf 'export %s=%q\n' "$cloud_key" "${!cloud_key}"
  done
} > "$cloud_state/env.sh"
source "$cloud_state/env.sh"
cd "$cloud_draftgap"
"$cloud_bun" run --bun setup:all
uv run --project "$LOLMIX_REPO" --locked --no-sync python \
  "$cloud_draftgap/scripts/lib/run-reaped.py" "$cloud_bun" run --bun check:all
