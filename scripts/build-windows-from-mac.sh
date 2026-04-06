#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIN_TOOLS_DIR="$ROOT_DIR/scripts/win-tools"

export PATH="$WIN_TOOLS_DIR:/opt/homebrew/opt/llvm/bin:/opt/homebrew/opt/lld/bin:$PATH"

if ! command -v cargo-xwin >/dev/null 2>&1; then
  echo "cargo-xwin is required. Install with: cargo install cargo-xwin" >&2
  exit 1
fi

if ! command -v llvm-lib >/dev/null 2>&1; then
  echo "llvm-lib is required. Install with: brew install llvm" >&2
  exit 1
fi

if ! command -v lld-link >/dev/null 2>&1; then
  echo "lld-link is required. Install with: brew install lld" >&2
  exit 1
fi

npm run -s tauri:build -- --ci --target x86_64-pc-windows-msvc --runner cargo-xwin
