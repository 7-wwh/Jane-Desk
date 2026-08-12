# CHECK BOX — Design Specification (v2 — Vibrant Light Refresh)

---

## Vision Statement

This dashboard is a **life-status dashboard**: at one glance you see what your life is actually looking like. What are you working on? What tasks are wanted, planned, and in motion? Is everything going okay — or does something need attention?

It is a *cockpit readout* — **light, breathable, and honest.** It knows what day it is. It doesn't demand anything. It just shows you your life, clearly.

**The v2 feeling.** Where v1 was a dark bunker terminal, v2 is a sunlit control room. Information density stays exactly the same — nothing is hidden, nothing is tucked away. What changes is the emotional register: confident, energetic, human. The dashboard should feel like opening the blinds on a productive morning, not like sitting in a server room. It has *warmth* without being soft. It has *color* without being noisy.

**One thing at a time.** The dashboard grows feature by feature, always keeping the whole legible. Each new feature is a layer on top of a stable, focused core.

**The package is two things, not one:**

1. **The dashboard** — a webpage backed by a local FastAPI + SQLite service (projects, goals, learnings, journal, tasks).
2. **Agent skills living inside the repository** — a main `SKILL.md` at the repo root that tells any agent what this database and webpage do, and *redirects* it to the relevant `skills/*/SKILL.md` so the agent knows which part of the project to work on.

When an agent is directed at this project, the root `SKILL.md` is the single entry point. From there it follows the redirect index to the right sub-skill.

**The aesthetic (v2 codename: *CHECK BOX DAYLIGHT*):** Warm white surfaces, vibrant amber-yellow primary accent, high contrast text on light backgrounds, data-dense, zero visual fluff. Creamy off-white backgrounds, a signature warm-yellow accent, soft card radius, and the same instrument-panel layout from v1 — but breathing air instead of neon.

Anti-patterns to avoid (now includes v1 anti-patterns):
- ❌ Dark backgrounds (gone in v2)
- ❌ Glassmorphism, blur layers
- ❌ Blue / purple / pink accents
- ❌ Mixed-case section headers (still ALL-CAPS)
- ❌ Heavy drop shadows (use subtle `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` max)
- ❌ Bounce animations or spring physics — this is a tool
- ❌ Marketing-page feel: hero images, gradient blobs, illustration art
- ❌ Washed-out pastels that make data hard to read at a glance

---

## The New Vibe (Read This Before Any Code)

Think of a **designer's notebook** crossed with an **airplane instrument panel**, both bathed in morning sun.

- **Light** — the primary background is warm white/off-white (`#F7F6F2`), not pure `#FFFFFF` (too cold). Cards lift slightly above the page but stay in the same light register — no drastic elevation changes.
- **Vibrant** — the accent is a bold amber-yellow (`#F5C200`). It reads instantly at any size. It is not lime (v1) and not orange-warning (that's still reserved for overdue state). The accent lives in: active states, the running timer, the logo, primary CTA buttons, segment highlights.
- **Warm** — inter-card separations use warm mid-tones (`#E8E4D9`) not grey borders. Text skews warm-dark (`#1A1714`) not cool-black (`#000`).
- **Airy** — padding is generous (24px inside cards, 20px gap between cards). The grid breathes.
- **Readable at a glance** — every key number (task count, session time, overdue flag) must pop at 2m reading distance. High-contrast pairings: dark text on cream, amber on white, red on cream. No faint greys carrying important information.

### Mood reference (describe in words, not images)

Imagine an app that:
- Has a creamy warm background, like a premium notebook
- Uses bold amber/yellow highlights that feel energetic, not cautionary
- Has smooth rounded cards (16px) that feel premium but not bubbly
- Shows ALL its data with zero scrolling on first glance (the cockpit promise survives)
- Feels like something you *want* to open first thing in the morning

---

## Current Screen Map

The app is a **two-tab, single-viewport dashboard**. There is one page and one tab bar. The layout is identical to v1 — only the visual treatment changes.

| Tab | Purpose |
|---|---|
| **Work** | The cockpit: Mind Map, Current Task, Tasks, Upcoming, Ideas — everything about "what am I doing" in one fixed-height screen. |
| **Settings** | Display + System preferences (clock format, timer precision, timezone, storage). |

The page never scrolls as a whole. The whole Work screen fits `100vh`.

```
┌────────────────────────────────────────────────────────────────┐
│ [✓ CHECK BOX]   Work  Settings     [date clock] [⏱ pill] [+]   │ ← Topbar (64px, sticky, white bg)
├─────────────────────────────────────────────┬──────────────────┤
│                                             │                  │
│   MIND MAP                                  │   CURRENT TASK   │
│   (pannable / zoomable tree)                │   (hero + flip   │
│    [Collapse]              ⋯                │    clock timer)  │
│                                             │                  │
│                                             │                  │
├─────────────────────────────────────────────┼──────────────────┤
│   TASKS            [Deadline|A-Z|Priority]  │  UPCOMING        │
│   (the only scrolling widget)               │  ─────────────   │
│                                             │  IDEAS  [+ New]  │
│                                             │                  │
└─────────────────────────────────────────────┴──────────────────┘
```

- Top row: Mind Map (left, `1.5fr`) + Current Task (right, `1fr`).
- Bottom row: Tasks (left, `1.5fr`) + a right rail stacking Upcoming above Ideas (`1fr`).
- Cards fill the viewport (`grid-template-rows: minmax(0,1fr) minmax(0,1fr)`, `height: calc(100vh - 64px - 2 * 30px)`, max-width `1100px`, centered).
- On narrow screens (< 720px) the grid collapses to a single column.

---

## Color System (v2 — Vibrant Light)

All tokens are replacements for v1 dark tokens. Every `--color-*` swap is a token change; no structural CSS needs rewriting.

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#F7F6F2` | Page background — warm cream, never pure white |
| `--color-surface` | `#FFFFFF` | Card / panel background — clean white lift above page |
| `--color-surface-hi` | `#F0EEE8` | Hover states, secondary card areas, zebra rows |
| `--color-border` | `#E2DDD3` | Card edges, dividers — warm mid-tone, never cool grey |
| `--color-amber` (Accent) | `#F5C200` | Brand mark, active states, running timer, CTA buttons, highlights |
| `--color-amber-deep` | `#D4A800` | Amber pressed/hover state, dark text on amber backgrounds |
| `--color-green` (Done/Good) | `#2D9F5C` | Done states, completed checkboxes, positive signals |
| `--color-red` (Warning) | `#E03E2D` | Overdue, danger — replaces v1 orange for better contrast on light bg |
| `--color-text-primary` | `#1A1714` | Primary text — warm dark, never pure black |
| `--color-text-secondary` | `#6B6460` | Card labels (ALL-CAPS), secondary text, project tags |
| `--color-text-dim` | `#A89E97` | Timestamps, captions, empty state text |
| `--color-amber-bg` | `#FFF8D6` | Amber tint surface — active card highlight, today-indicator bg |
| `--color-green-bg` | `#E8F7EE` | Done item soft background |
| `--color-red-bg` | `#FDECEA` | Overdue item soft background |

**Semantic rules (same as v1, adapted for light):**
- Amber = brand / active / running. Never "warning" — that job now belongs to Red.
- Green = positive / done / good signal.
- Red = danger / overdue / paused / error.
- These are *semantic*, never decorative.
- Priority colors: `high → --color-red`, `medium → --color-amber`, `low → --color-green`.
- The palette remains free of blue, purple, and pink.

### Why Amber not Lime?

v1's lime (`#AAEB47`) is designed for maximum pop on dark backgrounds. On light backgrounds it reads as sickly yellow-green. The v2 amber (`#F5C200`) is the same energy — bold, instant, eye-catching — but paired naturally with warm white and cream. The brand character stays loud; the context changes.

---

## Typography

- **Face:** Inter (400/500/700/900), loaded from Google Fonts; fallback `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`. Single family — weight carries the hierarchy.
- **Flip clock** and numeric timers use `"Courier New", monospace` with `font-variant-numeric: tabular-nums`.
- **Color shift:** all primary text uses `--color-text-primary` (#1A1714); muted text uses `--color-text-secondary` (#6B6460). Amber replaces lime on active/highlight text.

| Token | Size | Weight | Transform | Spacing | Usage |
|---|---|---|---|---|---|
| Brand | 15px | 900 | UPPERCASE | +0.08em | `CHECK BOX` wordmark |
| Card label | 13px | 700 | UPPERCASE | +0.08em | Card section labels |
| Hero title | 26px | 700 | none | 0 | Current Task title (22px on small screens) |
| Nav / pill | 12–13px | 500 | none | 0 | Tabs, segmented buttons |
| Task row | 14px | 500/700 | none | 0 | Task titles, project names |
| Caption / meta | 10–12px | 400–700 | UPPERCASE (labels) | +0.02–0.08em | Due labels, project tags, counts, chips |
| Metric sublabel | 11–12px | 400 | none | 0 | Timer pill, session rows |

---

## Layout Architecture

### Topbar (64px, sticky)

**Background:** `--color-surface` (`#FFFFFF`) with a bottom border `1px solid --color-border`. No shadow — the border alone signals elevation.

Left → right:

1. **Brand mark** — 26px amber rounded box (`border-radius: 7px`, `background: --color-amber`) containing a dark check SVG (color: `--color-text-primary`), next to the `CHECK BOX` wordmark in `--color-text-primary`.
2. **Tab nav** — pill buttons `Work` / `Settings`. Active tab: `background: --color-amber-bg`, `border: 1px solid --color-amber`, text `--color-text-primary`, weight 700. Inactive: text `--color-text-secondary`, no border. Tabs use `border-radius: 999px`.
3. **Right cluster** (`margin-left: auto`):
   - **Clock** — a small amber dot + date string ("Tuesday, Aug 11 - 2026"), updated every 60s. Dot color: `--color-amber`.
   - **Timer pill** — hidden when no session is running; otherwise an amber-bordered pill with a pulsing amber dot, task name (truncated), separator, and a live duration. Hover switches to rolling seconds. `background: --color-amber-bg`, `border: 1px solid --color-amber`.
   - **`+` Add button** — 34px amber-filled circle (`background: --color-amber`), dark `+` icon. Opens a small dropdown menu (Project / Task / Learning / Goal / Journal). Clicking an item opens the Quick-Add modal pre-typed.

### Main / panels

`main` is centered, `max-width: 1200px`, padding `30px`. Each tab panel toggles `display: block` + a `fade + translateY(6px)` entrance (200ms ease-out). Background of page: `--color-bg`.

### Work screen

Fixed-height CSS grid, `gap: 20px` (slightly more generous than v1's 16px for the airier feel):

- Row 1: **Mind Map** (col 1) · **Current Task** (col 2)
- Row 2: **Tasks** (col 1) · **Upcoming + Ideas** stacked (col 2)

### Card shell (shared by all widgets)

```
background: --color-surface         (#FFFFFF)
border: 1px solid --color-border    (#E2DDD3)
border-radius: 16px
padding: 24px
box-shadow: 0 1px 4px rgba(26,23,20,0.06)   /* only allowed shadow — very subtle */
```

**Card header:** flex row, label (`ALL-CAPS`, 13px, 700, `--color-text-secondary`) left, count/action right, `14px` bottom margin.

**No dark shadows. No gradient fills. No glass blur.** The card pops from the page via the single subtle shadow and the white-vs-cream contrast alone.

### Responsive

- ≤ 720px: Work grid becomes one column (`height: auto`), mind map fixed at `420px`, hero title shrinks to 22px.
- ≤ 640px: page/topbar padding reduces, topnav scrolls horizontally, `.clock` is hidden, settings rows stack, segmented controls go full-width.

---

## The Widgets

Every widget is one folder under `static/widgets/<name>/` containing its own `index.html` (the card markup), `widget.css`, and `widget.js`. At boot, `App.boot()` fetches each `index.html` and injects it into a `<div class="widget-part" data-part="<name>">` placeholder, then binds that widget's handlers and renders everything. Shared design-system styles live in `static/core.css`.

| Widget | Folder | DOM container | Render function |
|---|---|---|---|
| Mind Map | `widgets/mind-map/` | `#work-tree` | `renderMindMap()` |
| Current Task | `widgets/current-task/` | `#work-current` | `renderCurrent()` |
| Tasks | `widgets/tasks/` | `#work-projects` | `renderProjectsWork()` |
| Upcoming | `widgets/upcoming/` | `#work-upcoming` | `renderUpcomingWork()` |
| Ideas | `widgets/ideas/` | `#work-ideas` | `renderIdeas()` |
| Settings | `widgets/settings/` | — (two cards) | `renderSettings()` |
| Quick-Add modal | `widgets/quick-add/` | `#modal-backdrop` | `renderFields()` / `buildPayload()` |
| Sessions modal | `widgets/sessions/` | `#sessions-backdrop` | `openSessions()` |

---

### 1. Mind Map (`#work-tree`) — the signature element

The centerpiece. The project/task hierarchy rendered as a hand-rolled SVG tree that behaves **like a PDF viewport**: drag to pan, wheel to zoom, double-click to reset.

**v2 visual treatment:**
- Node pills: `background: --color-surface`, `border: 1.5px solid --color-border`, `border-radius: 999px`, `padding: 8px 14px`. Text: `--color-text-primary`.
- Hover: `border-color: --color-amber`.
- **Running task glow:** amber halo pulse (`box-shadow: 0 0 0 3px rgba(245,194,0,0.35)`, animated). The node also gets `border-color: --color-amber`, text weight 700.
- `st-done` nodes: `background: --color-green-bg`, `border-color: --color-green`, text `--color-green`.
- `st-paused` / `st-backlog`: border `--color-border`, text `--color-text-dim`.
- `st-in_progress`: `border-color: --color-amber`, text `--color-text-primary` weight 700.
- SVG connector lines: `stroke: --color-border` (`#E2DDD3`), `stroke-width: 1.5px`.
- Root node: `background: --color-amber`, text `--color-text-primary` weight 900.
- Branch nodes: `background: --color-amber-bg`, `border-color: --color-amber`, text `--color-amber-deep` weight 700.

**Behavior:** identical to v1 — drag-pan, wheel-zoom (0.25×–3×), double-click reset, collapse/expand button, node tap toggles.

---

### 2. Current Task (`#work-current`) — the hero

The single task you should be working on right now.

**v2 visual treatment:**
- When a task is running: the card gets a left border accent — `border-left: 3px solid --color-amber` — and the card's inner top area shows a very faint `--color-amber-bg` tint (`background: linear-gradient(to bottom, --color-amber-bg 0 48px, --color-surface 48px 100%)`). This is the *only* allowed gradient in the entire design — it signals "active" without becoming decorative.
- **Flip clock digits:** `color: --color-amber` (was lime). Dark digits on white card background.
- **Priority chip:** amber = `--color-amber-bg` background + `--color-amber-deep` text; high = `--color-red-bg` + `--color-red`; low = `--color-green-bg` + `--color-green`.
- **Start button (`.btn-lure`):** `background: --color-amber`, `color: --color-text-primary` weight 700, `border-radius: 999px`.
- **Stop button:** `background: --color-red-bg`, `border: 1px solid --color-red`, icon `--color-red`.
- **Done button:** `background: --color-green`, `color: #fff`.
- Overdue hint line: `color: --color-red`.
- Empty state text: `--color-text-dim`.

---

### 3. Tasks (`#work-projects`) — the working list

Every open task, flattened into rows.

**v2 visual treatment:**
- Priority dot: 8px circle. High → `--color-red`, Medium → `--color-amber`, Low → `--color-green`.
- Task title: `--color-text-primary`, weight 500. Project tag: `--color-text-secondary`, 11px uppercase.
- Due label: "due today" → `--color-amber` weight 700; "N d overdue" → `--color-red` weight 700; "due tomorrow" → `--color-text-secondary`; "due in N d" → `--color-text-dim`.
- Time pill: `background: --color-surface-hi`, `border: 1px solid --color-border`. Running → `background: --color-amber-bg`, `border-color: --color-amber`, amber pulsing dot.
- **Start button:** amber outline pill (`border: 1px solid --color-amber`, `color: --color-amber-deep`, bg transparent). Hover: fill amber.
- **Done checkbox:** 20px rounded square. Checked: `background: --color-green`, white check. Unchecked: `border: 1.5px solid --color-border`.
- Segmented control (Deadline|A-Z|Priority): active segment `background: --color-amber`, `color: --color-text-primary` weight 700; inactive `--color-text-secondary`.
- Hover row state: `background: --color-surface-hi`.

**This is the only scrolling widget.** Scrollbar hidden (`scrollbar-width: none`).

---

### 4. Upcoming (`#work-upcoming`)

Non-done tasks queued after the current. Same row component as Tasks but never scrolls. Empty state: "Nothing queued — all clear."

**v2:** same treatment as Tasks rows. No changes to data or behavior.

---

### 5. Ideas (`#work-ideas`)

Backlog projects. Each row shows project title + top task. **Start** button promotes the idea.

**v2:** rows use `--color-surface-hi` background (`#F0EEE8`) subtly distinguishing them from Upcoming. The `+ New` header button: amber text, `border: 1px solid --color-amber`, `border-radius: 999px`.

---

### 6. Settings (`#panel-settings`)

Two cards: **Display** (clock format, timer precision) and **System** (timezone, storage). Stored in `localStorage`.

**v2:** segmented controls use the same amber active-state treatment as Tasks sort control. Read-only values use `--color-text-secondary`.

---

### 7. Quick-Add modal

A single modal for creating any entity or editing tasks.

**v2 visual treatment:**
- Backdrop: `rgba(26,23,20,0.35)` (warm dark tint, not cold grey).
- Modal panel: `background: --color-surface`, `border-radius: 20px`, `padding: 32px`, `box-shadow: 0 8px 32px rgba(26,23,20,0.14)`.
- Type selector tabs: amber active-state (same as topbar tabs).
- Inputs: `background: --color-bg`, `border: 1.5px solid --color-border`, `border-radius: 8px`. Focus: `border-color: --color-amber`, `outline: 2px solid rgba(245,194,0,0.25)`.
- Submit button: `background: --color-amber`, `color: --color-text-primary`, weight 700.
- Cancel/close: `--color-text-secondary`.

---

### 8. Sessions modal

Opened from any ⏱ time pill. Shows session history.

**v2:** same structure. Running session row: `background: --color-amber-bg`. Delete buttons: red text, no fill. The "now" duration uses an amber pulsing dot.

---

### 9. Topbar timer pill + ticker

A global 1-second ticker drives every live readout. The topbar pill uses `background: --color-amber-bg`, `border: 1.5px solid --color-amber`, amber pulsing dot, task name in `--color-text-primary`.

---

## Shared Components (v2)

- **Buttons**
  - `.btn` (default): `background: --color-surface-hi`, `border: 1px solid --color-border`, `color: --color-text-primary`, `border-radius: 999px`.
  - `.btn-primary`: `background: --color-amber`, `color: --color-text-primary`, weight 700. Hover: `background: --color-amber-deep`.
  - `.btn-danger`: `border: 1px solid --color-red`, `color: --color-red`, bg transparent. Hover: `background: --color-red-bg`.
  - `.btn-done`: `background: --color-green`, `color: #fff`.
  - `.btn-lure` (hero CTA): larger amber button, 13px weight 700 uppercase. Same amber fill as `.btn-primary` but `padding: 10px 22px`.
  - `.btn-icon`: round, `background: --color-surface-hi`, `border: 1px solid --color-border`. Hover: `border-color: --color-amber`.
  - `.btn-sm`: smaller padding variant.

- **Segmented control** — `.segmented` with `.seg-btn` pills. Active: `background: --color-amber`, text `--color-text-primary` weight 700. Inactive: `color: --color-text-secondary`. Container: `background: --color-surface-hi`, `border-radius: 999px`.

- **Checkbox** — 20px, `border-radius: 6px`. Done: amber fill with dark check. Undone: `border: 1.5px solid --color-border`.
  *Wait — use **green** for done checkboxes.* Done = positive signal = green, not amber. Amber = active/running. This distinction is important: a checked task is `--color-green` fill.

- **Chips** — `.task-prio`: tinted border + text per priority. `.task-chip`: `background: --color-surface-hi`, border `--color-border`.

- **Empty states** — `--color-text-dim`, same voice ("Nothing queued — all clear.").

- **Toast** — `background: --color-text-primary` (warm dark), `color: --color-surface`, `border-radius: 999px`. Success variant: `border-left: 3px solid --color-green`. Error: `border-left: 3px solid --color-red`. Auto-dismiss 3.2s.

- **Mind-map neuron pulses (`.mind-pulse`)**: now amber-colored SVG circles.

---

## Wireframe — Annotated Layout

```
╔══════════════════════════════════════════════════════════════════╗
║  [▣ CHECK BOX]  [Work ◆] [Settings]    ● Tue Aug 11·2026  [⏱]  [+]  ║
║  (white topbar, 1px warm-border bottom)                          ║
╠════════════════════════════════════╦═════════════════════════════╣
║  CARD: MIND MAP                    ║  CARD: CURRENT TASK         ║
║  ┌──────────────────────────────┐  ║  ┌─────────────────────────┐║
║  │ [WORK root amber pill]       │  ║  │ ▸ CURRENT TASK          ││
║  │   └─[Branch amber-bg pill]   │  ║  │                         ││
║  │       ├─[Project node]       │  ║  │  Deep Work Session      ││
║  │       │   └─[Task node]*glow │  ║  │  ● HIGH                 ││
║  │       └─[Project node]       │  ║  │                         ││
║  │           └─[Task node]      │  ║  │  [FLIP CLOCK — amber]   ││
║  │                              │  ║  │   00 : 42 : 17          ││
║  │  [Collapse pill]        [⋯]  │  ║  │                         ││
║  └──────────────────────────────┘  ║  │  ⏱ 3 sessions · 1h 20m ││
║                                    ║  │                         ││
║                                    ║  │  [▶ START] [✓ DONE]     ││
║                                    ║  └─────────────────────────┘║
╠════════════════════════════════════╬═════════════════════════════╣
║  CARD: TASKS   [Deadline|A-Z|Prio] ║  CARD: UPCOMING             ║
║  ┌──────────────────────────────┐  ║  ┌─────────────────────────┐║
║  │ ● Task A    due today        │  ║  │  ● Task C  due in 2d    ││
║  │   ProjectX tag  ⏱ 2·45m  ▶  │  ║  │  ● Task D  tomorrow     ││
║  │                              │  ║  └─────────────────────────┘║
║  │ ● Task B    3d overdue       │  ║                             ║
║  │   ProjectY tag  ⏱ 1·20m  ▶  │  ║  CARD: IDEAS  [+ New]       ║
║  │  ─────────────────────────── │  ║  ┌─────────────────────────┐║
║  │ ○ Task C    due tomorrow     │  ║  │  💡 Idea A  → top task  ││
║  └──────────────────────────────┘  ║  │  💡 Idea B  → top task  ││
║                                    ║  └─────────────────────────┘║
╚════════════════════════════════════╩═════════════════════════════╝
```

**Color annotation:**
- `[▣ CHECK BOX]` — amber box logo mark + dark wordmark
- `[Work ◆]` — active tab: amber-bg pill
- `● Tue Aug 11` — amber dot
- `[+]` — amber filled circle
- Root node — amber background, dark text
- Branch nodes — amber-bg, amber-deep text
- `*glow` running task — amber halo shadow
- `[FLIP CLOCK — amber]` — amber digits on white card
- `● HIGH` priority — red chip
- `due today` — amber text
- `3d overdue` — red text
- Checkboxes — green when checked
- Active segment (Deadline) — amber fill

---

## Spacing System

Base unit: `8px`. Same as v1, with one increase: gutter is now 20px.

```
--space-card-pad:  24px   (card internal padding — up from 22px)
--space-gutter:    20px   (between-card gaps — up from 16px)
--space-outer:     30px   (page outer padding — unchanged)
```

- Topbar: 64px tall, sticky. Cards: `16px` radius. Pills/buttons/nav: `999px`. Checkbox: `6px`.
- Work grid: `1.5fr 1fr`, gap 20px.
- Mind map geometry: `230px` per depth level, `46px` per row (unchanged).
- Minimum touch target: ~40px.

---

## Interaction Design

- **Hover:** cards shift bg to `--color-surface-hi`. Pill buttons brighten. Node border goes amber. No scale transforms — restrained.
- **Checkbox tap:** instant green fill + white check. No bounce.
- **Mind map:** drag to pan, wheel-zoom 0.25×–3×, double-click reset. Node press toggles expand/collapse. Running task pulses amber.
- **Widget scroll policy.** Only Tasks list scrolls. Every other widget is non-scrolling. The mind map moves via drag-pan.
- **No scroll indicators.** Scrollbars hidden globally.
- **Task editing.** Every task row and Current Task hero expose an Edit action → Quick-Add modal pre-filled → saves via `PUT /api/tasks/{id}`.
- **Keyboard:** `Escape` closes sessions modal → quick-add modal → `+` menu.
- **Motion:** panel entrance `fade + translate-Y(6px)` 200ms ease-out; nodes pop in 300ms; flip clock 560ms; timer dot pulse 1.2s. No spring physics.
- **`prefers-reduced-motion`:** all animations/transitions disabled.
- **Loading:** data loads async into held space after `refreshAll()`; topbar clock renders immediately from client time.

---

## Data Flow

`core.js` keeps a single `state` object: `work`, `projects`, `activeSession`, `tree`, `mindRoot`, `mindPan`/`mindZoom`, `editId`, `workSort`, `tab`, `settings`.

- Every fetch **writes into `state`**; the matching `render*()` **reads `state`** and rewrites the DOM. *Data lives in `state`; the DOM is just its reflection.*
- `refreshAll()` reloads `/api/work`, `/api/projects`, `/api/sessions/active`, `/api/tree` in parallel, resets mind-map root, then re-renders every widget.
- Mutations go through **data-action buttons** routed by one delegated `document` click handler (`bindCore`).

---

## Accessibility

- All body text meets WCAG AA contrast: `#1A1714` on `#FFFFFF` ≈ 19:1; `#6B6460` on `#FFFFFF` ≈ 5.1:1; amber (`#F5C200`) is not used for text on white (too low contrast) — only as a background or border, with dark text on top.
- `prefers-reduced-motion` fully respected.
- Focus rings: `outline: 2px solid --color-amber`, `outline-offset: 2px`.
- Icon-only buttons carry `aria-label`/`title`.
- Modals use `role="dialog"` + `aria-modal`; toast is `role="status"` + `aria-live="polite"`.
- Status never conveyed by color alone — overdue/due/today states include text labels.

**Important amber accessibility rule:** Never place amber-colored text on a white background. Always use `--color-amber-deep` (`#D4A800`) if you must put amber text on light, or put dark text on an amber-filled surface. The `#F5C200` amber is backgrounds and borders only.

---

## Status Layer

- **Per-task state:** `wanted → planned → in_progress → done`. Priority dots (red/amber/green), due labels (overdue → red, today → amber, upcoming → dim), mind-map node tinting.
- **Per-project status:** `active / backlog / done / paused`. Mind map tints nodes, shows open tasks, collapses done projects.
- **Time-tracking status:** running task glows amber in mind map, shows live flip-clock in hero, timer pill pulses.

**Health rules are external** (`skills/status/SKILL.md`). The dashboard consumes them; it does not hard-code them.

---

## CSS Token Migration from v1

For any developer porting from the dark v1 build, here is the direct token swap table:

| v1 Token | v1 Value | v2 Token | v2 Value |
|---|---|---|---|
| `--color-bg` | `#111111` | `--color-bg` | `#F7F6F2` |
| `--color-surface` | `#1C1C1C` | `--color-surface` | `#FFFFFF` |
| `--color-surface-hi` | `#242424` | `--color-surface-hi` | `#F0EEE8` |
| `--color-border` | `#2E2E2E` | `--color-border` | `#E2DDD3` |
| `--color-lime` | `#AAEB47` | `--color-amber` | `#F5C200` |
| `--color-green` | `#6DC533` | `--color-green` | `#2D9F5C` |
| `--color-orange` | `#F5A623` | `--color-red` | `#E03E2D` |
| `--color-text-primary` | `#E8E8E8` | `--color-text-primary` | `#1A1714` |
| `--color-text-muted` | `#9B9B9B` | `--color-text-secondary` | `#6B6460` |
| `--color-text-dim` | `#5C5C5C` | `--color-text-dim` | `#A89E97` |

New in v2 (no v1 equivalent):
- `--color-amber-deep: #D4A800`
- `--color-amber-bg: #FFF8D6`
- `--color-green-bg: #E8F7EE`
- `--color-red-bg: #FDECEA`

---

## Agent Skills

Agent skills are shipped inside this repository so any agent pointed at the project can orient itself and start contributing.

```
SKILL.md                        # Entry point: what the DB + webpage do, redirect index
skills/
  status/SKILL.md               # Health/status rules
  task-planning/SKILL.md        # Task feature: model, API, UI
  backend/SKILL.md              # Data model + API conventions
  frontend/SKILL.md             # Static app structure + rendering conventions
  health/SKILL.md               # Future: nutrition/health integration (placeholder)
```

---

## Implementation Notes

**Stack:** Vanilla HTML/CSS/JS served by FastAPI's StaticFiles. No build step. No charting library — mind map is hand-rolled SVG.

**Frontend file layout:**

```
static/
  index.html              ← thin assembly: shell, topbar, layout wrappers
  core.css                ← tokens (v2), reset, shell, topbar, cards, shared components
  core.js                 ← state, helpers, data loading, global dispatch, App registry + boot()
  main.js                 ← App.boot()
  widgets/<name>/         ← one folder per widget: index.html + widget.css + widget.js
```

**Boot sequence:** `main.js` → `App.boot()` → `bindCore()` → `injectParts()` → `renderSettings()` → `updateClock()` → `startTicker()` → `refreshAll()`.

**Script order:** `core.js` first, then each `widget.js`, then `main.js`. All functions are global (no ES modules).

**CSS tokens:** tokenized in `:root`. The v2 theme is a token swap — structural CSS is unchanged.

**First paint ≤ ~200ms:** topbar clock renders from client-side time; widget markup fetched and injected async.

**Testing:** `node --check` each JS file; DOM-stub harness can execute `App.boot()` headlessly; `bin/run_api_evals.py` guards the backend.

---

## What This Is Not

- Not a habit-tracking app.
- Not a calendar replacement.
- Not a corporate analytics tool. The instrument-panel layout is borrowed for density and legibility; the metrics are the user's own life.
- Not customizable-everything. Structure is fixed; content is personal.
- Not a lock-in. Health APIs come later and plug in behind the status layer.

---

## The One Rule (Updated for v2)

If it would look at home in a corporate SaaS demo, remove it. Every element earns its place by being **dense, legible, and honest** about the user's actual life — now in daylight instead of a bunker, but with exactly the same standards. Vibrant does not mean decorative. Light does not mean empty.
