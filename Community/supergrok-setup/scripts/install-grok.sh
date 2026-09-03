#!/usr/bin/env bash

set -euo pipefail

readonly OFFICIAL_INSTALLER_URL="https://x.ai/cli/install.sh"

find_grok() {
  local candidate
  local -a candidates=()

  if command -v grok >/dev/null 2>&1; then
    candidates+=("$(command -v grok)")
  fi
  if [[ -n "${GROK_BIN_DIR:-}" ]]; then
    candidates+=("$GROK_BIN_DIR/grok")
  fi
  if [[ -n "${GROK_HOME:-}" ]]; then
    candidates+=("$GROK_HOME/bin/grok")
  fi
  candidates+=("${HOME:?HOME must be set}/.grok/bin/grok")

  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]] && "$candidate" version >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

if grok_bin="$(find_grok)"; then
  printf 'Grok Build is already installed at %s.\n' "$grok_bin"
  "$grok_bin" version
  exit 0
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  printf 'This Zo setup wrapper supports Linux hosts only.\n' >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  printf 'curl is required to download the official xAI installer.\n' >&2
  exit 1
fi

installer_path="$(mktemp)"
cleanup() {
  rm -f "$installer_path"
}
trap cleanup EXIT HUP INT TERM

printf 'Downloading the official xAI installer from %s...\n' "$OFFICIAL_INSTALLER_URL"
curl --proto '=https' --tlsv1.2 -fsSL "$OFFICIAL_INSTALLER_URL" -o "$installer_path"
bash "$installer_path"

if ! grok_bin="$(find_grok)"; then
  printf 'The installer completed, but no Grok binary was found.\n' >&2
  exit 1
fi

printf 'Installed Grok Build at %s.\n' "$grok_bin"
"$grok_bin" version
