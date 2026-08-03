---
name: life-status-rules
description: Defines how the dashboard decides whether a life area, project, or task is doing okay or needs attention. This is the single source of truth for health/status rules; the UI consumes these rules and never hard-codes them.
---

# Status / Health Rules

## Purpose

The dashboard's core promise is "is everything doing okay?". This skill defines *how* that
question is answered for each scope: life area, project, and task. Rules here are
**external to the UI** — the frontend renders whatever these rules produce.

## Rule format

A rule is a small, declarative check that returns one of:

- `ok` (green) — on track, no attention needed
- `warn` (amber) — watch it, action needed soon
- `alert` (red) — needs attention now
- `muted` (grey) — inactive / no data, not a problem

Each check carries a short **reason** string the UI can show ("3 tasks overdue", "goal stalled
below 30%", "no activity in 7 days").

## Per-area health

Areas: `career`, `health`, `family`, `learning`, `finance`, `other`.

A life area aggregates:

- its goals (`status` active, `progress` 0–100, `target_date`)
- its projects (via task/project tags or an area mapping)
- recent activity (learnings + journal in the last N days)

> **Status: SPEC PENDING.** The exact aggregation and thresholds for per-area health have not
> been finalized. See the open questions in `QUESTION.md` (section "Status / health rules").
> Until specified, the frontend shows a neutral `ok`/`muted` fallback and never pretends a
> rule exists that does not.

## Per-project status

Inputs available per project:

- open vs. done tasks (task status)
- `priority` (high/medium/low)
- `target_date` vs. today (overdue?)
- project `status` (active/backlog/done/paused)

> **Status: SPEC PENDING.** Thresholds (e.g. "overdue active project ⇒ alert", "high-priority
> backlog ⇒ warn") are open questions in `QUESTION.md`. See above.

## Per-task planning state

Tasks move through `wanted → planned → in_progress → done`. This is not a "health" check —
it is the planning state the dashboard surfaces so you can see what is wanted, what is
next, and what is done.

## How to change rules

1. Read this file and `QUESTION.md`.
2. Edit the rule definitions (or add a `rules` data structure the frontend fetches).
3. Keep every check returning a status + a one-line reason.
4. Never hard-code a rule in `static/app.js` — that duplicates the source of truth.
