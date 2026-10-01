#!/usr/bin/env bash
# Developer entry point for the Civil Engineering Platform.
# Usage: ./run.sh [dev|test|verify|build|start|db|db-down|help] [port]
set -euo pipefail

cd "$(dirname "$0")"

COMMAND="${1:-dev}"
PORT="${2:-3000}"
MIN_NODE_MAJOR=22

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js not found. Install: brew install node@24" >&2
    exit 1
  fi
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -lt "$MIN_NODE_MAJOR" ]; then
    echo "Node.js $(node -v) is too old; need >= 22.12. Install: brew install node@24" >&2
    exit 1
  fi
}

check_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm not found; enabling via corepack..."
    corepack enable
  fi
}

install_deps() {
  if [ ! -d node_modules ] || [ pnpm-lock.yaml -nt node_modules/.modules.yaml ]; then
    echo "Installing dependencies..."
    pnpm install
  fi
}

usage() {
  cat <<EOF
Usage: ./run.sh [command] [port]

Commands:
  dev       Start dev server (default) on http://localhost:\$PORT (default 3000)
  test      Run unit, integration and regression tests
  verify    Lint, typecheck, test and build (same as CI)
  build     Production build
  start     Production build, then serve on http://localhost:\$PORT
  db        Start PostgreSQL in Docker (creates .env from .env.example if missing)
  db-down   Stop PostgreSQL
  help      Show this message
EOF
}

case "$COMMAND" in
  help | -h | --help)
    usage
    exit 0
    ;;
esac

check_node
check_pnpm
install_deps

case "$COMMAND" in
  dev)
    echo "Starting dev server on http://localhost:$PORT"
    pnpm --filter @civil/web exec next dev -p "$PORT"
    ;;
  test)
    pnpm test
    ;;
  verify)
    pnpm verify
    ;;
  build)
    pnpm build
    ;;
  start)
    pnpm build
    echo "Serving production build on http://localhost:$PORT"
    pnpm --filter @civil/web exec next start -p "$PORT"
    ;;
  db)
    if ! command -v docker >/dev/null 2>&1; then
      echo "Docker not found. Install Docker Desktop: brew install --cask docker" >&2
      exit 1
    fi
    [ -f .env ] || cp .env.example .env
    pnpm db:up
    ;;
  db-down)
    pnpm db:down
    ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    usage
    exit 1
    ;;
esac
