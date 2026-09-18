#!/usr/bin/env bash
# Install the source-controlled Jane-Desk skill directories for a supported agent.
set -euo pipefail

SKILLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-codex}"

install_codex() {
  local destination="${CODEX_HOME:-$HOME/.codex}/skills"
  mkdir -p "$destination"
  for source in "$SKILLS_DIR"/jane-desk-*/; do
    [ -f "${source}SKILL.md" ] || continue
    local name
    name="$(basename "$source")"
    rm -rf "$destination/$name"
    cp -R "$source" "$destination/$name"
  done
  printf 'Installed Jane-Desk skills in %s\n' "$destination"
}

install_hermes() {
  local home_dir="${HERMES_HOME:-$HOME/.hermes}"
  local destination="$home_dir/skills/jane-desk"
  mkdir -p "$destination"
  for source in "$SKILLS_DIR"/jane-desk-*/; do
    [ -f "${source}SKILL.md" ] || continue
    local name
    name="$(basename "$source")"
    rm -rf "$destination/$name"
    cp -R "$source" "$destination/$name"
  done
  mkdir -p "$home_dir/hooks"
  rm -rf "$home_dir/hooks/jane-desk-tool-loader"
  cp -R "$SKILLS_DIR/hermes/jane-desk-tool-loader" "$home_dir/hooks/jane-desk-tool-loader"
  printf 'Installed Jane-Desk skills and Hermes hook in %s\n' "$home_dir"
}

case "$TARGET" in
  codex) install_codex ;;
  hermes) install_hermes ;;
  all) install_codex; install_hermes ;;
  *) echo "Usage: $0 [codex|hermes|all]" >&2; exit 2 ;;
esac
