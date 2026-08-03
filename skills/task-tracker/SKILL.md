---
name: task-tracker
version: "5.0"
description: >
  Master skill for the Life-at-a-Glance project. Describes how the whole system works —
  where data is stored (SQLite via a FastAPI REST API), how the webapp lays it out, and the
  task-planning logic (daily brief, project tree, knowledge atoms) the dashboard implements.
  Read this first whenever working on this project, then the matching sub-skill.
---

# Task Tracker Skill — v5.0 (master)

## Overview

This skill is the **project-wide master document** for Life-at-a-Glance. The project is a
self-hosted personal life-status dashboard: a vanilla HTML/CSS/JS frontend backed by a
FastAPI + SQLAlchemy + SQLite service. It does task/project planning, goal tracking,
knowledge capture, and journaling in one place, rendered in a dark "CHECK BOX" theme.

Everything is stored in one SQLite database (`data/life.db`) and is **only ever written via
the REST API** — never by editing the `.db` file directly. The webapp re-fetches the API
after every change, so a write through the API instantly updates the dashboard.

## Where data is stored (SQLite, via the API)

| Table | Purpose | Key fields | Statuses |
|---|---|---|---|
| `projects` | Workstreams | `title`, `description`, `status`, `priority`, `target_date`, `tags` | active / backlog / done / paused |
| `tasks` | Actionable next steps under a project | `title`, `status`, `priority`, `due_date`, `project_id` | wanted / planned / in_progress / done |
| `goals` | Long-term aspirations per life area | `area`, `title`, `progress` (0–100), `target_date`, `status` | active / completed / paused |
| `learnings` | Knowledge logged over time ("atoms") | `title`, `content`, `date`, `tags`, `related_project` | — |
| `journal` | Notable moments | `date`, `type`, `content`, `related_entity` | — |

Areas (for goals): `career / health / family / learning / finance / other`.
Priorities: `high / medium / low`.

The schema lives in `app/models.py` (ORM) and `app/schemas.py` (Pydantic allowed values).
New tables are additive — `Base.metadata.create_all` creates them on boot. See
`skills/backend/SKILL.md` for the entity pattern and the full API reference.

## How agents write data

Always go through the API, never the `.db` file. Use `bin/post.sh` for one-off entries or
curl directly. See `AGENTS.md` for the quick start.

```bash
# Log a learning (an "atom")
bin/post.sh learning '{"title":"SQLAlchemy 2.0 uses Mapped[] syntax","content":"...","tags":"python,sqlalchemy"}'

# Add a project
bin/post.sh project '{"title":"Launch personal site","status":"backlog","priority":"high","target_date":"2026-09-01"}'

# Add a task under project id=1
bin/post.sh task 1 '{"title":"Wire up task API","status":"planned","priority":"high"}'
```

Server is reachable locally (`http://127.0.0.1:8000`) and over Tailscale
(`http://100.74.182.63:8000`).

## The webapp layout (what the skill drives)

- **Overview** — greeting + today ring, PROJECTS and KNOWLEDGE metric cards, a **Daily
  Brief** panel (overdue / due this week / top priorities / focus / recent learnings),
  Tasks/Intentions, Habit Streaks, a Projects Timeline Gantt, and an Insights chart section.
- **Projects** — a **Project Tree** (per-project progress bars, status/priority dots,
  overdue flags), By-Status/By-Priority charts, and the project cards with task checklists.
- **Goals** — progress by area chart plus goal cards.
- **Knowledge** — an **atom ledger**: learnings grouped by `related_project` with date and
  tags, plus Top Tags and Learnings-over-Time charts.
- **Timeline** — a merged chronological feed (learnings + projects + journal).

## Operations (agent workflows)

### ADD A PROJECT / TASK
Trigger: "add a task", "new project", "track this"
1. `GET /api/projects` to find the project (`project_id`).
2. `POST /api/projects/{id}/tasks` with `title`, `status`, `priority`, optional `due_date`.
3. Confirm back to the user with a clean summary.

### UPDATE TASK STATUS
Trigger: "mark X done", "I finished X"
- Advance status via `PATCH /api/tasks/{id}/status?status=...` using one of
  `wanted → planned → in_progress → done`.
- When a task is **done**, encourage the user to log what they learned as a `learning`
  entry — that is how task atoms become knowledge.

### DAILY BRIEF
Trigger: "daily brief", "what should I work on", "what's due"
- The Overview page's **Daily Brief** card answers this live: overdue tasks, tasks due this
  week, the top 5 priorities (sorted by priority then due date), a focus suggestion, and
  recent learnings (last 7 days). No script needed — it computes from the API data.

### PROJECT TREE
Trigger: "show project tree", "project overview"
- The Projects tab's **Project Tree** panel shows each project's status dot, priority,
  done/total task progress bar, and an orange overdue flag when an open task is past due.

### KNOWLEDGE / ATOMS
Trigger: "I learned X", "show my knowledge"
- Learnings are the dashboard's knowledge atoms. Log them via `bin/post.sh learning` or the
  Knowledge tab's "+ New" flow. The Knowledge tab groups them into an atom ledger by
  `related_project`.

### QUERY / STATUS
Trigger: "show my tasks", "what's in [project]"
- Use the aggregate endpoints: `GET /api/dashboard` (everything the home screen needs) and
  `GET /api/timeline`. Render as clean markdown — never dump raw JSON.

## Writing rules

- **Never edit `data/life.db` directly** — always via the API.
- Prefer updating an existing entry (`PUT`) over creating duplicates.
- Keep descriptions under ~200 characters.
- Timestamps are UTC (`datetime.utcnow`); dates are `YYYY-MM-DD`.
- If an entry already exists, update it rather than adding a second copy.

## Where to look next

| Working on… | Read |
|---|---|
| Task planning model, API, or UI | `skills/task-planning/SKILL.md` |
| Data model / API / new entity | `skills/backend/SKILL.md` |
| Frontend layout / rendering / tokens | `skills/frontend/SKILL.md` |
| Status & health rules | `skills/status/SKILL.md` |
| Future nutrition/health work | `skills/health/SKILL.md` |
