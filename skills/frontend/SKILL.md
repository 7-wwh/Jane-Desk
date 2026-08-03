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

## Design tokens (warm theme)

Defined in `styles.css` `:root`:

- Background `--paper: #FAFAF7`, surface `--linen: #F0EBE3`, sage `--sage: #E8F4E8`, lavender `--lavender: #D6CCF0`
- Accent amber `--amber: #F5A623`; text `--ink: #1C1917`, `--ink-dim`, `--ink-mute`
- Divider `--parchment: #E5DDD5`; radius `--radius-card: 20px`
- Fonts: Fraunces (display), Inter (body), DM Mono (mono) via Google Fonts

## Layout

- **Daily companion first** on Overview: 38/62 two-column (`daily-left` / `daily-right`),
  stacking to one column under 900px.
- Cards: Greeting + Today Ring, Focus, Upcoming, Day Timeline, Tasks/Intentions, Habit Streaks.
- **Insights** chart section below (heatmap, donuts, growth, tags, weekly, weekday, hex).
- Tabs: Overview / Projects / Goals / Knowledge / Timeline.

## Conventions

- Every dynamic region is an element with an `id` that `app.js` writes to via `innerHTML`
  (charts build SVG DOM nodes via `svgEl`).
- Color constants live at the top of `app.js` (`AREA_COLORS`, `STATUS_COLORS`,
  `PRIO_COLORS`, `JTYPE_COLORS`) and mirror `schemas.py` allowed values.
- Event delegation: one document-level click handler dispatches `[data-action]`,
  `[data-close]`, etc.
- After any data mutation, call `refreshAll()` to re-fetch and re-render everything.
- Touch targets ≥ 48px; focus rings amber `outline: 2px solid var(--amber)`.
- `prefers-reduced-motion` disables animations.

## Status layer (as implemented)

Per-area health, per-project progress, and per-task planning state render as status bars /
indicators. Clicking one opens the item in an edit/detail panel. Health *rules* are NOT in
this file — see `skills/status/SKILL.md`.
