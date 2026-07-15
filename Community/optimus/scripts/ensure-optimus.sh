#!/usr/bin/env bash
# Ensures the `optimus` binary is on PATH. No-op if already installed.
# Tries, in order: cargo (crates.io), npm (@bitphill/optimus), pip
# (optimus-cli), then falls back to the universal source/binary installer
# from the GitHub release. Each step is best-effort; the next is only
# attempted if the previous one didn't produce a working binary.
set -euo pipefail

if command -v optimus >/dev/null 2>&1; then
  exit 0
fi

echo "optimus: not found on PATH, installing..." >&2

try_cargo() {
  command -v cargo >/dev/null 2>&1 || return 1
  cargo install optimus-cli --locked
}

try_npm() {
  command -v npm >/dev/null 2>&1 || return 1
  npm install -g @bitphill/optimus
}

try_pip() {
  (command -v pip3 >/dev/null 2>&1 && echo pip3) || \
  (command -v pip >/dev/null 2>&1 && echo pip) || return 1
}

try_universal_installer() {
  curl --proto '=https' --tlsv1.2 -sSf \
    https://raw.githubusercontent.com/bitphill/optimus/main/install.sh | bash
}

for method in cargo npm pip; do
  case "$method" in
    cargo) try_cargo && break ;;
    npm) try_npm && break ;;
    pip)
      pip_bin=$(try_pip) || continue
      "$pip_bin" install --user optimus-cli && break
      ;;
  esac
done

if ! command -v optimus >/dev/null 2>&1; then
  echo "optimus: no package manager install worked, running universal installer" >&2
  try_universal_installer
fi

if ! command -v optimus >/dev/null 2>&1; then
  echo "optimus: install failed. See https://github.com/bitphill/optimus#install" >&2
  exit 1
fi

echo "optimus: installed ($(optimus --version))" >&2
