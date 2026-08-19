#!/usr/bin/env python3
"""Deterministic schema guard for task/project/goal payloads the task-master skill
would send to the Life-at-a-Glance API. Mirrors the whitelists in app/schemas.py so
extraction bugs and format drift are caught BEFORE the API round-trip.

Usage:
    echo '{"title":"Q3 Report","status":"planned","priority":"high"}' | python3 bin/check_payloads.py --entity task
    python3 bin/check_payloads.py --entity project payload.json
    python3 bin/check_payloads.py --auto payload.json      # infer entity from keys

Exit 0 if the payload conforms; exit 1 and print every problem otherwise.
"""

import json
import re
import sys
from calendar import monthrange

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

PROJECT_STATUSES = {"active", "backlog", "done", "paused"}
PRIORITIES = {"high", "medium", "low"}
GOAL_AREAS = {"career", "health", "family", "learning", "finance", "other"}
GOAL_STATUSES = {"active", "completed", "paused"}
TASK_STATUSES = {"wanted", "planned", "in_progress", "done"}

DURATION_MAX_HOURS = 8760.0

KEYS = {
    "task": {"title", "status", "priority", "due_date", "begin_date", "duration",
             "branch_path", "project_id"},
    "project": {"title", "description", "status", "priority", "target_date",
                "begin_date", "duration", "branch_path", "tags"},
    "goal": {"area", "title", "description", "progress", "target_date", "status"},
}

# Fields whose value is a YYYY-MM-DD date (present, non-null).
DATE_FIELDS = {
    "task": {"due_date", "begin_date"},
    "project": {"target_date", "begin_date"},
    "goal": {"target_date"},
}


def _entity_from_keys(payload):
    keys = set(payload)
    for name, allowed in KEYS.items():
        # Exact fit: no keys from outside this entity's set.
        if keys and keys <= allowed:
            return name
    return None


def valid_date(v):
    if not isinstance(v, str) or not DATE_RE.match(v):
        return False
    year, month, day = (int(x) for x in v.split("-"))
    if not (1 <= month <= 12):
        return False
    return 1 <= day <= monthrange(year, month)[1]


def check_entity(payload, entity):
    errors = []
    keys = set(payload)
    allowed = KEYS[entity]

    unknown = keys - allowed
    if unknown:
        errors.append(f"unknown keys for {entity}: {sorted(unknown)}")

    missing = {"title"} - keys
    if missing:
        errors.append(f"missing required key(s): {sorted(missing)}")

    if "title" in payload:
        title = payload["title"]
        if not isinstance(title, str) or not title.strip():
            errors.append("title must be a non-empty string")
        elif title.strip() != title:
            errors.append("title must not have leading/trailing whitespace")

    if entity == "task":
        if "status" in payload and payload["status"] not in TASK_STATUSES:
            errors.append(f"status must be one of {sorted(TASK_STATUSES)}")
        for field in ("project_id",):
            if field in payload and not isinstance(payload[field], int):
                errors.append(f"{field} must be an integer")

    elif entity == "project":
        if "status" in payload and payload["status"] not in PROJECT_STATUSES:
            errors.append(f"status must be one of {sorted(PROJECT_STATUSES)}")

    elif entity == "goal":
        if "area" in payload and payload["area"] not in GOAL_AREAS:
            errors.append(f"area must be one of {sorted(GOAL_AREAS)}")
        if "status" in payload and payload["status"] not in GOAL_STATUSES:
            errors.append(f"status must be one of {sorted(GOAL_STATUSES)}")
        if "progress" in payload:
            p = payload["progress"]
            if not isinstance(p, (int, float)) or isinstance(p, bool) or not (0 <= p <= 100):
                errors.append("progress must be a number between 0 and 100")

    if "priority" in payload and payload["priority"] not in PRIORITIES:
        errors.append(f"priority must be one of {sorted(PRIORITIES)}")

    for field in DATE_FIELDS[entity]:
        if field in payload and payload[field] is not None and not valid_date(payload[field]):
            errors.append(f"{field} must be a valid YYYY-MM-DD date")

    if "duration" in payload:
        d = payload["duration"]
        if d is not None:
            if not isinstance(d, (int, float)) or isinstance(d, bool):
                errors.append("duration must be a float number of hours")
            elif not (0 <= d <= DURATION_MAX_HOURS):
                errors.append(f"duration must be between 0 and {DURATION_MAX_HOURS} hours")

    # Format-contract guard: extraction artifacts must never leak.
    banned = ["taskName", "taskDescription", "importance", "branch", "deadline", "beginDate",
              "confidence", "flags", "N/A"]
    for key in banned:
        if key in payload:
            errors.append(f"forbidden extraction artifact leaked: {key!r}")
    for key, value in payload.items():
        if value == "N/A":
            errors.append(f"key {key!r} has the forbidden literal value 'N/A' (omit the key instead)")

    return errors


def main():
    args = [a for a in sys.argv[1:]]
    entity = None
    path = None
    if "--entity" in args:
        i = args.index("--entity")
        entity = args[i + 1]
        del args[i:i + 2]
    if "--auto" in args:
        args.remove("--auto")
        entity = None
    if args:
        path = args[0]

    text = open(path).read() if path else sys.stdin.read()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as e:
        print(f"FAIL  invalid JSON: {e}")
        return 1

    if not isinstance(payload, dict):
        print("FAIL  payload must be a single JSON object (one entity per call)")
        return 1

    if entity is None:
        entity = _entity_from_keys(payload)
        if entity is None:
            print("FAIL  could not infer entity from keys; pass --entity task|project|goal")
            return 1

    if entity not in KEYS:
        print(f"FAIL  unknown entity {entity!r}; expected task|project|goal")
        return 1

    errors = check_entity(payload, entity)
    if errors:
        print(f"FAIL  {entity} payload:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"OK    {entity} payload conforms to the API schema")
    return 0


if __name__ == "__main__":
    sys.exit(main())