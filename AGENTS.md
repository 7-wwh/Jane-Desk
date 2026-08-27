# Jane-Desk — Agent Instructions

You are contributing to the user's personal life dashboard. Agents (opencode, codex,
claude, cline, etc.) keep this dashboard up to date by POSTing JSON to a local FastAPI
service. **Never edit `data/life.db` directly — always use the API.**

## Quick start

The server runs on this machine, reachable over Tailscale:

- Local: `http://127.0.0.1:8000`
- Tailscale: `http://100.74.182.63:8000`

Check it is up: `curl -s http://127.0.0.1:8000/api/health`

Both `bin/post.sh` and `bin/run_api_evals.py` honor `LIFE_DASH_URL` to point at a
different server (e.g. the Tailscale address).

## Development workflow

Stack: FastAPI + SQLAlchemy + SQLite backend (`app/`), plain HTML/CSS/JS frontend
(`static/`, no build step, no npm). All API routes live in `app/main.py`.

```bash
bin/run.sh                                      # dev server: uvicorn app.main:app on 0.0.0.0:8000
python3 -m app.seed                             # seed sample data (skips if DB non-empty)
bin/seed_dummy.py                               # idempotent dummy projects/tasks/sessions for UI dev
find static -name '*.js' -exec node --check {} \;  # JS syntax check (dashboard + widgets)
bin/run_api_evals.py                            # backend guard evals — requires server up; exits non-zero on failure
echo '{"title":"X","status":"planned"}' | python3 bin/check_payloads.py --entity task  # payload schema guard
```

Single-test/focused verification: there is no test framework or `tests/` dir. Backend
guards are covered by `bin/run_api_evals.py`; the frontend has a eval suite embedded in
the `skills/task-master.md` "Appendix: Eval suite" (run by spawning a subagent) plus
`node --check` for syntax. JSON-Pydantic schemas live in `app/schemas.py`; ORM models in
`app/models.py`.

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

Base: `http://127.0.0.1:8000` — all routes under `/api`. Interactive docs at `/docs`.

### Projects
- `GET    /api/projects?status=&q=` — list (filter by status or text query)
- `POST   /api/projects` — create
- `GET    /api/projects/{id}`
- `PUT    /api/projects/{id}` — update (partial; any subset of fields)
- `DELETE /api/projects/{id}`
- `POST   /api/projects/{project_id}/start` — promote a backlog idea: set active + start its top task
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
- `GET    /api/tasks?status=&project_id=&q=` — all tasks (open + done), each with
  `project_title` and time summary
- `GET    /api/projects/{project_id}/tasks` — list tasks for a project
- `POST   /api/projects/{project_id}/tasks` — create task under project
- `GET|PUT|DELETE /api/tasks/{id}` — single task
- `PATCH  /api/tasks/{id}/status?status=` — advance status
  (`wanted`/`planned`/`in_progress`/`done`)
- `POST   /api/tasks/{id}/start` — demote any other `in_progress` task to `planned`,
  then make this the single current task
- Fields: `title` (req), `status`, `priority` (high/medium/low), `due_date`
  (YYYY-MM-DD or null), `begin_date` (YYYY-MM-DD or null), `duration` (float, hours),
  `branch_path` (full destination path, e.g. `work/2026/Q3 report`)

### Task time tracking (sessions)
One active timer globally; starting a new session auto-stops the running one and
marks the task `in_progress`. Sessions are server-authoritative (survive refresh)
and cascade-delete with their task.
- `POST   /api/tasks/{task_id}/sessions/start` — start (or resume) the timer for a task (201)
- `POST   /api/tasks/{task_id}/sessions` — manually create a session (201)
- `POST   /api/sessions/{session_id}/stop` — stop and record duration (200)
- `PUT    /api/sessions/{session_id}` — edit a session
- `GET    /api/tasks/{task_id}/sessions` — history `{sessions[], total_seconds, session_count}`
- `GET    /api/sessions/active` — currently running session or `null`
- `DELETE /api/sessions/{session_id}` — remove a session (204)
`GET /api/work` and `GET /api/tasks` entries carry `total_seconds`, `session_count`,
`running_session_id`.

### Journal
- `GET    /api/journal?date=&type=`
- `POST   /api/journal` / `GET|PUT|DELETE /api/journal/{id}`
- Fields: `date`, `type` (milestone/note/reflection), `content` (req-ish), `related_entity`

### Settings (key-value)
- `GET    /api/settings` — all settings as JSON; values are stored JSON-encoded
- `PUT    /api/settings` — bulk upsert `{"settings": {...}}`
- `PATCH  /api/settings/{key}` — upsert one key (JSON body is the raw value)
- `DELETE /api/settings/{key}`

### Work screen + aggregates
- `GET /api/work` — single contract for the Work tab: current task (rule 2), upcoming,
  ideas, projects; includes per-task time data
- `GET /api/tree` — `branch_path` hierarchy (branch roots → projects → tasks) that
  powers the mind-map widget
- `GET /api/dashboard` — everything the home screen needs in one call
- `GET /api/timeline?limit=` — merged chronological feed (learnings + projects + journal)
- `GET /api/daily-stats?days=` — per-day counters (active projects, tasks due, work seconds)
- `GET /api/stats` — aggregate counters + last 60 days of sessions (powers analytics widgets)
- `GET /api/analytics?range=daily|weekly|monthly` — per-bucket task/focus analytics for the
  Analytics Tracker widget: `{range, waking_hours, buckets[{start,label,tasks_created,
  tasks_completed,work_seconds,focus_score}]}`. Buckets cover up to today (19 days / 12 weeks /
  12 months); `focus_score` = clipped session-seconds ÷ (waking_hours × hours × days in bucket).

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

## Frontend reference (read-only context for agents)

The API is consumed by the browser UI, not written by agents. If you need to reason about where
data renders:

- `static/index.html` is the live dashboard at `/` — a thin shell that `core.js` fills by fetching each widget's markup from `static/widgets/<name>/index.html` and wiring the API.
- `static/new-dashboard.html` is an alternate, self-contained dashboard served at `/new-dashboard.html` (a standalone v2 redesign). Its shared CSS/JS live in `static/dashboard/` (`new-dashboard.css`, `time-picker.js`, `analytics-chart.js`, `interactions.js`, `app.js`), and it fetches the same `/api/*` endpoints but owns its own render loop. Its widget cards (hero, timer, task-list, chart, empty-slot) are saved as markup under `static/widgets/<name>/index.html`; `static/dashboard/widget-loader.js` injects them into the `data-dashboard-widget` mounts and then boots `interactions.js`, `analytics-chart.js`, and `app.js` in order once all widgets are in the DOM.
- `static/core.css` holds the design-system tokens (`--color-amber`, `--color-bg`, etc.).

Agents write data; they do not edit these UI files unless a task explicitly requires it. See `README.md` §8 for full layout details.

## Gotchas

- The repo directory is `Jane-Desk`, but the product is "Life-at-a-Glance" and the
  backend documents itself as such. The skill paths inside `skills/main-skill.md` and
  `skills/task-master.md` were corrected to point at this repo — keep them consistent
  if the repo moves again.
- The task-capture plugin (`skills/task-master.md`) is **human-in-the-loop by design**:
  it never writes to the database without explicit user approval of a preview. Don't
  bypass that gate.
- `data/life.db` is the single source of truth and is gitignored; a fresh clone has no
  data until `python3 -m app.seed` or `bin/seed_dummy.py` runs.
- No lockfile pins dependency versions — `requirements.txt` is unpinned, so treat
  upgrades conservatively.