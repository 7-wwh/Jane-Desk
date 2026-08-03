# CHECK BOX — Design Specification

---

## Vision Statement

This dashboard is a **life-status dashboard**: at one glance you see what your life is actually looking like. What are you working on? What tasks are wanted, planned, and in motion? Is everything going okay — or does something need attention? It is a *cockpit readout* — dark, dense, and honest. It knows what day it is. It doesn't demand anything. It just shows you your life, clearly.

**One thing at a time.** The dashboard grows feature by feature, always keeping the whole legible. Today that means task planning and a projects timeline; tomorrow it may mean health and nutrition logging wired to external health APIs. Each new feature is a layer on top of a stable, focused core.

**The package is two things, not one:**

1. **The dashboard** — a webpage backed by a local FastAPI + SQLite service (projects, goals, learnings, journal, tasks).
2. **Agent skills living inside the repository** — a main `SKILL.md` at the repo root that tells any agent what this database and webpage do, and *redirects* it to per-part `SKILL.md` files (`skills/<part>/SKILL.md`) so the agent knows which specific part of the project to work on.

When an agent is directed at this project, the root `SKILL.md` is the single entry point. From there it follows the redirect index to the right sub-skill.

**The aesthetic** is extracted from a reference analytics dashboard (working title *CHECK BOX*): industrial dark mode, high contrast, data-dense, zero visual fluff. Near-black backgrounds, semantic green/orange only, all-caps card labels, stadium-pill shapes, and a signature Projects Timeline Gantt.

Anti-patterns to avoid: glassmorphism, gradients, blue/purple/pink accents, mixed-case section headers, drop shadows, bounce animations, anything that reads as a marketing page. Status indicators must read as human, not as corporate KPI chrome.

---

## Color System

| Role | Name | Hex | Use |
|---|---|---|---|
| Background | Void | `#111111` | Page background — true near-black |
| Surface | Surface | `#1C1C1C` | Card / panel background |
| Surface Raised | Surface Hi | `#242424` | Hover states, elevated elements |
| Border | Border | `#2E2E2E` | Card edges, dividers |
| Accent | Lime | `#AAEB47` | Brand mark, active sidebar icon, key highlights |
| Positive | Signal Green | `#6DC533` | Up metrics, done states, Gantt bars (ok) |
| Negative / Warning | Signal Orange | `#F5A623` | Down metrics, overdue Gantt bars, danger |
| Text | White Soft | `#E8E8E8` | Primary text, card headlines |
| Text Muted | White Dim | `#9B9B9B` | Labels, secondary text, axis ticks |
| Text Faint | White Ghost | `#5C5C5C` | Timestamps, captions, empty states |

**Key rule:** Orange = warning/down. Green = up. These are *semantic*, never decorative. The palette is deliberately free of blue, purple, and pink.

---

## Typography

### Typefaces

| Role | Face | Notes |
|---|---|---|
| Everything | Inter (400/500/700/900) | Single family. Weights carry the hierarchy. |
| Fallback | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | |

### Type Scale

| Token | Size | Weight | Transform | Spacing | Usage |
|---|---|---|---|---|---|
| Brand | 15px | 900 | UPPERCASE | +0.08em | `CHECK BOX` wordmark |
| Page title | 16px | 700 | UPPERCASE | +0.04em | Subheader page title |
| Card label | 13px | 700 | UPPERCASE | +0.08em | Card section labels |
| Metric value | 38px | 700 | none | -0.02em | KPI numbers |
| Metric sublabel | 12px | 400 | none | 0 | Metric captions |
| Nav / pill | 13px | 500 | none | 0 | Tabs, filter pills |
| Caption | 10–11px | 400 | none | +0.02em | Axis ticks, timestamps |

---

## Layout Architecture

### Desktop (≥ 1100px) — Icon Sidebar + Topbar + Two-Column Main

```
┌──┬───────────────────────────────────────────────────────────────┐
│  │  [CHECK BOX]  [Tab][Tab][Tab][Tab][Tab]      [clock] [+]      │  ← Topbar (64px)
│  ├───────────────────────────────────────────────────────────────┤
│  │  OVERVIEW                                  [Last 30 days ▾]   │  ← Subheader (56px)
│  ├────────────────────────────────────────────┬──────────────────┤
│🤍│  Left column (~57%)                       │  Right (~43%)     │
│🗓│  GREETING + TODAY RING (strip)             │  DAILY BRIEF      │
│💎│  [PROJECTS metric] [KNOWLEDGE metric]      │  PROJECTS TIMELINE│
│⚙│  TASKS / INTENTIONS                        │  (Gantt)          │
│  │  HABIT STREAKS                            │  FOCUS            │
│  │  INSIGHTS grid (heatmap, donuts, bars)    │  TODAY            │
│  │                                           │  UPCOMING         │
│  └────────────────────────────────────────────┴──────────────────┘
```

- **Sidebar:** 64px icon-only, left-anchored, vertically centered icon stack. Active icon = lime background. Hidden on mobile (< 860px).
- **Topbar:** 64px. Brand mark (lime box + check) + wordmark, pill nav tabs, clock, `+` add button.
- **Subheader:** 56px. Uppercase page title on the left; contextual filters on the right (growth range on Overview, status pills on Projects).
- **Main:** two columns — left ~57% cards grid, right ~43% Daily Brief + Projects Timeline Gantt (sticky, scrollable within the viewport).

### Projects tab

The Project Tree panel sits at the top: one row per project with a status dot, name + status/priority meta, a task progress bar (lime, or orange when an open task is overdue), and a done/total counter. Below it, By-Status/By-Priority charts, then the project cards.

### Mobile (< 860px)

Single column stack. Sidebar hides; topbar tabs scroll horizontally. Metric cards stack, Gantt drops below Insights.

**Navigation:** the topbar pills and the sidebar icons are the same tab system — clicking either switches the panel.

---

## Signature Element — The Projects Timeline Gantt

The single most memorable piece of the dashboard. Stadium-pill bars floating on a dotted vertical grid, each bar representing a project's working span over the last 30 days.

**Visual treatment:**
- Y-axis (left of each row): project name (truncated, 12px) + start date in `DD.MM` format
- X-axis: numeric 0–30 scale at the bottom, ticks every 5
- Bars: `border-radius: 999px`, 18px tall, green (`#6DC533`) when healthy, orange (`#F5A623`) when the project has an overdue open task
- Inside each bar: a circular project-initial dot (13px) on the left, and the task count on the right — iconography embedded in the data element
- Grid: dotted vertical lines every day, no filled grid rows

**Data mapping:** each non-done project spans from its earliest task `created_at` (or project `created_at`) to its latest task `created_at`/`due_date`. The bar is clamped to the trailing 30-day window. Orange when any open task has a `due_date` before today.

---

## Card System

All cards share the same foundation: `background: #1C1C1C`, `border: 1px solid #2E2E2E`, `border-radius: 16px`, padding 22px. **No drop shadows** — separation is achieved purely through color contrast against `#111111`. Card headers are ALL-CAPS 13px labels with a `⋯` overflow affordance on the right.

### Card Types

**1. Greeting + Today Ring Card** (Left, top, horizontal strip)
A small 64px day-ring showing progress through the day (lime arc on a `#2E2E2E` track), greeting line ("Good morning") + date beside it, and a one-line daily affirmation right-aligned. Compact, not dominant.

**2. Metric Cards** (Left, top row, two side-by-side)
- **PROJECTS:** active project count (38px), delta badge (▲ green / ▼ orange, % vs previous month), "N finished this month" note, 14-day sparkline of project creation.
- **KNOWLEDGE:** learnings this week, delta vs last week, total learnings, 14-day daily sparkline.
Each metric has: colored triangle indicator, large bold number, small muted label, sparkline beneath (thin colored line on dark bg, no axes).

**3. Tasks / Intentions Card** (Left, middle)
Full-width rows with ≥ 44px tap targets. Checkbox left (lime when checked), title center, project label under the title (10px, uppercase), and a meta cluster on the right: priority chip (tinted to its color), status chip, and due-date (orange when overdue, lime when due today). Checked items get a strikethrough and dim.

**4. Habit Streaks Card** (Left, middle)
Goal-derived habit rows: colored initial badge, goal name, 7-day dot row (green dot = activity that day, `#242424` = missed).

**5. Insights** (Left, lower)
A single card wrapping the analytics grid: activity heatmap, project status donut, cumulative growth line, journal types donut, goals-by-area bars, top tags, weekly summary, daily activity bars, and life-area hexagons. All dark-themed SVG, no chart library.

**6. Daily Brief** (Right, top)
The skill's task-logic surfaced live. Sections separated by hairline rules: **Overdue** (open tasks past `due_date`, orange), **Due this week** (0–7 days), **Top priorities** (top 5 open tasks by priority then due date, numbered), **Focus today** (lime callout of the single most urgent item), **Recent learnings** (last 7 days, treated as knowledge atoms). Priority dots tinted to their color.

**7. Projects Timeline Gantt** (Right, below Daily Brief) — see signature element above.

**8. Focus Card** (Right) — the single highest-priority non-done task, with its checkbox.

**9. Today Card** (Right) — today's journal + learning entries on a compact spine.

**10. Upcoming Card** (Right) — next three dated projects.

**11. Project Tree** (Projects tab, top) — one row per project: status dot + name + status/priority meta, a task progress bar (`done/total`), orange when an open task is overdue, and a done/total counter.

**12. Atom Ledger** (Knowledge tab) — learnings grouped by `related_project` into an atom ledger: each row shows date, title, content, and tags, with a per-group header + count. Mirrors the skill's knowledge-atom concept. Top Tags and Learnings-over-Time charts sit above it.

---

## Component Patterns

- **Metric tiles:** two metrics side-by-side with colored triangle indicator (▲ green up, ▼ orange down), large bold number, small muted label, sparkline beneath.
- **Pills everywhere:** nav tabs, filter pills, buttons, badges, Gantt bars all use `border-radius: 999px`.
- **Avatar / icon dots:** circular project-initial dots inside Gantt bars.
- **Empty states:** written in the UI's own voice — "No active projects to chart.", "Nothing on the timeline yet — a clear day." Not "No data found."

---

## Interaction Design

- **Hover:** cards and pills shift to `#242424` background. No scale, no shadows — restrained.
- **Checkbox tap:** instant lime fill + checkmark. No bounce.
- **Motion:** card entrance `fade + translate-Y(6px)`, 200ms ease-out. Metric numbers static (no count-up). Gantt bars render in place. No spring physics — this is a tool, not a marketing page.
- **`prefers-reduced-motion`:** all animations/transitions disabled.
- **Loading:** initial paint of greeting + ring is client-side (no API call). Data loads async into held space.

---

## Spacing System

Base unit: `8px`.

```
--space-card-pad:  22px   (card internal padding)
--space-gutter:    16px   (between-card gaps)
--space-outer:     30px   (page outer padding)
```

- Sidebar: 64px wide.
- Topbar: 64px tall. Subheader: 56px tall.
- Border radius: cards `16px`, pills/buttons/nav `999px`, checkbox `6px`, dots `50%`.

Minimum touch target: ~40px for dense interactive rows (task rows, nav).

---

## Accessibility

- All body text meets WCAG AA contrast (e.g. `#E8E8E8` on `#1C1C1C` ≈ 13:1; `#9B9B9B` on `#1C1C1C` ≈ 5.6:1).
- `prefers-reduced-motion` fully respected.
- Focus rings visible (`.skip-link` styled, inputs get a lime `:focus` border).
- All icon SVGs carry `aria-label` or paired visible text.
- No information conveyed by color alone where it matters (Gantt bars always show text; status dots have tooltips).

---

## Status Layer

The dashboard's core promise is "is everything doing okay?" — answered through status indicators layered on top of the cockpit layout.

- **Per-area health.** One indicator per life area (career, health, family, learning, finance, other) aggregates the projects, goals, and recent activity that belong to it. Green/amber/red with a one-line reason.
- **Per-project status.** Each project shows its own progress: open vs. done tasks, priority, and whether it is overdue or on track.
- **Per-task planning state.** Tasks move through `wanted → planned → in_progress → done`. The planning view lets you mark what you *want to do* and what you *are going to do* next.
- **Click-through.** Every status bar or item opens the item in a focused edit/detail panel. The status layer is navigation, not decoration.

**Health rules are external.** The exact rules that decide "okay" vs. "needs attention" live in `skills/status/SKILL.md` (agent-readable) and may be refined independently of the UI. The dashboard consumes them; it does not hard-code them.

---

## Agent Skills

Agent skills are shipped inside this repository so any agent pointed at the project can orient itself and start contributing.

```
SKILL.md                        # Entry point: what the DB + webpage do, redirect index
skills/
  status/SKILL.md               # Health/status rules (is everything doing okay?)
  task-planning/SKILL.md        # The task feature: model, API, UI
  backend/SKILL.md              # Data model + API conventions
  frontend/SKILL.md             # Static app structure + rendering conventions
  health/SKILL.md               # Future: nutrition/health integration (placeholder)
```

- The root `SKILL.md` is the single entry point. It describes the project and *redirects* to the sub-skill relevant to a given task.
- Each sub-skill carries YAML frontmatter (`name:`, `description:`) so agent tooling can index it.
- `AGENTS.md` stays as the short "how to write entries via the API" quick-start; the skills are the deep reference.

---

## What This Is Not

To keep the build honest:

- Not a habit-tracking app. Habits are one small card, not the center.
- Not a calendar replacement. The timeline shows today only. Navigating forward/back is secondary.
- Not a corporate analytics tool. The dark KPI aesthetic is *borrowed* for density and legibility, but the metrics are the user's own life — the status layer is about acting, not vanity numbers.
- Not customizable-everything. The structure is fixed; content is personal. Fewer choices = less friction every morning.
- Not a lock-in. Health APIs come later and plug in behind the status layer; nothing about the current core depends on them.

---

## Implementation Notes

**Stack:** Vanilla HTML/CSS/JS served by FastAPI's StaticFiles. No build step, no charting library — all charts are hand-rolled SVG (`svgEl`, `lineChart`, `donutSVG`, `sparkline` in `app.js`).

**Fonts:** Inter from Google Fonts (400–900).

**Data layer:** REST API. The UI never hard-codes content strings. Everything renders from `state` populated by `/api/*`.

**First screen ≤ 200ms:** greeting and ring render from client-side time; data loads async into held space.

**CSS tokens:** the design is tokenized in `:root` (`--color-*`, `--radius-*`, `--font-base`, `--space-*`). Any future theme (including returning to a warm light mode) is a token swap, not a rewrite.

---

## The One Rule

If it would look at home in a corporate SaaS demo, remove it. Every element earns its place by being dense, legible, and honest about the user's actual life. Usually all three.
