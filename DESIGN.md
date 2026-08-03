# Personal Dashboard — Design Specification

---

## Vision Statement

This dashboard is a *daily companion*, not a productivity tool. It should feel like opening a well-loved planner — warm, unhurried, already on your side. It knows what day it is. It doesn't demand anything. It just shows you your life, clearly.

Inspirations: Duolingo's warmth and celebration of small moments, Notion Calendar's clean spatial reasoning, Day One's emotional tone, Headspace's purposeful simplicity.

Anti-patterns to avoid: dark glass morphism with neon accents, corporate KPI dashboards, cluttered widget grids, anything that feels like a SaaS tool.

---

## Color System

| Role | Name | Hex | Use |
|---|---|---|---|
| Base | Warm White | `#FAFAF7` | Page background |
| Surface | Linen | `#F0EBE3` | Card backgrounds |
| Surface Alt | Sage Mint | `#E8F4E8` | Calm/nature cards, task tags |
| Accent | Amber | `#F5A623` | Primary CTAs, the Today Ring glow, highlights |
| Accent 2 | Soft Lavender | `#D6CCF0` | Events, calendar items, secondary pills |
| Text | Deep Warm Black | `#1C1917` | All primary text |
| Text Muted | Warm Grey | `#8C8580` | Timestamps, metadata, captions |
| Divider | Parchment | `#E5DDD5` | Card borders, separators |

**Palette rationale:** No cool greys. No pure white or pure black. Every surface has warmth baked in so the screen never feels clinical. Amber is the emotional center — it reads as sunrise, energy, and welcome across all ages without being alarming or childish.

---

## Typography

### Typefaces

| Role | Face | Notes |
|---|---|---|
| Display / Greeting | Fraunces (Variable Optical) | A literary serif with a soft, expressive personality. Use at large sizes only — `opsz` 144 for big greeting, `opsz` 72 for section heads. It reads as warm and human without being whimsical. |
| Body / Labels | Inter | Neutral and highly legible. Use at 15–16px for body, 13px for metadata. |
| Timestamps / Counts | DM Mono | Monospaced precision for times, event counts, and the day-ring label. Keeps data legible without feeling technical. |

### Type Scale

```
Display (greeting):   Fraunces  56px / 700  lh 1.1
Section head:         Fraunces  28px / 600  lh 1.2
Card title:           Inter     18px / 600  lh 1.3
Body:                 Inter     15px / 400  lh 1.6
Caption / Meta:       Inter     13px / 400  lh 1.5  color: Warm Grey
Timestamp:            DM Mono   12px / 400  lh 1.4  color: Warm Grey
```

---

## Signature Element — The Today Ring

The single most memorable piece of this dashboard. A circular arc sits in the greeting panel, showing how far through the current day you are (midnight-to-midnight). It is not a goal ring, not a step counter — just a gentle clock-face that anchors you in *right now*.

**Visual treatment:**
- Outer ring: `#E5DDD5` (parchment) at 6px stroke
- Progress arc: `#F5A623` (amber), rounded linecap, animated from 0 on load with a subtle ease-out
- Inside the ring: greeting text — "Good morning, WeiHeng" in Fraunces display
- Below the name: current date in DM Mono, `Monday · 3 Aug`
- Behind the arc: a soft radial amber glow (`rgba(245, 166, 35, 0.08)`) — not a drop shadow, a *sunrise blush* that bleeds into the card

**Size:** 220px diameter on desktop, 180px on mobile. Centered in the left panel.

**Animation:** On page load, the arc sweeps from the top clockwise to the current time position over 900ms (ease-out cubic). No looping animation after that — it just sits there, real and still.

---

## Layout Architecture

### Desktop (≥ 900px) — Two Column

```
┌─────────────────────────────────────────────────────┐
│  HEADER — thin, minimal. Date nav + avatar/settings  │
├───────────────────────┬─────────────────────────────┤
│                       │                             │
│   LEFT PANEL          │   RIGHT PANEL               │
│   (38% width)         │   (62% width, scrollable)   │
│                       │                             │
│  ┌─────────────────┐  │  ┌─────────────────────┐   │
│  │  TODAY RING     │  │  │  DAY TIMELINE        │   │
│  │  + Greeting     │  │  │  (chunky event cards)│   │
│  └─────────────────┘  │  └─────────────────────┘   │
│                       │                             │
│  ┌──────┐ ┌────────┐  │  ┌─────────────────────┐   │
│  │FOCUS │ │WEATHER │  │  │  TASKS / INTENTIONS  │   │
│  │TODAY │ │MOOD    │  │  │  (swipeable/tappable)│   │
│  └──────┘ └────────┘  │  └─────────────────────┘   │
│                       │                             │
│  ┌─────────────────┐  │  ┌─────────────────────┐   │
│  │  UPCOMING       │  │  │  HABIT STREAKS       │   │
│  │  (next 3 items) │  │  │  (emoji-style dots)  │   │
│  └─────────────────┘  │  └─────────────────────┘   │
│                       │                             │
└───────────────────────┴─────────────────────────────┘
```

### Mobile (< 900px) — Single Column Stack

```
┌──────────────────┐
│  TODAY RING      │
│  + Greeting      │
├──────────────────┤
│  FOCUS + WEATHER │  (side by side)
├──────────────────┤
│  DAY TIMELINE    │
├──────────────────┤
│  TASKS           │
├──────────────────┤
│  HABITS          │
└──────────────────┘
```

**No hamburger menus, no sidebar nav, no tabs.** Everything is visible on one scroll. Navigation to settings or other views happens through the avatar icon (top right) and a simple bottom sheet on mobile.

---

## Card System

All cards share the same foundational feel: `border-radius: 20px`, `background: #F0EBE3`, `box-shadow: 0 1px 3px rgba(28,25,23,0.06)`. No heavy drop shadows. Cards feel like physical tiles, not floating glass.

### Card Types

**1. Greeting + Today Ring Card** (Left, top)
Full-height left panel anchor. The ring dominates. Below it: a short, single-line affirmation or quote that rotates daily — written simply, nothing motivational-poster. Example: *"Three things are on your list today."* or *"Clear evening ahead."*

**2. Focus Card** (Left, small)
One single task, elevated. The thing that matters most today. Displayed large — task name at 18px Semi-Bold, a small colored dot for category (amber = personal, lavender = project, sage = health), and a checkbox that animates to a strikethrough on tap. Nothing else.

**3. Weather Mood Card** (Left, small)
Not a full weather widget. Just: an icon (sun, cloud, rain — SVG, not emoji), a temperature, and one word description. *"Warm"*, *"Overcast"*, *"Breezy"*. No hourly breakdown here — that's for a dedicated weather app.

**4. Day Timeline** (Right, top — largest card)
The backbone of the dashboard. A vertical time spine (DM Mono timestamps on the left, 5px wide vertical line in Parchment). Events hang off it as horizontal pill-cards. Each pill: title in Inter Semi-Bold, time in DM Mono Muted, category color on left border.

Spacing is proportional — a 2-hour gap looks taller than a 30-minute gap. Current time is marked with a small amber dot on the spine.

**5. Tasks / Intentions Card** (Right, middle)
Three to five tasks, rendered as full-width rows with large tap targets (≥ 48px height per row per accessibility best practice). Checkbox left, title center, optional tag pill right. Checked items cross out with a subtle strikethrough and fade to muted — they don't disappear, which gives satisfaction without clutter.

**6. Habit Streaks Card** (Right, bottom)
Five to eight habits shown as a row of labeled icon-badges. Each badge: a small icon or initial letter, habit name below in 11px Inter, and a dot-row beneath showing the last 7 days (filled amber dot = done, parchment dot = missed). No numbers, no percentages. Visual, immediate, non-judgmental.

---

## Interaction Design

**Hover states:** Cards lift with `transform: translateY(-2px)` and a slightly deeper shadow on hover. Subtle enough for desktop; no hover on mobile.

**Tap / Click feedback:** Checkboxes animate with a quick scale pulse (100ms) and color fill. No jank, no layout shift.

**Loading state:** The ring arc starts at 0 and sweeps to the correct time position on first paint. Text fades in 200ms after the arc completes. No spinner. The animation *is* the loading state.

**Empty states:** Written directly in the card, in the same voice as the rest of the UI. "Nothing on the timeline yet — a clear day." Not "No events found."

**Transitions:** Page-level transitions are minimal. A 150ms opacity fade when switching days. No sliding panels or complex choreography — the dashboard is a *place*, not an app you navigate through.

---

## Spacing System

Base unit: `8px`. All spacing is a multiple of this.

```
--space-1:   4px   (tight internal padding, icon gaps)
--space-2:   8px   (within-card element spacing)
--space-3:  12px   (label-to-content gaps)
--space-4:  16px   (card internal padding, standard)
--space-5:  20px   (card internal padding, generous)
--space-6:  24px   (between-card gaps)
--space-8:  32px   (section separation)
--space-12: 48px   (major panel padding)
```

Minimum touch target: `48px` height on all interactive elements (per WCAG 2.5.5 AAA).

---

## Accessibility & Inclusivity

These are non-negotiables, not afterthoughts.

- All text meets WCAG AA contrast (4.5:1 for body, 3:1 for large text against its background).
- Amber on Warm White (`#F5A623` on `#FAFAF7`) is used only for decorative elements — never for text-on-color that must be legible.
- Font sizes never go below 12px. Body defaults to 15–16px, which is comfortable for ages 12 to 70+.
- `prefers-reduced-motion` respected: the ring arc draws instantly, no sweep animation.
- Focus rings visible and styled — `outline: 2px solid #F5A623; outline-offset: 3px` — not hidden.
- No information is conveyed by color alone (category dots always have a text label visible on hover/tap).
- All icon SVGs carry `aria-label` or are paired with visible text.

---

## What This Is Not

To keep the build honest:

- Not a habit-tracking app. Habits are one small card, not the center.
- Not a calendar replacement. The timeline shows today only. Navigating forward/back is secondary.
- Not an analytics dashboard. No charts, no trend lines, no weekly summaries on the main view.
- Not customizable-everything. The structure is fixed; content is personal. Fewer choices = less friction every morning.

---

## Implementation Notes

**Stack recommendation:** Vanilla HTML/CSS/JS or lightweight React. No heavy charting libraries needed. The Today Ring can be rendered as an SVG `<circle>` with `stroke-dasharray` / `stroke-dashoffset`.

**Fonts:** Load from Google Fonts — `Fraunces:opsz,wght@9..144,300..900`, `Inter:wght@400;600`, `DM+Mono:wght@400`.

**Data layer:** JSON-driven. All content (tasks, events, habits) reads from a local JSON file or a simple REST call. The UI never hard-codes content strings.

**First screen rendered in ≤ 200ms.** The greeting and ring render from client-side time — no API call needed for the initial paint. Events and tasks load asynchronously; skeleton states (not spinners) hold their space.

---

## The One Rule

If it would look at home in a corporate SaaS demo or an AI portfolio template, remove it. Every element earns its place by being useful, warm, or quietly beautiful. Usually all three.