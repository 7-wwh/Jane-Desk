# Life-at-a-Glance — Agent Instructions

You are contributing to the user's personal life dashboard. Agents (opencode, codex,
claude, cline, etc.) keep this dashboard up to date by POSTing JSON to a local FastAPI
service. **Never edit `data/life.db` directly — always use the API.**

## Quick start

The server runs on this machine, reachable over Tailscale:

- Local: `http://127.0.0.1:8000`
- Tailscale: `http://100.74.182.63:8000`

Check it is up: `curl -s http://127.0.0.1:8000/api/health`

## How to write entries (agents)

Use `bin/post.sh` — one command per entry:

```bash
# Log a learning (daily knowledge)
bin/post.sh learning '{"title":"SQLAlchemy 2.0 uses Mapped[] syntax","content":"...","tags":"python,sqlalchemy","related_project":"life-at-a-glance"}'

# Add a project
bin/post.sh project '{"title":"Launch personal site","description":"...","status":"backlog","priority":"high","target_date":"2026-09-01","tags":"web"}'

# Add a goal
bin/post.sh goal '{"area":"health","title":"Run 5km","progress":40,"target_date":"2026-12-31"}'

# Add a journal entry
bin/post.sh journal '{"type":"milestone","content":"Finished first dashboard prototype","date":"2026-08-02"}'

# Add a task under a project (project_id from /api/projects)
bin/post.sh task 1 '{"title":"Wire up task API","status":"planned","priority":"high"}'
```

Or use curl directly (JSON body, `Content-Type: application/json`). See the API
reference below for all endpoints. **No auth is required.**

## When to write

- **Knowledge learned** while working: always log a `learning` (title + 1-3 line content + tags).
- **New/current/finished work**: add or update a `project`. Use `status`:
  `active` (currently working), `backlog` (planned/future), `done`, `paused`.
- **Long-term aspirations**: add to `goals` (area: career/health/family/learning/finance/other),
  set `progress` 0-100.
- **Concrete next steps**: add to `tasks` under a project. Use `status`:
  `wanted` (would like), `planned` (committed), `in_progress` (working now), `done` (finished).
- **Notable moments**: add a `journal` entry (`type`: milestone/note/reflection).

Keep entries short and factual. Tags are comma-separated (e.g. `python,fastapi,dashboard`).

## API reference

Base: `http://127.0.0.1:8000` — all routes under `/api`.

### Projects
- `GET    /api/projects?status=&q=` — list (filter by status or text query)
- `POST   /api/projects` — create
- `GET    /api/projects/{id}`
- `PUT    /api/projects/{id}` — update (partial; any subset of fields)
- `DELETE /api/projects/{id}`
- Fields: `title` (req), `description`, `status` (active/backlog/done/paused),
  `priority` (high/medium/low), `target_date` (YYYY-MM-DD or null),
  `begin_date` (YYYY-MM-DD or null), `duration` (float, hours),
  `branch_path` (root branch segment, e.g. `work`), `tags` (comma string)

### Goals
- `GET    /api/goals?area=&status=`
- `POST   /api/goals` / `GET|PUT|DELETE /api/goals/{id}`
- Fields: `area` (career/health/family/learning/finance/other), `title` (req),
  `description`, `progress` (0-100), `target_date`, `status` (active/completed/paused)

### Learnings
- `GET    /api/learnings?date=&tag=&q=`
- `POST   /api/learnings` / `GET|PUT|DELETE /api/learnings/{id}`
- Fields: `title` (req), `content`, `date` (YYYY-MM-DD, default today),
  `tags` (comma string), `related_project`

### Tasks
- `GET    /api/projects/{project_id}/tasks` — list tasks for a project
- `POST   /api/projects/{project_id}/tasks` — create task under project
- `GET|PUT|DELETE /api/tasks/{id}` — single task
- `PATCH  /api/tasks/{id}/status?status=` — advance status
  (`wanted`/`planned`/`in_progress`/`done`)
- Fields: `title` (req), `status`, `priority` (high/medium/low), `due_date`
  (YYYY-MM-DD or null), `begin_date` (YYYY-MM-DD or null), `duration` (float, hours),
  `branch_path` (full destination path, e.g. `work/2026/Q3 report`)

### Journal
- `GET    /api/journal?date=&type=`
- `POST   /api/journal` / `GET|PUT|DELETE /api/journal/{id}`
- Fields: `date`, `type` (milestone/note/reflection), `content` (req-ish), `related_entity`

### Aggregates
- `GET /api/dashboard` — everything the home screen needs in one call
- `GET /api/timeline?limit=` — merged chronological feed (learnings + projects + journal)

## Example curl

```bash
curl -s -X POST http://127.0.0.1:8000/api/learnings \
  -H "Content-Type: application/json" \
  -d '{"title":"Learned X","content":"details","tags":"python"}'
```

## Rules
- Do not edit SQLite file directly.
- Use `bin/post.sh` or the API only.
- Keep descriptions under ~200 characters.
- If an entry already exists, prefer updating it (PUT) over creating duplicates.
