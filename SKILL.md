---
name: life-at-a-glance
description: Entry point for agents working on the Life-at-a-Glance personal life-status dashboard. Explains what the database and webpage do, how agents keep data current via the API, and redirects to the per-part skill that matches the task at hand.
---

# Life-at-a-Glance — Main Skill

## What this project is

A self-hosted personal **life-status dashboard**. One glance shows what life is actually
looking like: what you are working on, which tasks are wanted/planned/in motion, whether
each life area (career, health, family, learning, finance, other) is doing okay, and what
needs attention. It is a warm daily companion, not a corporate KPI dashboard.

The package is **two things**:

1. **The dashboard** — a vanilla HTML/CSS/JS frontend backed by a FastAPI + SQLite service.
2. **Agent skills** — these `SKILL.md` files, so that any agent pointed at this repo can
   orient itself and know exactly which part of the project to work on.

## Where things live

| Path | Purpose |
|---|---|
| `app/` | FastAPI backend: `models.py`, `schemas.py`, `main.py`, `database.py` |
| `static/` | Frontend: `index.html`, `styles.css`, `app.js` (no build step) |
| `data/life.db` | SQLite database — **never edit directly, always via the API** |
| `bin/post.sh` | One-command agent writer for entries |
| `DESIGN.md` | Design specification (vision, palette, layout, status layer) |
| `AGENTS.md` | Short quick-start: how to write entries via the API |
| `README.md` | Deep learning guide |
| `skills/` | Sub-skills, one per part of the project |

## The database at a glance

- **projects** — workstreams. `status`: active/backlog/done/paused. `priority`: high/medium/low. `target_date`, `tags`.
- **tasks** — the actionable planning unit under a project. `status`: wanted/planned/in_progress/done.
- **goals** — long-term aspirations per area (career/health/family/learning/finance/other). `progress` 0–100.
- **learnings** — knowledge logged over time, with `date` and `tags`.
- **journal** — notable moments (`type`: milestone/note/reflection).

## The webpage at a glance

- **Overview (daily companion first)** — Today Ring greeting, PROJECTS/KNOWLEDGE metric cards,
  **Daily Brief** (overdue / due this week / top priorities / focus / recent learnings), Tasks/
  Intentions, Habit Streaks, Projects Timeline Gantt, then an Insights chart section below.
- **Projects** — **Project Tree** (progress bars + status/priority + overdue flags), charts, and
  project cards with task checklists.
- **Goals / Knowledge / Timeline** tabs — progress by area + goal cards; the **atom ledger**
  (learnings grouped by project) + charts; the merged chronological feed.
- A status layer sits on top of the daily companion: per-area health, per-project progress,
  per-task planning state, all click-through to an edit/detail panel.

## How agents keep it current

Use `bin/post.sh` (one command per entry) or the REST API directly. See `AGENTS.md` for the
quick start and `skills/backend/SKILL.md` for the full API reference. Never edit the SQLite
file directly.

```bash
# Server is reachable over Tailscale
curl -s http://127.0.0.1:8000/api/health
```

## Which skill should I read?

**Read the sub-skill that matches your task.** For a full picture of how the whole project
fits together (storage, API, layout, task logic), start with `skills/task-tracker/SKILL.md`
first. If the task spans parts, read the relevant ones and start with the entry point below.

| If you are working on… | Read this skill |
|---|---|
| Health/status rules ("is everything doing okay?") | `skills/status/SKILL.md` |
| The task planning feature (model, API, UI) | `skills/task-planning/SKILL.md` |
| The whole project (storage, API, layout, task logic) | `skills/task-tracker/SKILL.md` |
| The data model, API, or adding a new entity | `skills/backend/SKILL.md` |
| The frontend layout, components, or rendering | `skills/frontend/SKILL.md` |
| Nutrition / health API integration (future) | `skills/health/SKILL.md` |

If none of the above match, read `skills/backend/SKILL.md` and `skills/frontend/SKILL.md`
for the core conventions before writing code.
