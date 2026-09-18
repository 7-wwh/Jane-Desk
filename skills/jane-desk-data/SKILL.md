---
name: jane-desk-data
description: Create or update Jane-Desk dashboard records through its local API when the user explicitly asks to save, log, add, change, or complete a task, project, goal, learning, journal entry, or note. Do not use for dashboard code changes or direct SQLite access.
---

# Jane-Desk data writer

Persist dashboard data only through the Life-at-a-Glance API. The SQLite database is an implementation detail: never open, edit, or replace `data/life.db` directly.

## Before a write

1. Treat a clear instruction such as “add”, “log”, “save”, “mark done”, or “update” as authorization for that specific record. For an inferred task, ambiguous match, or consequential change that was not expressly requested, present a concise preview and obtain explicit approval.
2. Check `GET ${LIFE_DASH_URL:-http://127.0.0.1:8000}/api/health`. If it is unavailable, stop and report the connection failure; do not write to the database file as a fallback.
3. Search before creating to avoid duplicates:
   - tasks: `GET /api/tasks?q=<title>`
   - projects: `GET /api/projects?q=<title>`
   - goals: `GET /api/goals`, then match titles locally
   - learnings and notes: use their `q` parameter; journal entries require a date/type/content comparison.
   If more than one credible update target exists, ask the user to choose; never select one by guesswork.
4. For task creation, resolve a real parent project ID first. A task belongs at `POST /api/projects/{project_id}/tasks`; `project_id` is not part of its POST JSON body.

## Write and verify

Use `bin/agent_write.py` from the repository root. It validates task, project, and goal payloads, calls the API, rejects non-2xx responses, and fetches the saved record to verify supplied fields.

```bash
# Creates
bin/agent_write.py project '{"title":"Launch personal site","status":"backlog","priority":"high"}'
bin/agent_write.py task 12 '{"title":"Draft homepage copy","status":"planned"}'
bin/agent_write.py goal '{"area":"career","title":"Publish a portfolio","progress":0}'
bin/agent_write.py learning '{"title":"FastAPI dependency injection","content":"Use Depends for request-scoped resources.","tags":"python,fastapi"}'

# Partial updates. Keep title in task/project/goal payloads when known so the schema guard can detect accidental target mistakes.
bin/agent_write.py update task 34 '{"title":"Draft homepage copy","status":"done"}'
bin/agent_write.py update goal 7 '{"title":"Publish a portfolio","progress":25}'
```

Use the canonical entity names: `project`, `task`, `goal`, `learning`, `journal`, and `note`. For a task status-only completion, `PATCH /api/tasks/{id}/status?status=done` is also valid, but still verify the response. Starting a task uses `POST /api/tasks/{id}/start`; starting a timer uses `POST /api/tasks/{id}/sessions/start`.

After a successful write, report the entity type, ID, and changed fields. If verification fails, report the API response and stop; do not retry a create, because retrying could make a duplicate.

Read [the API contract](references/api-contract.md) only when selecting an endpoint, resolving parent records, or diagnosing a rejected payload.
