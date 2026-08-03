---
name: frontend
description: Conventions for the vanilla HTML/CSS/JS frontend — layout, design tokens, chart helpers, rendering patterns, and where each feature's markup lives. Read this before touching static/.
---

# Frontend

## Stack

Vanilla HTML/CSS/JS. No build step, no framework, no charting library (SVG is hand-rolled).
Served by FastAPI's static mount at `/`.

## Files

| File | Role |
|---|---|
| `static/index.html` | Full page markup: header, tab panels, modal, containers for every chart/list |
| `static/styles.css` | Design tokens, layout, components. One rewrite landed the warm DESIGN.md theme |
| `static/app.js` | State, fetch helpers, chart helpers, renderers, event binding |

## Design tokens (CHECK BOX dark theme)

Defined in `styles.css` `:root`:

- Background `--color-bg: #111111` (void), surface `--color-surface: #1C1C1C`, elevated `--color-surface-hi: #242424`
- Border `--color-border: #2E2E2E`; accent lime `--color-lime: #AAEB47`; up/ok green `--color-green: #6DC533`; warn/orange `--color-orange: #F5A623`
- Text `--color-text-primary: #E8E8E8`, muted `--color-text-muted: #9B9B9B`, dim `--color-text-dim: #5C5C5C`
- Radius `--radius-card: 16px`, pill `--radius-pill: 999px`; font: Inter only (Google Fonts)
- Semantic green/orange only — no blue/purple/pink accents.

## Layout

- **Overview:** two columns — left ~57% (Greeting + Today Ring strip, PROJECTS/KNOWLEDGE metric
  cards, Tasks/Intentions, Habit Streaks, Insights grid), right ~43% (Daily Brief, Projects
  Timeline Gantt, Focus, Today, Upcoming). Sticky, scrollable right column.
- **Projects:** Project Tree panel (progress bars + status/priority dots + overdue flags),
  By-Status/By-Priority charts, then project cards with task checklists.
- **Knowledge:** Top Tags + Learnings-over-Time charts, then the atom ledger (learnings grouped
  by `related_project`).
- **Goals / Timeline:** progress-by-area + goal cards; monthly activity + merged feed.
- Tabs: Overview / Projects / Goals / Knowledge / Timeline.

## Conventions

- Every dynamic region is an element with an `id` that `app.js` writes to via `innerHTML`
  (charts build SVG DOM nodes via `svgEl`).
- Color constants live at the top of `app.js` (`AREA_COLORS`, `STATUS_COLORS`,
  `PRIO_COLORS`, `JTYPE_COLORS`) and mirror `schemas.py` allowed values.
- Event delegation: one document-level click handler dispatches `[data-action]`,
  `[data-close]`, etc.
- After any data mutation, call `refreshAll()` to re-fetch and re-render everything.
- Touch targets ≥ 48px; focus rings lime `outline: 2px solid var(--color-lime)`.
- `prefers-reduced-motion` disables animations.

## Status layer (as implemented)

Per-area health, per-project progress, and per-task planning state render as status bars /
indicators. Clicking one opens the item in an edit/detail panel. Health *rules* are NOT in
this file — see `skills/status/SKILL.md`.
