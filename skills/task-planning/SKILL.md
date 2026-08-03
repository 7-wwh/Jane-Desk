---
name: task-planning
description: Everything about the task planning feature — the tasks table, its API, and how the frontend renders the task checklist under each project, including planning states wanted/planned/in_progress/done.
---

# Task Planning

## Concept

A **task** is the actionable planning unit. Projects are larger workstreams; tasks are the
specific things that make up a project. Tasks live *under* a project (each task belongs to
exactly one project via a foreign key). This lets you plan what you **want to do** and what
you **are going to do** next, project by project.

## Planning states

Tasks progress through four states:

```
wanted → planned → in_progress → done
```

- **wanted** — you want to do this at some point (the backlog of the project).
- **planned** — you have decided to do it; it has a slot.
- **in_progress** — you are doing it right now.
- **done** — finished.

The frontend surfaces: which tasks are wanted, what is next up (first non-done task), and a
completion ratio per project (done / total).

## Data model

See `app/models.py` → `Task`:

| Field | Type | Notes |
|---|---|---|
| `id` | int | PK |
| `project_id` | int | FK → projects, cascade delete |
| `title` | str | required |
| `status` | str | wanted/planned/in_progress/done |
| `priority` | str | high/medium/low |
| `due_date` | date \| None | optional deadline |
| `created_at` / `updated_at` | datetime | |

## API

- `GET    /api/projects/{project_id}/tasks` — list tasks for a project
- `POST   /api/projects/{project_id}/tasks` — create a task under the project
- `PUT    /api/tasks/{task_id}` — update any subset of fields
- `DELETE /api/tasks/{task_id}` — delete
- `PATCH  /api/tasks/{task_id}/status` — quick status change (used by checkbox toggle)

`/api/dashboard` includes each project's tasks; `/api/timeline` can include tasks too.

## Frontend

- Each project card renders its task checklist (title + status + checkbox + add task).
- Toggling a checkbox updates the task status (`PATCH .../status`).
- "Focus today" and "Tasks/Intentions" on the Overview read from tasks (backed by project data).
- All interactions keep the warm design language in `DESIGN.md`; touch targets ≥ 48px.

## Implementation notes

- Adding a task updates the parent project's `updated_at` so the project surfaces as recently
  touched.
- Deleting a project cascades to its tasks.
- The schema is additive (new table) — no data migration needed.
