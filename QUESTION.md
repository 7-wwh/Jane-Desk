# Question Log — Life-at-a-Glance

Unresolved design questions. Each entry: the question, why it matters, options, and (when
decided) the answer with a date. Agents and humans both keep this current.

---

## Tasks

**Q1. Checkbox behavior** — Clicking a task checkbox currently toggles it between `done`
and `wanted` (reopen). Should it instead cycle through the progression (`wanted →
planned → in_progress → done`), or be a plain toggle between "not done" and "done"?

- *Why it matters:* determines whether a checkbox is a "complete" control or a status cycler.
- *Options:*
  1. Toggle done ↔ wanted (current).
  2. Checkbox completes; a separate control advances wanted → planned → in_progress.
  3. Checkbox cycles all four states.
- *Status:* ⏳ open

**Q2. Status advancement** — Should the UI expose buttons to advance a task along
`wanted → planned → in_progress → done`, or is "not done ↔ done" enough for v1?

- *Why it matters:* the status layer is richer than the current UI lets you express.
- *Status:* ⏳ open

**Q3. "Next up" selection** — The focus panel picks the highest-priority non-done task of
the top active project. Should selection prefer `in_progress` tasks over `wanted` ones
(keep momentum) or strictly priority order?

- *Why it matters:* affects what "one thing to do now" shows each morning.
- *Status:* ⏳ open

**Q4. Task limits per project card** — Cards show up to 4 tasks (open first, then done),
then "+ Add". Is 4 right, or should it show all with scrolling?

- *Status:* ⏳ open

**Q5. Due dates** — Tasks support `due_date` in the API but the UI doesn't render or edit
it yet. Show due dates on task rows?

- *Status:* ⏳ open

---

## Status layer & health

**Q6. Status thresholds** — How should per-area status (e.g. Health, Career) be computed
from the data? Draft rule to confirm: red if a high-priority task/project is overdue or
stalled (>N days no update); amber if only low-priority items in flight; green if
current/next steps exist and are recent.

- *Why it matters:* the "is this area going okay?" glance is the core ask of the dashboard.
- *Status:* ⏳ open — waiting on user's health rules, which arrive via `skills/status/SKILL.md`.

**Q7. Where do status rules live?** — Confirmed decision: rules are **external to the UI**
in `skills/status/SKILL.md`; the UI maps data → status. No code change needed. Just
confirming the dashboard should *display* the computed status rather than *judge* it.

- *Status:* ✅ decided (external rules, UI displays)

**Q8. Per-area vs per-project status** — User asked for BOTH per-area and per-project
status. Per-project is `active/backlog/done/paused` (existing). Per-area aggregates from
its projects/tasks. Any changes to area names (career/health/family/learning/finance/other)?

- *Status:* ⏳ open

---

## Aggregation & granularity

**Q9. Weekly vs daily status** — Should the area status reflect today (did anything happen
today), this week, or a rolling window (last 7 days)? Affects how noisy the status feels.

- *Status:* ⏳ open

**Q10. Same-day learnings** — Multiple learnings on one day currently each show in the
timeline. Deduplicate into a single "N learnings" row?

- *Status:* ⏳ open

---

## Click-through & detail panel

**Q11. Click behavior** — Clicking a project card currently only opens edit in the modal.
Should clicking open a **detail panel** (tasks, progress, notes) instead, with an explicit
Edit button?

- *Why it matters:* user asked for click-through = edit/detail panel. Need to confirm
  detail-panel contents and whether it replaces or supplements the modal.
- *Status:* ⏳ open

**Q12. Task detail** — Should tasks be editable inline (title/priority/due date) from the
detail panel, or is add + toggle-done enough for v1?

- *Status:* ⏳ open

---

## Layout & scope

**Q13. Tabs** — Keep the five minimal tabs (Overview / Projects / Goals / Knowledge /
Timeline) as-is? The warm redesign is on a separate branch ready to merge.

- *Status:* ⏳ open

**Q14. Greeting/name** — Greeting uses a time-based phrase only, no name (per earlier
decision "remove the name feature first"). Final: keep it nameless?

- *Status:* ✅ decided (no name)

**Q15. Health/nutrition APIs** — Deferred to a future iteration; placeholder in
`skills/health/SKILL.md`. Still deferred?

- *Status:* ✅ decided (deferred)
