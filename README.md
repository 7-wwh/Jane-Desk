# Life-at-a-Glance — The Complete Build Guide

> A personal life dashboard that shows your projects, goals, learnings, and timeline in one glance — fed by your agents.
> This README is written as a **learning guide**: read it top to bottom to understand *everything* about how this project is built, why it is organized the way it is, and how it maps to industry conventions.

---

## Table of Contents

1. [What this project is](#1-what-this-project-is)
2. [High-level architecture](#2-high-level-architecture)
3. [File structure map](#3-file-structure-map)
4. [Why it's organized this way (design rationale)](#4-why-its-organized-this-way)
5. [Industry conventions for this kind of project](#5-industry-conventions)
6. [The data model](#6-the-data-model)
7. [Data retrieval: the API](#7-data-retrieval-the-api)
8. [HTML projection: how the frontend renders](#8-html-projection)
9. [The agent write path](#9-the-agent-write-path)
10. [Running & deployment](#10-running--deployment)
11. [Learning exercises & glossary](#11-learning-exercises--glossary)

---

## 1. What this project is

**Life-at-a-Glance** is a self-hosted web dashboard that aggregates everything about the user's life:

- **Projects** — what they are working on now (`active`), planning (`backlog`), finished (`done`), or paused.
- **Tasks** — concrete next steps nested under projects (`wanted` → `planned` → `in_progress` → `done`).
- **Goals** — long-term aspirations, grouped by life area (career / health / family / learning / finance).
- **Learnings** — a knowledge log of things learned, one entry per insight.
- **Journal** — a timeline of notable moments (milestones, notes, reflections).

The defining trait: it is **written to by AI agents**. When the user (or an agent like opencode, codex, or claude) works on something, it posts a record to the dashboard through a simple JSON API. When the user opens the dashboard on their phone or laptop, they get a "one-glance" snapshot of where their life is headed.

Two audiences use it:

| Audience | Uses |
| :--- | :--- |
| **Agents** (opencode, codex, claude…) | `POST` JSON to the API to log learnings, update project status, add goals, journal moments. They also load a packaged set of **skills** (`SKILL.md` → `skills/`) that teach them *how* to use the dashboard. |
| **Human** (phone/laptop, anywhere) | Read the rendered dashboard over Tailscale. |

This repo is two products in one: the **dashboard app** (backend + frontend) and the **agent skill package** (instructions that make agents productive with it).

---

## 2. High-level architecture

```
                          ┌────────────────────────────────────────────┐
   AGENTS                 │              FastAPI app (app/)            │
   ─────────────────┐     │                                            │
   opencode         │     │  /api/learnings  ─▶ router ─▶ validate ─▶  │
   codex      HTTP  │     │  /api/projects   ─▶ router ─▶ validate ─▶  │
   claude     JSON  ├────▶│  /api/goals      ─▶ router ─▶ validate ─▶  │
   curl             │     │  /api/journal    ─▶ router ─▶ validate ─▶  │
   bin/post.sh      │     │  /api/dashboard  ─▶ aggregate query         │
   ─────────────────┘     │  /api/timeline   ─▶ merged feed             │
                          └──────────────────┬─────────────────────────┘
                                             │ SQLAlchemy (ORM)
                                             ▼
                                   ┌─────────────────────┐
                                    │  SQLite             │
                                    │  data/life.db       │
                                    │  (5 tables)         │
                                    └─────────────────────┘

   BROWSER (phone/laptop via Tailscale)
   ──────────────────────────────────────────────┐
        GET /  → static/index.html (HTML+CSS+JS) │
        GET /api/dashboard  ─────────────────────▶ FastAPI ─▶ JSON
        app.js fetches, computes charts, renders │
   ◀─────────────────────────────────────────────┘
```

**The three layers** (this is the classic **3-tier architecture**: presentation → application → data):

1. **Presentation** — `static/` (HTML/CSS/JS) rendered in the browser.
2. **Application** — `app/` (FastAPI + SQLAlchemy) that validates input, runs queries, and returns JSON.
3. **Data** — `data/life.db` (SQLite), the single source of truth.

FastAPI does double duty: it exposes the **JSON API** under `/api/*` *and* **serves the static frontend** from the root path `/`. One process, two jobs.

---

## 3. File structure map

```
life-at-a-glance/
├── README.md                       ← you are here; the learning guide
├── AGENTS.md                       ← instructions for AI agents on how to write data
├── SKILL.md                        ← entry point to the agent skill package
├── skills/                         ← agent skills (loaded by agents to work with the dashboard)
│   ├── status/SKILL.md             ←   how to set dashboard statuses & read health rules
│   ├── task-planning/SKILL.md      ←   how to plan and sequence tasks
│   ├── backend/SKILL.md            ←   how to add backend features
│   ├── frontend/SKILL.md           ←   how to work on the UI
│   └── health/SKILL.md             ←   (future) health/nutrition data rules
├── requirements.txt                ← Python dependencies (declared, installable)
├── .gitignore                      ← what NOT to commit (database, cache files)
│
├── app/                            ← BACKEND (Python package)
│   ├── __init__.py                 ← marks app/ as an importable package
│   ├── database.py                 ← SQLite engine, session factory, DB dependency
│   ├── models.py                   ← ORM models: the 5 database tables
│   ├── schemas.py                  ← Pydantic schemas: validation + API shapes
│   ├── main.py                     ← FastAPI app: every route + static mount
│   └── seed.py                     ← one-time seed script (sample data)
│
├── static/                         ← FRONTEND (served as-is, no build step)
│   ├── index.html                  ← the page skeleton (shell + containers)
│   ├── styles.css                  ← the design system (CHECK BOX dark theme)
│   └── app.js                      ← all logic: fetch, state, render, charts
│
├── bin/                            ← OPERATIONS scripts (run manually / by agents)
│   ├── post.sh                     ← one-command helper for agents to add entries
│   └── run.sh                      ← starts the dev server
│
├── deploy/                         ← DEPLOYMENT artifacts
│   └── life-dashboard.service      ← systemd unit file (copied to ~/.config/systemd/user/)
│
└── data/                           ← RUNTIME DATA (created automatically, gitignored)
    └── life.db                     ← SQLite database (never commit this)
```

Every file is in exactly one place, with one job. That's the organizing principle — see next section.

---

## 4. Why it's organized this way

### 4.1 Layered separation: `models` vs `schemas` vs `routes`

The single most important design decision is splitting the data into three representations:

| File | Represents | Concern | Analogy |
| :--- | :--- | :--- | :--- |
| `models.py` | **How data is stored** | Database schema (SQLAlchemy `Mapped[]` columns) | The filing cabinet |
| `schemas.py` | **How data travels** | API validation & shapes (Pydantic) | The envelope/form |
| `main.py` routes | **What happens to data** | Behavior (query, validate, respond) | The clerk |

**Why not one file?** Because the three concerns change for different reasons:

- You might want to store `created_at` but *never* let agents send it (a `Create` schema excludes it).
- You might validate `progress` is 0–100 (Pydantic) but store it as a `Float` (SQLAlchemy).
- You might join tables in a route without changing the storage shape.

This separation is **the industry-standard FastAPI pattern**: models describe persistence, schemas describe the API contract, and routes are thin glue. It is the "convention over configuration" of the Python web world.

### 4.2 Backend vs frontend split (`app/` vs `static/`)

The **backend is the product** — it owns the data and the write path agents depend on. The **frontend is a consumer** of that backend, exactly like an agent is. Keeping them in separate directories:

- Lets agents, curl, and the UI all use *the same* JSON contract.
- Means the UI can be swapped, restyled, or even replaced by a mobile app without touching data logic.
- Mirrors real-world teams where backend and frontend are separate codebases.

### 4.3 Why the frontend is plain HTML/CSS/JS (no build step)

`static/` is hand-written, dependency-free, and served directly by FastAPI's `StaticFiles`. No npm, no webpack/Vite, no `node_modules`, no compile step. Rationale:

- **Zero deployment friction** — restart the service and the new code is live.
- **Fits the scale** — a personal dashboard doesn't need a framework's complexity.
- **The design is achieved in CSS** — dark industrial theme, cards, Gantt, and charts are all hand-rolled (see the SVG chart helpers in `app.js`), no charting library required.

Trade-off acknowledged: frameworks give you state management and components; vanilla JS means we manage both by hand (see the `state` object in `app.js`). For a single-page dashboard of this size, that's the right call.

### 4.4 Operational folders: `bin/` and `deploy/`

- **`bin/`** holds *scripts people and agents run* (`post.sh`, `run.sh`) — the "command line interface" of the project.
- **`deploy/`** holds *how the project runs in production* (the systemd unit). Keeping it separate from code means deploying is "copy the service file + start it", a repeatable, documented operation.

### 4.5 Why `data/life.db` is gitignored

`.gitignore` excludes the database and Python bytecode (`__pycache__`). Reasons:

- The database is **personal, private life data** — committing it to a shared repo would leak it.
- It is **regenerable** — `app/seed.py` repopulates a fresh clone with sample data, so the repo is self-contained without the file.
- It avoids **merge conflicts** — binary files that change constantly shouldn't live in version control.

The rule is: *commit code and documentation, never runtime data or secrets.*

---

## 5. Industry conventions

This project deliberately follows standard practice for a **FastAPI + SQLAlchemy + SQLite** service. Knowing these names means you can describe it to other engineers:

| Convention | How this project applies it |
| :--- | :--- |
| **3-tier architecture** | presentation (`static/`) / application (`app/`) / data (SQLite). |
| **Layered FastAPI app** | `models` → `schemas` → routes, the canonical FastAPI structure. |
| **Pydantic Base/Create/Update/Out** | Each entity has a base shape, a create shape (all fields), an update shape (all optional for partial `PUT`), and an out shape (adds `id`, timestamps). This is the recommended request/response model pattern. |
| **RESTful CRUD** | Every resource exposes `GET` (list/get), `POST` (create), `PUT` (update), `DELETE` — with HTTP codes 201/204/404/400. |
| **Dependency injection** | `Depends(get_db)` gives each route its own DB session (FastAPI's built-in DI). |
| **Validation at the boundary** | Enum-like sets (`PROJECT_STATUSES`, `PRIORITIES`) reject bad input before it reaches the DB. |
| **Read models / aggregate endpoints** | `/api/dashboard` and `/api/timeline` are purpose-built *reads* that assemble multiple tables — a lightweight form of CQRS (command-query separation). |
| **Code-first schema** | `Base.metadata.create_all()` builds tables from ORM classes — good for prototypes; production teams switch to migrations. |
| **Config & secrets hygiene** | No secrets in code; DB is gitignored; no auth is a *documented* MVP trade-off. |
| **Deployment via init system** | systemd user service + `loginctl enable-linger` = survive reboots, no login required. |
| **Agent-friendly interface** | `AGENTS.md` + `bin/post.sh` are a machine-readable contract, like an SDK for LLMs. |
| **Skill package** | `SKILL.md` → `skills/*` split procedural guidance by task, so agents load only what they need. |
| **Task hierarchy** | Tasks are a child table of projects (FK + `ON DELETE CASCADE`) — the same pattern as "issues under a board" in GitHub. |

### What a bigger production project would add

Honest look at where this stops being "best practice" for a small app and what industry would layer on:

- **`routers/` subpackage** — split `main.py` into `routers/projects.py`, `routers/goals.py`, etc. (API grows beyond ~5 files).
- **Alembic migrations** — versioned schema changes instead of `create_all()`.
- **`tests/`** — pytest + `httpx`/`TestClient` for route tests.
- **Auth** — real authentication (JWT/OAuth) instead of none.
- **A real database** — PostgreSQL for concurrency and durability over SQLite.
- **Async SQLAlchemy** — `AsyncSession` + async routes for higher throughput.
- **Docker** — containerize for reproducible deploys.
- **Frontend framework** — React/Vue/Svelte with a build pipeline once the UI outgrows vanilla JS.
- **Observability** — structured logging, metrics, health checks beyond `/api/health`.

This project is at the "clean, well-organized small service" stage — which is exactly right for its purpose.

---

## 6. The data model

Five tables. Projects and tasks form a **parent–child hierarchy**; the rest are flat, each mapping 1:1 to a dashboard view. All use SQLAlchemy 2.0 `Mapped[type]` annotations (modern style replacing the old `Column()` API).

### `projects`
| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | int PK | auto-increment |
| `title` | str(200) | required |
| `description` | text | |
| `status` | str | `active` / `backlog` / `done` / `paused` |
| `priority` | str | `high` / `medium` / `low` |
| `target_date` | date·null | optional deadline |
| `tags` | str | comma-separated |
| `created_at` / `updated_at` | datetime | auto-set / auto-update |

### `tasks`
| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | int PK | auto-increment |
| `project_id` | int FK → `projects.id` | **`ondelete=CASCADE`** — deleting a project removes its tasks |
| `title` | str(200) | required |
| `status` | str | `wanted` / `planned` / `in_progress` / `done` |
| `priority` | str | `high` / `medium` / `low` |
| `due_date` | date·null | optional due date |
| `created_at` / `updated_at` | datetime | auto-set / auto-update |

The **status progression** `wanted → planned → in_progress → done` mirrors a real workflow: *"would like" → "committed" → "working now" → "finished"*. The dashboard uses it to answer *what should I do next?* — picking the highest-priority non-done task across active projects.

### `goals`
`area` (career/health/family/learning/finance/other), `title`, `description`, `progress` (float 0–100), `target_date`, `status` (`active`/`completed`/`paused`).

### `learnings`
`title`, `content`, `date` (defaults to today), `tags`, `related_project` (a free-text link to a project).

### `journal`
`date`, `type` (`milestone`/`note`/`reflection`), `content`, `related_entity`.

**Why these five?** They are the five questions the dashboard answers at a glance:
> *What am I building?* (projects) · *What's the next step?* (tasks) · *Where am I going?* (goals) · *What did I learn?* (learnings) · *What happened?* (journal)

Note the pragmatic choice of **string-encoded enums** (`status`, `type`, `priority`) instead of DB-level enum types. This keeps writes friendly for AI agents — a string like `"backlog"` is far easier for an LLM to produce correctly than an enum object or a foreign-key ID.

---

## 7. Data retrieval: the API

All routes live in `app/main.py`, prefixed `/api`. Every handler follows the same pattern:

```
validate (schemas/validators) → query (SQLAlchemy) → serialize (schemas.*Out) → JSON
```

### Endpoint reference

| Method | Endpoint | Filters | Returns |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/projects` | `status`, `q` | list of projects |
| `POST` | `/api/projects` | — | created project (201) |
| `GET` / `PUT` / `DELETE` | `/api/projects/{id}` | — | one / updated / 204 |
| `GET` / `POST` | `/api/projects/{id}/tasks` | — | list / create task under project |
| `GET` / `PUT` / `DELETE` | `/api/tasks/{id}` | — | one / updated / 204 |
| `PATCH` | `/api/tasks/{id}/status` | `?status=` | advance status (`wanted`/`planned`/`in_progress`/`done`) |
| `GET` | `/api/goals` | `area`, `status` | list of goals |
| `POST` | `/api/goals` | — | created goal (201) |
| `GET` / `PUT` / `DELETE` | `/api/goals/{id}` | — | one / updated / 204 |
| `GET` | `/api/learnings` | `date`, `tag`, `q` | list of learnings |
| `POST` | `/api/learnings` | — | created learning (201) |
| `GET` / `PUT` / `DELETE` | `/api/learnings/{id}` | — | one / updated / 204 |
| `GET` | `/api/journal` | `date`, `type` | list of entries |
| `POST` | `/api/journal` | — | created entry (201) |
| `GET` / `PUT` / `DELETE` | `/api/journal/{id}` | — | one / updated / 204 |
| `GET` | `/api/dashboard` | — | **aggregate snapshot** for the home screen |
| `GET` | `/api/timeline` | `limit` | **merged chronological feed** |

### The aggregate endpoints (read models)

- **`GET /api/dashboard`** runs five queries in one request and returns everything the overview screen needs: `active_projects`, `backlog`, `recent_learnings` (10), `goals`, `journal` (15), plus `today` and `tasks_by_project` (tasks grouped by project id). This is a *single round-trip* for the frontend — a deliberate performance/UX choice.
- **`GET /api/timeline`** pulls all learnings, projects, journal entries, and tasks, normalizes each into a `TimelineItem` (`kind`, `date`, `title`, `body`, `tags`, `entity_id`), sorts descending by date, and caps the result at `limit`. It fuses heterogeneous entities into one feed — a classic "polymorphic timeline" problem.

### Live interactive docs

FastAPI auto-generates **OpenAPI** docs. Open `http://127.0.0.1:8000/docs` — every endpoint can be tried from the browser with a click.

---

## 8. HTML projection

The frontend is a **single-page app in plain JavaScript**. There is no framework and no routing — one page, five tab panels, toggled by CSS classes.

### 8.1 The page load lifecycle

```
browser opens /
   │
   ├─ static/index.html  (shell: header, nav, panels, modal, toast)
   ├─ static/styles.css  (design system)
   └─ static/app.js      (logic)
            │
            ├─ init(): updateClock() + bindEvents() + refreshAll()
            │
            └─ refreshAll():
                 ├─ GET /api/dashboard  → renderOverview() + renderGoals()
                 ├─ GET /api/projects   → renderProjects()
                 ├─ GET /api/learnings  → renderLearnings()
                 └─ GET /api/journal    → (feeds charts)
```

### 8.2 State → render pipeline

`app.js` keeps a single `state` object (the poor-man's Redux):

```js
const state = {
  dashboard, projects, learnings, journal, timeline,
  projectFilter, timelineLoaded, reportsDays
};
```

Every fetch **writes into `state`**, then a matching `render*()` function **reads `state`** and rewrites the DOM. The golden rule: *data lives in `state`; the DOM is just its reflection*. After any mutation (create/update/delete), `refreshAll()` re-fetches and re-renders. This unidirectional flow is the same idea behind React.

### 8.3 Element ID → render function map

| DOM container (`index.html`) | Render function (`app.js`) | What it draws |
| :--- | :--- | :--- |
| `#stat-strip` | `renderOverview()` | 5 quick stat tiles |
| `#metric-projects` | `renderMetricProjects()` | PROJECTS metric tile: active count + delta + sparkline |
| `#metric-knowledge` | `renderMetricKnowledge()` | KNOWLEDGE metric tile: learnings this week + delta + sparkline |
| `#gantt-chart` | `renderGantt()` | Projects Timeline Gantt (30-day task spans) |
| `#reports-chart` | `renderReportsChart()` | SVG line chart, learnings vs journal (7/30 days) |
| `#proj-status-body` | `renderProjectStatus()` | segmented bar + legend of project statuses |
| `#weekly-chart` | `renderWeeklyChart()` | SVG line chart, this week vs last week |
| `#hex-cluster` + `#hex-list` | `renderHexAreas()` | hexagon cluster colored by goal area |
| `#weekday-chart` | `renderWeekdayChart()` | weekday activity bars, today highlighted |
| `#overview-projects` | `renderOverview()` | active project cards (each now shows its task checklist + completion bar) |
| `#overview-journal` | `renderOverview()` | today's journal cards |
| `#tasks-body` | `renderTasks()` | **today's tasks**: open first, then done, from active projects |
| `#focus-body` | `renderFocus()` | **next-up task**: highest-priority non-done task of the top active project |
| `#projects-cols` | `renderProjects()` | project list grouped by status |
| `#goals-list` | `renderGoals()` | goals grouped by life area |
| `#learn-list` | `renderLearnings()` | filtered learning cards |
| `#timeline-list` | `renderTimeline()` | merged timeline feed |

### 8.4 Charts are hand-rolled SVG

There are **no chart libraries**. The widgets build their own SVG/HTML:

- `lineChart()` builds `<path>` and `<circle>` elements in a `<svg viewBox>` for the Reports and Weekly charts.
- `sparkline()` draws the thin fill-gradient lines inside the metric cards.
- `renderGantt()` lays out the **Projects Timeline** — stadium-pill bars with embedded project-initial dots on a dotted 30-day grid, the signature element of the design.
- `renderHexAreas()` lays out hexagons in expanding rings (`hexLayout()`), coloring each by life-area color and opacity by goal count.
- `renderWeekdayChart()` computes per-weekday totals and renders CSS bars with the "today" column highlighted.
- `renderDonut()` renders SVG donuts for project status and journal types.

All aggregation (counting learnings per day, this-week vs last-week, weekday totals) happens **client-side** from the raw lists returned by the API. This keeps the backend simple — it returns raw rows; the frontend shapes them into charts.

### 8.5 Safety: escaping

All user/agent-provided text is passed through `esc()` before being written into HTML, preventing XSS from anything an agent posts. This is a non-negotiable practice whenever a page renders third-party input.

---

## 9. The agent write path

The whole point: **agents feed the dashboard**. Two entry points:

### `bin/post.sh` (easiest)

```bash
bin/post.sh learning '{"title":"Learned X","content":"details","tags":"python"}'
bin/post.sh project '{"title":"New idea","status":"backlog","priority":"high"}'
bin/post.sh task 1 '{"title":"Wire up the API","status":"planned","priority":"high"}'
bin/post.sh goal '{"area":"health","title":"Run 5km","progress":40}'
bin/post.sh journal '{"type":"milestone","content":"Shipped it"}'
bin/post.sh list projects
bin/post.sh delete learning 3
```

The script maps friendly names (`learning`, `project`, …) to API endpoints and `POST`s JSON via curl. It's the "SDK" for LLMs — one command per entry, no HTTP knowledge required.

### The REST API (full power)

Same endpoints as section 7, callable from any HTTP client:

```bash
curl -s -X POST http://127.0.0.1:8000/api/learnings \
  -H "Content-Type: application/json" \
  -d '{"title":"Learned X","content":"details","tags":"python"}'
```

### `AGENTS.md`

Every agent that opens this repo reads `AGENTS.md` — it states the rules explicitly:

- **Never** edit `data/life.db` directly; always use the API.
- When to log a `learning`, when to add/update a `project`, when to write a `journal` entry.
- Keep entries short, factual, comma-separated tags.
- Prefer `PUT` (update) over duplicating an existing entry.

This is a *documented contract between humans and machines* — the same idea as writing an SDK reference.

### The skill package (`SKILL.md` + `skills/`)

Beyond the API, the repo ships **agent skills** — Markdown instructions agents can load to do dashboard work well:

- **`SKILL.md`** (root) — the entry point. Tells an agent the package exists and where each part lives.
- **`skills/status/SKILL.md`** — how to read and set the dashboard's status fields (project/task/goal statuses, plus the *health rules* the user provides separately).
- **`skills/task-planning/SKILL.md`** — how to plan work as tasks: one next step at a time, the `wanted → planned → in_progress → done` progression, and keeping in-flight tasks to a minimum.
- **`skills/task-tracker/SKILL.md`** — the **external** JSON/Obsidian task-tracker (daily brief, project tree, knowledge atoms, cron scripts). Secondary to the dashboard's own task feature; see the "Relationship to the dashboard" note inside.
- **`skills/backend/SKILL.md`** / **`skills/frontend/SKILL.md`** — how to extend the backend (routes/schemas/models) or the UI (rendering, styles) consistently.
- **`skills/health/SKILL.md`** — placeholder for future health/nutrition data rules.

The split mirrors how agents actually think: a general "how do I work on this repo" instruction plus focused playbooks for specific tasks. Health status rules are intentionally *external to the UI* — the dashboard shows what's happening; the rules for judging it live in the skills.

---

## 10. Running & deployment

### Local dev

```bash
python3 -m venv .venv && source .venv/bin/activate   # optional but recommended
pip install -r requirements.txt
python3 -m app.seed        # populate sample data (skips if data exists)
./bin/run.sh               # uvicorn on 0.0.0.0:8000
```

Then open http://127.0.0.1:8000 (UI) or http://127.0.0.1:8000/docs (API docs).

### As a persistent service (this machine)

```bash
# install the unit (already done on this box)
cp deploy/life-dashboard.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now life-dashboard
loginctl enable-linger ubuntu     # start at boot without login

# manage it
systemctl --user status life-dashboard
systemctl --user restart life-dashboard
journalctl --user -u life-dashboard -f
```

### Access from anywhere

The service listens on `0.0.0.0:8000`. The machine runs **Tailscale**, giving it a stable private IP:
`http://100.74.182.63:8000` — reachable from any device signed into the same Tailnet (phone, laptop, tablet), with no public exposure.

### The systemd unit, explained

```ini
[Unit]
Description=Life-at-a-Glance personal dashboard
After=network-online.target          # don't start until networking is up

[Service]
Type=simple                          # the main process IS the service
WorkingDirectory=/home/ubuntu/Personal Projects/life-at-a-glance
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=on-failure                   # auto-restart on crash
RestartSec=3
Environment=PYTHONUNBUFFERED=1       # flush logs immediately

[Install]
WantedBy=default.target              # user-level boot target
```

Note it's a **user** service (`--user`), not a system service — no root needed, and with `enable-linger` it still runs at boot even before anyone logs in.

---

## 11. Learning exercises & glossary

### Walk-the-code prompts

Try these to solidify the mental model:

1. **Trace a write**: `bin/post.sh learning '{"title":"X","content":"Y"}'` → `post.sh` curls `/api/learnings` → `create_learning()` validates → `models.Learning(**data)` → `db.commit()` → JSON back. Where is each step in `app/main.py`?
2. **Trace a read**: browser loads `/` → `app.js init()` → `refreshAll()` → `/api/dashboard` → `dashboard()` runs 5 queries → `renderOverview()` writes DOM. Which file owns each step?
3. **Add a filter**: make `/api/goals` also filter by `progress >= X`. Which files change (`main.py` only) and which don't (models, schemas, frontend)? Why?
4. **Why not an enum column?** Re-read section 6. What breaks for agents if `status` became a DB enum? (Hint: what does an LLM need to send in JSON?)
5. **New view**: add a new dashboard section "Contacts". Which new table, model, schema, route, and DOM container would you create? Notice the 1:1:1:1 mapping.

### Glossary

| Term | Meaning |
| :--- | :--- |
| **ORM** | Object-Relational Mapper — maps Python classes to DB tables (SQLAlchemy). |
| **SQLAlchemy `Mapped[]`** | Modern 2.0 syntax: `id: Mapped[int] = mapped_column(...)`. |
| **Pydantic schema** | A Python class that validates and serializes JSON. |
| **Endpoint / route** | A URL path (`/api/projects`) handled by a function. |
| **CRUD** | Create / Read / Update / Delete — the four basic operations. |
| **`Depends(get_db)`** | FastAPI dependency injection; yields a DB session per request. |
| **Response model** | Pydantic schema applied to the return value (e.g. `response_model=list[ProjectOut]`). |
| **Mount** | Attaching a sub-application or static directory to a path (`app.mount("/", StaticFiles(...))`). |
| **Read model** | A purpose-built query shape for display (`/api/dashboard`). |
| **CQRS** | Command-Query Responsibility Segregation — separate write and read shapes. |
| **systemd unit** | A config file defining a service (`life-dashboard.service`). |
| **Linger** | Keep a user's systemd services running after logout / at boot. |
| **Tailnet** | The private network created by Tailscale across your devices. |
| **XSS** | Cross-Site Scripting — why all input is escaped before rendering. |

---

*Built to be understood. If a section is unclear, that's a bug in the README — open an issue.*
