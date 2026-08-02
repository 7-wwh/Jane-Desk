#!/usr/bin/env bash
set -euo pipefail

BASE="${LIFE_DASH_URL:-http://127.0.0.1:8000}"

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <project|goal|learning|journal> '<json>'"
  echo "       $0 list <project|goal|learning|journal> [filters]"
  echo "       $0 delete <project|goal|learning|journal> <id>"
  echo ""
  echo "Examples:"
  echo "  $0 learning '{\"title\":\"Learned X\",\"content\":\"...\",\"tags\":\"python\"}'"
  echo "  $0 project '{\"title\":\"Build site\",\"status\":\"backlog\",\"priority\":\"high\"}'"
  echo "  $0 goal '{\"area\":\"health\",\"title\":\"Run 5km\",\"progress\":40}'"
  echo "  $0 journal '{\"type\":\"milestone\",\"content\":\"Shipped it\"}'"
  echo "  $0 list projects"
  echo "  $0 delete learning 3"
  exit 1
fi

cmd="$1"
shift

case "$cmd" in
  project|projects)
    ENDPOINT="projects" ;;
  goal|goals)
    ENDPOINT="goals" ;;
  learning|learnings)
    ENDPOINT="learnings" ;;
  journal|journals)
    ENDPOINT="journal" ;;
  list)
    case "$1" in
      project|projects) ENDPOINT="projects" ;;
      goal|goals) ENDPOINT="goals" ;;
      learning|learnings) ENDPOINT="learnings" ;;
      journal|journals) ENDPOINT="journal" ;;
      *) echo "Unknown entity: $1" >&2; exit 1 ;;
    esac
    curl -s "$BASE/api/$ENDPOINT" | python3 -m json.tool
    exit 0
    ;;
  delete)
    [ "$#" -ge 2 ] || { echo "Usage: $0 delete <entity> <id>" >&2; exit 1; }
    case "$1" in
      project|projects) ENDPOINT="projects" ;;
      goal|goals) ENDPOINT="goals" ;;
      learning|learnings) ENDPOINT="learnings" ;;
      journal|journals) ENDPOINT="journal" ;;
      *) echo "Unknown entity: $1" >&2; exit 1 ;;
    esac
    curl -s -X DELETE "$BASE/api/$ENDPOINT/$2"
    echo
    exit 0
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    exit 1
    ;;
esac

curl -s -X POST "$BASE/api/$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$1" | python3 -m json.tool
