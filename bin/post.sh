#!/usr/bin/env bash
set -euo pipefail

BASE="${LIFE_DASH_URL:-http://127.0.0.1:8000}"

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <project|task|goal|learning|journal|note> '<json>'"
  echo "       $0 task <project_id> '<json>'"
  echo "       $0 update <project|task|goal|learning|journal|note> <id> '<json>'"
  echo "       $0 list <project|task|goal|learning|journal|note> [filters]"
  echo "       $0 delete <project|task|goal|learning|journal|note> <id>"
  echo ""
  echo "Examples:"
  echo "  $0 note '{\"title\":\"My Note\",\"content\":\"details\",\"tags\":\"tag1\"}'"
  echo "  $0 learning '{\"title\":\"Learned X\",\"content\":\"...\",\"tags\":\"python\"}'"
  echo "  $0 project '{\"title\":\"Build site\",\"status\":\"backlog\",\"priority\":\"high\"}'"
  echo "  $0 task 1 '{\"title\":\"Wire up API\",\"status\":\"planned\",\"priority\":\"high\"}'"
  echo "  $0 update task 3 '{\"status\":\"in_progress\",\"priority\":\"high\"}'"
  echo "  $0 goal '{\"area\":\"health\",\"title\":\"Run 5km\",\"progress\":40}'"
  echo "  $0 journal '{\"type\":\"milestone\",\"content\":\"Shipped it\"}'"
  echo "  $0 list projects"
  echo "  $0 delete task 3"
  exit 1
fi

cmd="$1"
shift

case "$cmd" in
  task|tasks)
    if [ "$#" -lt 2 ]; then
      echo "Usage: $0 task <project_id> '<json>'" >&2
      exit 1
    fi
    PID="$1"
    shift
    curl -s -X POST "$BASE/api/projects/$PID/tasks" \
      -H "Content-Type: application/json" \
      -d "$1" | python3 -m json.tool
    exit 0
    ;;
  project|projects)
    ENDPOINT="projects" ;;
  goal|goals)
    ENDPOINT="goals" ;;
  learning|learnings)
    ENDPOINT="learnings" ;;
  journal|journals)
    ENDPOINT="journal" ;;
  note|notes)
    ENDPOINT="notes" ;;
  list)
    case "$1" in
      project|projects) ENDPOINT="projects" ;;
      task|tasks) ENDPOINT="tasks" ;;
      goal|goals) ENDPOINT="goals" ;;
      learning|learnings) ENDPOINT="learnings" ;;
      journal|journals) ENDPOINT="journal" ;;
      note|notes) ENDPOINT="notes" ;;
      *) echo "Unknown entity: $1" >&2; exit 1 ;;
    esac
    shift
    [ "$#" -ge 1 ] && QS="$*" || QS=""
    curl -s "$BASE/api/$ENDPOINT$QS" | python3 -m json.tool
    exit 0
    ;;
  update)
    [ "$#" -ge 3 ] || { echo "Usage: $0 update <entity> <id> '<json>'" >&2; exit 1; }
    case "$1" in
      project|projects) ENDPOINT="projects" ;;
      task|tasks) ENDPOINT="tasks" ;;
      goal|goals) ENDPOINT="goals" ;;
      learning|learnings) ENDPOINT="learnings" ;;
      journal|journals) ENDPOINT="journal" ;;
      note|notes) ENDPOINT="notes" ;;
      *) echo "Unknown entity: $1" >&2; exit 1 ;;
    esac
    ID="$2"
    shift 2
    curl -s -X PUT "$BASE/api/$ENDPOINT/$ID" \
      -H "Content-Type: application/json" \
      -d "$1" | python3 -m json.tool
    exit 0
    ;;
  delete)
    [ "$#" -ge 2 ] || { echo "Usage: $0 delete <entity> <id>" >&2; exit 1; }
    case "$1" in
      project|projects) ENDPOINT="projects" ;;
      task|tasks) ENDPOINT="tasks" ;;
      goal|goals) ENDPOINT="goals" ;;
      learning|learnings) ENDPOINT="learnings" ;;
      journal|journals) ENDPOINT="journal" ;;
      note|notes) ENDPOINT="notes" ;;
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
