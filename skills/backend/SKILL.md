---
name: backend
description: Conventions for the FastAPI + SQLAlchemy + SQLite backend — the data model, schema validation, API patterns, and how to add a new entity. Read this before touching app/.
---

# Backend

## Stack

- FastAPI + Uvicorn
- SQLAlchemy 2.0 (Mapped / mapped_column) + SQLite
- Pydantic v2 schemas
- No auth — reachable locally and over Tailscale at `http://100.74.182.63:8000`

## File layout

| File | Role |
|---|---|
| `app/models.py` | SQLAlchemy ORM models (tables) |
| `app/schemas.py` | Pydantic models + allowed-value constants |
| `app/main.py` | Routes, validation helpers, app setup, static mount |
| `app/database.py` | Engine, session, `Base` |

## Entity pattern

For every entity (project, task, goal, learning, journal):

1. **Model** in `models.py`: `id`, content fields, `created_at` (and `updated_at` where mutable).
2. **Schemas** in `schemas.py`: `XBase`, `XCreate(XBase)`, `XUpdate` (all fields optional), `XOut` (`from_attributes=True`).
3. **Constants** in `schemas.py` for allowed values (e.g. `PROJECT_STATUSES`) — used by validators and the frontend.
4. **Routes** in `main.py`:
   - `GET /api/{x}` (list, with optional filters)
   - `POST /api/{x}` (create, 201)
   - `GET /api/{x}/{id}`
   - `PUT /api/{x}/{id}` (partial update)
   - `DELETE /api/{x}/{id}` (204)
   - Nested variants like `GET /api/projects/{id}/tasks`.

## Validation

Use small helper functions (`validate_project`, `validate_goal`, …) that raise
`HTTPException(400, ...)` for invalid status/priority/area/type values. Add one per new
entity. Frontend sends known-good values, so validation is a safety net.

## Dashboard & timeline

- `GET /api/dashboard` returns everything the home screen needs in one call (`today`,
  `active_projects`, `backlog`, `recent_learnings`, `goals`, `journal`, and tasks per project).
- `GET /api/timeline` merges learnings + projects + journal (and tasks) into a chronological
  feed of `TimelineItem`s.

## Conventions

- `NOW = datetime.utcnow` is the default for timestamps.
- Never edit `data/life.db` directly from a script — always go through the API.
- New tables are additive: `Base.metadata.create_all(bind=engine)` creates them on boot.
- Keep descriptions under ~200 characters.
