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
- **Tasks** — concrete next steps nested under projects (`wanted` → `planned` → `in_progress` → `done`), each with a **work timer** (play/stop per task, live elapsed label, session history modal).
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

The interface is **CHECK BOX**, an industrial dark theme: near-black backgrounds, a lime accent, and *semantic green/orange only* (no blue/purple/pink). Layout is a topbar with two tabs — **Work** (a fixed-height five-widget grid: Mind Map, Current Task, Tasks, Upcoming, Ideas) and **Settings**. Only the Tasks list scrolls; scrollbars are hidden globally. The full design spec (palette, type scale, card system, layout diagram) lives in `DESIGN.md`.

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
            │  (6 tables)         │
                                    └─────────────────────┘

   BROWSER (phone/laptop via Tailscale)
   ──────────────────────────────────────────────┐
        GET /  → static/index.html (shell)
        GET /widgets/<name>/index.html (JS injects each widget's markup)
        core.js fetches the API, boot() injects + renders widgets │
        GET /api/work, /api/tree, ... ──────────▶ FastAPI ─▶ JSON
        main.js App.boot() renders the work screen  │
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
├── DESIGN.md                       ← the CHECK BOX design specification (palette, layout, cards)
├── QUESTION.md                     ← open design questions + confirmed decisions
├── skills/                         ← agent skills (loaded by agents to work with the dashboard)
│   ├── main-skill.md               ←   dispatcher/router: classifies a message → routes to a sub-skill
│   └── task-master.md              ←   extracts structured tasks from prose; resolves branch destination; pushes to the API; its "Appendix: Eval suite" verifies the extraction layer (run by a spawned subagent)
├── requirements.txt                ← Python dependencies (declared, installable)
├── .gitignore                      ← what NOT to commit (database, cache files, screenshots)
│
├── app/                            ← BACKEND (Python package)
│   ├── __init__.py                 ← marks app/ as an importable package
│   ├── database.py                 ← SQLite engine, session factory, DB dependency
│   ├── models.py                   ← ORM models: the 6 database tables
│   ├── schemas.py                  ← Pydantic schemas: validation + API shapes
│   ├── main.py                     ← FastAPI app: every route + static mount
│   └── seed.py                     ← one-time seed script (sample data)
│
├── static/                         ← FRONTEND (served as-is, no build step)
│   ├── index.html                  ← thin assembly: shell, topbar, layout, <link>/<script> tags
│   ├── core.css                    ← design system + shared components (CHECK BOX dark theme)
│   ├── core.js                     ← shared logic: state, fetch, helpers, data loading, dispatch
│   ├── main.js                     ← boot: App.boot() injects widgets, binds, renders, refreshes
│   └── widgets/                    ← one folder per widget (html/css/js edited together)
│       ├── mind-map/               ←   pan/zoom/collapse mind map (index.html, widget.css, widget.js)
│       ├── current-task/           ←   hero card + flip clock
│       ├── tasks/                  ←   flat task rows + Deadline/A-Z/Priority sort
│       ├── upcoming/               ←   upcoming task rows
│       ├── ideas/                  ←   idea rows + "+ New"
│       ├── settings/               ←   Display + System cards
│       ├── quick-add/              ←   the "+" composer modal
│       └── sessions/               ←   session history modal
│
├── bin/                            ← OPERATIONS scripts (run manually / by agents)
│   ├── post.sh                     ← one-command helper for agents to add entries
│   ├── run_api_evals.py            ← deterministic API guard evals (asserts HTTP status codes)
│   └── run.sh                      ← starts the dev server
│
├── deploy/                         ← DEPLOYMENT artifacts
│   └── life-dashboard.service      ← systemd unit file (copied to ~/.config/systemd/user/)
│
├── .screenshots/                   ← local-only verification captures (gitignored — contains private life data)
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
- **The design is achieved in CSS** — dark industrial theme, cards, and the hand-rolled SVG mind map (see `renderMindMap()` in `widgets/mind-map/widget.js`), no charting library required.

Trade-off acknowledged: frameworks give you state management and components; vanilla JS means we manage both by hand (see the `state` object in `core.js`). For a single-page dashboard of this size, that's the right call.

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

Six tables. Projects and tasks form a **parent–child hierarchy**; `task_sessions` hangs off tasks
with a cascade delete; the rest are flat, each mapping 1:1 to a dashboard view. All use
SQLAlchemy 2.0 `Mapped[type]` annotations (modern style replacing the old `Column()` API).

### `projects`
| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | int PK | auto-increment |
| `title` | str(200) | required, non-empty |
| `description` | text | |
| `status` | str | `active` / `backlog` / `done` / `paused` |
| `priority` | str | `high` / `medium` / `low` |
| `target_date` | date·null | optional deadline |
| `begin_date` | date·null | optional start date |
| `duration` | float·null | estimated hours, `0 … 8760` (1 yr cap) |
| `branch_path` | str(300) | root branch segment, e.g. `work` |
| `tags` | str | comma-separated |
| `created_at` / `updated_at` | datetime | auto-set / auto-update |

### `tasks`
| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | int PK | auto-increment |
| `project_id` | int FK → `projects.id` | **`ondelete=CASCADE`** — deleting a project removes its tasks |
| `title` | str(200) | required, non-empty |
| `status` | str | `wanted` / `planned` / `in_progress` / `done` |
| `priority` | str | `high` / `medium` / `low` |
| `due_date` | date·null | optional due date |
| `begin_date` | date·null | optional start date |
| `duration` | float·null | estimated hours, `0 … 8760` (1 yr cap) |
| `branch_path` | str(300) | full destination path, e.g. `work/2026/Q3 report` |
| `created_at` / `updated_at` | datetime | auto-set / auto-update |

**Branch paths** (`branch_path`) give tasks a tree position: the first `/`-segment matches a
project (by `title` or the project's own `branch_path`); deeper segments are virtual and may
one day render as a nested **Project Tree** in the UI. Agents assign these via the
`task-master` skill, which reads existing branches before writing.

The **status progression** `wanted → planned → in_progress → done` mirrors a real workflow: *"would like" → "committed" → "working now" → "finished"*. The dashboard uses it to answer *what should I do next?* — picking the highest-priority non-done task across active projects.

### `task_sessions`
| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | int PK | auto-increment |
| `task_id` | int FK → `tasks.id` | **`ondelete=CASCADE`** — deleting a task removes its sessions |
| `started_at` | datetime | server-authoritative timer start |
| `ended_at` | datetime·null | `null` while running |
| `duration_seconds` | float·null | set on stop |
| `created_at` | datetime | auto-set |

One session runs at a time globally; starting a new one auto-stops the previous. Sessions power the
**work-timer** on the Work screen — a play/stop button beside each task, a live ticking label, and
a per-task session history (count, date, start/stop, duration).

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
| `POST` | `/api/tasks/{id}/sessions/start` | — | start the timer for a task (201; auto-stops any running one) |
| `POST` | `/api/sessions/{id}/stop` | — | stop and record duration (200) |
| `GET` | `/api/tasks/{id}/sessions` | — | history `{sessions[], total_seconds, session_count}` |
| `GET` | `/api/sessions/active` | — | currently running session or `null` |
| `DELETE` | `/api/sessions/{id}` | — | remove a session (204) |
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

The frontend is a **single-page app in plain JavaScript**. There is no framework and no routing — one page, two tab panels (`Work` / `Settings`), toggled by CSS classes.

### 8.1 The page load lifecycle

```
browser opens /
   │
   ├─ static/index.html  (thin shell: topbar, layout wrappers, <link>/<script> tags)
   ├─ static/core.css + widgets/*/widget.css   (design system + per-widget styles)
   ├─ static/core.js + widgets/*/widget.js + main.js   (logic)
            │
            ├─ App.boot(): bindCore() → injectParts() (fetch + inject each widget's markup)
            │             → renderSettings() + updateClock() + startTicker() + refreshAll()
            │
            └─ refreshAll():
                 ├─ GET /api/work           → state.work        → renderCurrent() + renderUpcomingWork() + renderProjectsWork() + renderIdeas()
                 ├─ GET /api/projects       → state.projects    → (project dropdown in the Quick Add modal)
                 ├─ GET /api/sessions/active → state.activeSession → topbar timer pill + live labels
                 └─ GET /api/tree           → state.tree        → renderMindMap()
```

### 8.2 State → render pipeline

`core.js` keeps a single `state` object (the poor-man's Redux):

```js
const state = {
  work, projects, activeSession, tree,
  mindRoot, mindPan, mindZoom, mindDragged,
  editId, workSort, tab, settings
};
```

Every fetch **writes into `state`**, then a matching `render*()` function **reads `state`** and rewrites the DOM. The golden rule: *data lives in `state`; the DOM is just its reflection*. After any mutation (create/update/delete), `refreshAll()` re-fetches and re-renders. This unidirectional flow is the same idea behind React.

### 8.3 Element ID → render function map

| DOM container (widget markup) | Render function | What it draws |
| :--- | :--- | :--- |
| `#work-tree` (`widgets/mind-map/`) | `renderMindMap()` | **Mind Map**: the branch/project/task hierarchy as a pannable, zoomable SVG tree |
| `#work-current` (`widgets/current-task/`) | `renderCurrent()` | **Current Task** hero: title, priority chip, live flip-clock timer, Start/Stop, Edit, Done |
| `#work-projects` (`widgets/tasks/`) | `renderProjectsWork()` | **Tasks**: every open task across projects, sortable by deadline / A–Z / priority |
| `#work-upcoming` (`widgets/upcoming/`) | `renderUpcomingWork()` | **Upcoming**: next queued tasks |
| `#work-ideas` (`widgets/ideas/`) | `renderIdeas()` | **Ideas**: backlog projects, each with a Start button |

### 8.4 The work screen, in detail

The **Work** tab is a fixed-height two-column grid (the whole dashboard fits `100vh`, no page
scroll). Top row: Mind Map (left) + Current Task hero (right). Bottom row: Tasks (left) +
Upcoming + Ideas (right, stacked):

| Widget | Renderer | What it shows |
| :--- | :--- | :--- |
| **Mind Map** | `renderMindMap()` | the `branch_path` hierarchy as an SVG tree — branch nodes → project nodes → open task nodes, joined by animated connectors. The task with the running timer glows. |
| **Current Task** | `renderCurrent()` | the single `in_progress` task (the work rules, see `WORK_LOGIC.md`), its live flip-clock timer, Start/Stop, Edit, Done |
| **Tasks** | `renderProjectsWork()` | all open tasks from every project, one row each: priority dot, due/overdue label, session-time pill, Start, play/stop, done checkbox, Edit |
| **Upcoming** | `renderUpcomingWork()` | the next non-done tasks in active projects |
| **Ideas** | `renderIdeas()` | backlog projects; one click promotes the idea and starts its top task |

**Scroll policy:** only the **Tasks** list scrolls. Every other widget is non-scrolling
(`overflow: hidden`), and scrollbars are hidden globally (`scrollbar-width: none` +
`::-webkit-scrollbar { display: none }`) — no scrollbar chrome anywhere.

### 8.5 The mind map is a viewport, not a scrollable card

The tree is rendered once and moved with transforms — the user explores it like a PDF:

- **Pan** — drag anywhere to move in **all** directions (grab / grabbing cursor).
- **Zoom** — the scroll wheel zooms about the cursor (`0.25×–3×`), keeping the map point under the mouse stationary.
- **Reset** — double-click empty space returns to the home view (centered when the map fits, top-left when it overflows).
- **Expand** — a single click on a branch or project node expands/collapses it; a drag never toggles.
- Expands/collapses and data refreshes preserve the current pan/zoom.

### 8.6 Task interaction model

Every task row exposes the full action set, and the Current Task hero mirrors it:

| Action | Endpoint |
| :--- | :--- |
| Start task (rule 1: demotes any other `in_progress`) | `POST /api/tasks/{id}/start` |
| Start / stop the timer | `POST /api/tasks/{id}/sessions/start` · `POST /api/sessions/{id}/stop` |
| Mark done (checkbox) | `PATCH /api/tasks/{id}/status?status=done` |
| Session history (time pill opens the modal) | `GET /api/tasks/{id}/sessions` |
| **Edit** (pencil / Edit button) | `PUT /api/tasks/{id}` |

**Editing a task:** the pencil on any task row (and the Edit button on the Current Task hero)
opens the Quick Add modal pre-filled with the task's title, status, priority, due date, begin
date, duration, and branch path (project is read-only). Saving issues a
`PUT /api/tasks/{id}` with just those fields. Creating is unchanged: the `+` menu → Quick Add
modal → `POST /api/projects/{id}/tasks`.

After any mutation, `refreshAll()` re-fetches and re-renders everything — the DOM is always a
reflection of `state`.

### 8.7 Safety: escaping

All user/agent-provided text is passed through `esc()` before being written into HTML,
preventing XSS from anything an agent posts. This is a non-negotiable practice whenever a page
renders third-party input.

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
- **`skills/main-skill.md`** — the **dispatcher/router**. Agents that arrive with a message read this first, classify the intent, and are routed to the right sub-skill (today: `task-master.md`).
- **`skills/task-master.md`** — turns a natural-language message into a **JSON array of structured tasks** (`taskName`, `taskDescription`, `importance`, `beginDate`, `deadline`, `duration`, `branch`, `confidence`, `flags`). It guards against weird input (a `noTask` marker instead of fabricating, low confidence + `flags` on contradictions, date/duration sanity), **resolves the branch destination** by reading existing projects from the API, and documents how to push each task via `bin/post.sh`. Duration always converts to **hours** (24h day / 168h week, 8760h cap). Its **"Appendix: Eval suite"** is the extraction eval registry — a main agent reads it and **spawns a subagent** to run the fixtures (normal + pathological inputs) and return a pass/fail table. Complements `bin/run_api_evals.py`, which deterministically checks the server-side guards.

The split mirrors how agents actually think: a general "how do I work on this repo" instruction plus focused playbooks for specific tasks. Health status rules are intentionally *external to the UI* — the dashboard shows what's happening; the rules for judging it live in the skills.

### 9.1 How the task-tracker skill was optimized for this project

The task-capture logic now lives in **`skills/task-master.md`** (the dispatcher is
`skills/main-skill.md`). It started life as an
external, self-contained task-tracking skill (`task-tracker-v4`) that managed tasks in **JSON
files inside an Obsidian vault** with a cron-installed daily brief. When the user pointed out it
was "the skill for part of the project", it was brought into this repo and then **re-optimized to
speak the project's actual language**. That optimization had three moves:

1. **Storage: JSON vault → SQLite via the API.**
   The original read/wrote three JSON files (`tasks.json`, `active-tasks.json`, `knowledge.json`)
   under `/home/ubuntu/Documents/ObsidianVault/...` with a daily-brief log. The rewritten skill
   documents the real source of truth — one SQLite database (`data/life.db`) written exclusively
   through the FastAPI REST API, plus `bin/post.sh` for agents. No file editing, ever.

2. **Schema: the skill's model → the dashboard's model.**
   The external skill spoke `pending/active/blocked/done/cancelled` statuses,
   `critical/high/medium/low` priorities, nested subtasks, and "atoms" attached to tasks. The
   dashboard has its own model (`wanted → planned → in_progress → done`, `high/medium/low`), and
   *the dashboard's model is primary*. The skill was rewritten to describe the dashboard's real
   tables (`projects`, `tasks`, `goals`, `learnings`, `journal`), its statuses and priorities, and
   to map the old concepts onto them — task "atoms" became `learnings`; the task hierarchy became
   the `project_id` foreign key.

3. **Removed the unnecessaries; kept the logic.**
   Deleted the JSON-vault scripts (`write_tasks.py`, `write_knowledge.py`, `write_vault_index.py`,
   `daily_brief.py`, `install_cron.sh`) and the JSON `references/` — they only operated on the
   Obsidian vault and the cron brief. What the skill *did* (task lifecycle, a daily brief, a
   project tree, knowledge atoms) was kept, but re-expressed as operations on the dashboard:
    "Daily Brief" → the Current Task hero + Tasks list; the "Project Tree" → the Mind Map;
    "atoms" → `learnings` records. So an agent following the skill now drives the real
    webapp rather than a parallel JSON world.

The result: a skill chain that a fresh agent can read top-to-bottom and know *exactly* where data
lives, how to write to it, what the UI shows, and how the task logic works — with the
eval suite in task-master's appendix verifying the extraction layer.

---

## 9.1 Ingest logic (Telegram → Hermes → skills → database)

How any document you send gets into the dashboard:

1. You send a document (anything) to the Telegram bot.
2. Telegram hands it to **Hermes**, the main orchestrator/harness.
3. Hermes spawns an agent and points it at the **main skill** — a directory/routing skill.
4. The main skill looks at the document and routes it to the matching **sub-skill** (polish / analyze: figure out what it is, clean it up).
5. That sub-skill writes the result to the database via the API.
6. A **background agent** does the data processing and updates the fields the HTML shows.

Standing rule (unchanged): **never edit `data/life.db` directly — always write through the API.**

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
2. **Trace a read**: browser loads `/` → `App.boot()` → `injectParts()` + `refreshAll()` → `GET /api/work` + `/api/tree` → `renderWork()` writes the DOM. Which files own each step?
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
| **Daily Brief** | The Overview card that answers "what should I do today?" — overdue, due-this-week, top priorities, focus, recent learnings. |
| **Project Tree** | The Projects-tab panel: per-project progress bars with status/priority dots and overdue flags. |
| **Atom ledger** | The Knowledge-tab grouping of learnings by `related_project` — the dashboard's version of the skill's knowledge atoms. |
| **Gantt** | The signature Projects Timeline: one stadium-pill bar per project across a 30-day window. |
| **Master skill** | `skills/main-skill.md` (dispatcher) + `skills/task-master.md` (task extraction & push) — the project's agent skills for storage, API, and task logic. |

---

*Built to be understood. If a section is unclear, that's a bug in the README — open an issue.*
